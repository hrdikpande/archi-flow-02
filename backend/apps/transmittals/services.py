"""Issue and transmittals (F-14, F-07, A-03; 03 §8, 02 §6, 02 §9).

`issue()` is the only way a sheet reaches `issued`. In one transaction it supersedes earlier
issued revisions (the partial unique index needs that), issues the drafts and creates the
numbered transmittal. Cover sheet, emails and A-03 notices follow from outbox events.
"""

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.accounts.roles import ProjectRole
from apps.audit.services import record, record_change, snapshot
from apps.contacts.models import Contact
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import OrgSettings
from apps.outbox.services import emit
from apps.projects.models import Project, ProjectMembership
from apps.register.models import NamingStatus, RevisionState, Sheet, SheetRevision, SheetState
from apps.workflow.services import record_system_transition

from .models import (
    Delivery,
    ExternalLink,
    LinkKind,
    Transmittal,
    TransmittalItem,
    TransmittalRecipient,
    hash_token,
)


def _codes(organisation_id: Any) -> tuple[dict[str, str], dict[str, str]]:
    s = OrgSettings.objects.get(organisation_id=organisation_id)
    purposes = {p["code"]: p["label"] for p in s.purpose_codes if p.get("active", True)}
    suitability = {p["code"]: p["label"] for p in s.suitability_codes if p.get("active", True)}
    return purposes, suitability


def purpose_label(organisation_id: Any, code: str) -> str:
    s = OrgSettings.objects.get(organisation_id=organisation_id)
    return next((p["label"] for p in s.purpose_codes if p["code"] == code), code)


@dataclass
class Check:
    sheet: Sheet
    revision: SheetRevision | None
    problem: str | None = None
    previous: SheetRevision | None = None


@dataclass
class Plan:
    checks: list[Check]
    contacts: list[Contact]
    purpose: str
    purpose_label: str
    previous_recipients: list[Contact] = field(default_factory=list)

    @property
    def blocked(self) -> list[Check]:
        return [c for c in self.checks if c.problem]

    @property
    def superseded_count(self) -> int:
        return sum(1 for c in self.checks if c.previous is not None)

    def summary(self) -> str:
        n = len(self.checks)
        r = len(self.contacts)
        text = (
            f"Issue {n} sheet{'s' if n != 1 else ''} to {r} recipient{'s' if r != 1 else ''} "
            f"for {self.purpose_label}."
        )
        if self.superseded_count:
            k = self.superseded_count
            plural = k != 1
            text += f" {k} earlier revision{'s' if plural else ''} become{'' if plural else 's'}"
            text += " superseded."
        if self.previous_recipients:
            k = len(self.previous_recipients)
            text += f" {k} previous recipient{'s' if k != 1 else ''} will be told."
        return text


def _is_pl(actor: User, project: Project) -> bool:
    return ProjectMembership.objects.filter(
        project=project, user=actor, role=ProjectRole.PL
    ).exists()


def plan(
    actor: User,
    project: Project,
    *,
    sheet_ids: list[Any],
    purpose: str,
    contact_ids: list[Any],
    override_reason: str = "",
    lock: bool = False,
) -> Plan:
    """Checks everything `issue()` would; used for the composer preview (S-07)."""
    require(actor, Action.ISSUE_SHEETS, project=project)
    purposes, _ = _codes(project.organisation_id)
    if purpose not in purposes:
        raise DomainError("invalid_purpose", "Choose the purpose of this issue.", field="purpose")
    if not sheet_ids:
        raise DomainError("no_sheets", "Choose at least one sheet to issue.")
    qs = Sheet.objects.filter(project=project, pk__in=sheet_ids).order_by("number")
    if lock:
        qs = qs.select_for_update()
    sheets = list(qs)
    if len(sheets) != len(set(map(str, sheet_ids))):
        raise DomainError("unknown_sheets", "Some sheets are not in this project.")
    contacts = list(
        Contact.objects.filter(
            organisation_id=project.organisation_id, pk__in=contact_ids, is_active=True
        ).select_related("external_org")
    )
    if len(contacts) != len(set(map(str, contact_ids))):
        raise DomainError("unknown_contacts", "Some recipients are unknown or inactive.")
    if not contacts:
        raise DomainError("no_recipients", "Choose at least one recipient.", field="recipients")
    override = bool(override_reason.strip()) and _is_pl(actor, project)
    checks = []
    for sheet in sheets:
        draft = sheet.revisions.filter(state=RevisionState.DRAFT).select_related("file").first()
        previous = sheet.revisions.filter(state=RevisionState.ISSUED).first()
        problem = None
        if sheet.state != SheetState.APPROVED_FOR_ISSUE and not (
            override
            and sheet.state
            in (
                SheetState.IN_PROGRESS,
                SheetState.READY_FOR_CHECK,
                SheetState.IN_CHECK,
                SheetState.CHANGES_REQUESTED,
            )
        ):
            problem = f"{sheet.get_state_display()}: only approved sheets can be issued."
        elif draft is None or draft.file_id is None:
            problem = "Upload PDF first."
        elif draft.naming_status == NamingStatus.PENDING:
            problem = "The PDF name is still being checked."
        elif draft.naming_status == NamingStatus.BLOCKED:
            problem = draft.naming_message or "The PDF name breaks the naming rule."
        checks.append(Check(sheet, draft, problem, previous))
    chosen = {c.pk for c in contacts}
    prior = (
        TransmittalRecipient.objects.filter(
            transmittal__items__revision__sheet__in=sheets, delivery=Delivery.EMAIL
        )
        .exclude(contact_id__in=chosen)
        .select_related("contact")
    )
    previous_recipients = list({r.contact_id: r.contact for r in prior if r.contact.email}.values())
    return Plan(checks, contacts, purpose, purposes[purpose], previous_recipients)


@transaction.atomic
def issue(
    actor: User,
    project: Project,
    *,
    sheet_ids: list[Any],
    purpose: str,
    contact_ids: list[Any],
    hand_contact_ids: list[Any] | None = None,
    suitability: str = "",
    note: str = "",
    supersedes: Transmittal | None = None,
    override_reason: str = "",
) -> Transmittal:
    project = Project.objects.select_for_update().get(pk=project.pk)
    p = plan(
        actor,
        project,
        sheet_ids=sheet_ids,
        purpose=purpose,
        contact_ids=contact_ids,
        override_reason=override_reason,
        lock=True,
    )
    if p.blocked:
        raise ConflictError(
            "issue_blocked",
            f"{len(p.blocked)} sheet(s) cannot be issued yet.",
            blocked=[
                {"sheet_id": str(c.sheet.pk), "number": c.sheet.number, "reason": c.problem}
                for c in p.blocked
            ],
        )
    _, suitabilities = _codes(project.organisation_id)
    if suitability and suitability not in suitabilities:
        raise DomainError("invalid_suitability", "Unknown suitability code.")
    if supersedes is not None and supersedes.project_id != project.pk:
        raise DomainError(
            "invalid_correction", "The corrected transmittal is from another project."
        )
    now = timezone.now()
    seq = (Transmittal.objects.filter(project=project).aggregate(m=Max("seq"))["m"] or 0) + 1
    transmittal = Transmittal.objects.create(
        organisation_id=project.organisation_id,
        created_by=actor,
        project=project,
        seq=seq,
        number=f"{project.code}-TR-{seq:04d}",
        purpose=purpose,
        suitability=suitability,
        note=note,
        sent_at=now,
        sent_by=actor,
        supersedes=supersedes,
        override_reason=override_reason
        if any(c.sheet.state != SheetState.APPROVED_FOR_ISSUE for c in p.checks)
        else "",
    )
    hand = {str(i) for i in hand_contact_ids or []}
    for contact in p.contacts:
        by_hand = str(contact.pk) in hand or not contact.email
        TransmittalRecipient.objects.create(
            transmittal=transmittal,
            contact=contact,
            delivery=Delivery.HAND if by_hand else Delivery.EMAIL,
            delivered_at=now if by_hand else None,
        )
    for check in p.checks:
        sheet, draft = check.sheet, check.revision
        if draft is None:  # plan() already blocks this; never issue without a revision
            raise ConflictError("no_revision", f"{sheet.number} has no draft revision.")
        from_state = sheet.state
        if check.previous is not None:
            before = snapshot(check.previous, ("state",))
            check.previous.state = RevisionState.SUPERSEDED
            check.previous.superseded_at = now
            check.previous.save(update_fields=["state", "superseded_at", "updated_at"])
            record_change(
                check.previous,
                actor=actor,
                verb="revision.superseded",
                before=before,
                after=snapshot(check.previous, ("state",)),
            )
        before = snapshot(draft, ("state", "purpose"))
        draft.state = RevisionState.ISSUED
        draft.purpose = purpose
        draft.suitability = suitability
        draft.issued_at = now
        draft.issued_by = actor
        draft.transmittal = transmittal
        draft.stage = sheet.stage
        draft.save()
        record_change(
            draft,
            actor=actor,
            verb="revision.issued",
            before=before,
            after=snapshot(draft, ("state", "purpose")),
        )
        TransmittalItem.objects.create(transmittal=transmittal, revision=draft)
        sheet.state = SheetState.ISSUED
        sheet.current_revision = draft
        sheet.state_changed_at = now
        sheet.save(update_fields=["state", "current_revision", "state_changed_at", "updated_at"])
        record_system_transition(
            sheet,
            "issue",
            from_state,
            actor,
            reason=override_reason if from_state != SheetState.APPROVED_FOR_ISSUE else "",
        )
        emit(
            "revision.issued",
            {
                "revision_id": str(draft.pk),
                "sheet_id": str(sheet.pk),
                "previous_revision_id": str(check.previous.pk) if check.previous else None,
                "transmittal_id": str(transmittal.pk),
                "project_id": str(project.pk),
            },
            organisation_id=project.organisation_id,
        )
        emit(
            "sheet.state_changed",
            {
                "sheet_id": str(sheet.pk),
                "project_id": str(project.pk),
                "action": "issue",
                "from": from_state,
                "to": SheetState.ISSUED,
                "actor_id": str(actor.pk),
            },
            organisation_id=project.organisation_id,
        )
    record(
        organisation_id=project.organisation_id,
        actor=actor,
        verb="transmittal.sent",
        entity_type="transmittals.transmittal",
        entity_id=transmittal.pk,
        entity_label=transmittal.number,
        after={"sheets": len(p.checks), "recipients": len(p.contacts), "purpose": purpose},
        project_id=project.pk,
    )
    emit(
        "transmittal.sent",
        {"transmittal_id": str(transmittal.pk), "project_id": str(project.pk)},
        organisation_id=project.organisation_id,
    )
    return transmittal


# --- Links and delivery ---------------------------------------------------------------------


def link_days(organisation_id: Any) -> int:
    return OrgSettings.objects.get(organisation_id=organisation_id).transmittal_link_days


def create_link(
    transmittal: Transmittal,
    contact: Contact,
    kind: str,
    revisions: list[SheetRevision] | None = None,
) -> tuple[ExternalLink, str]:
    token = ExternalLink.new_token()
    link = ExternalLink.objects.create(
        organisation_id=transmittal.organisation_id,
        kind=kind,
        contact=contact,
        transmittal=transmittal,
        token_hash=hash_token(token),
        expires_at=timezone.now() + timedelta(days=link_days(transmittal.organisation_id)),
    )
    if revisions:
        link.revisions.set(revisions)
    return link, token


def public_url(token: str) -> str:
    return f"{settings.FRONTEND_URL}/t/{token}"


def deliver(recipient: TransmittalRecipient) -> bool:
    """Email one recipient their link (idempotent: delivered recipients are skipped)."""
    if recipient.delivery != Delivery.EMAIL or recipient.delivered_at is not None:
        return False
    transmittal = recipient.transmittal
    link, token = create_link(transmittal, recipient.contact, LinkKind.TRANSMITTAL)
    recipient.link = link
    recipient.save(update_fields=["link"])
    items = [
        {
            "number": i.revision.sheet.number,
            "title": i.revision.sheet.title,
            "revision": i.revision.code,
        }
        for i in transmittal.items.select_related("revision__sheet").order_by(
            "revision__sheet__number"
        )
    ]
    context = {
        "name": recipient.contact.full_name,
        "number": transmittal.number,
        "project": f"{transmittal.project.code} {transmittal.project.name}",
        "purpose": purpose_label(transmittal.organisation_id, transmittal.purpose),
        "sender": transmittal.sent_by.full_name or transmittal.sent_by.email,
        "firm": transmittal.project.organisation.name,
        "items": items,
        "note": transmittal.note,
        "url": public_url(token),
        "expires": display_date(link.expires_at, transmittal.project.organisation.timezone),
    }
    from .tasks import send_transmittal_email

    email = recipient.contact.email
    transaction.on_commit(
        lambda: send_transmittal_email.delay(str(recipient.pk), email, "transmittal", context)
    )
    return True


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def display_date(value: Any, tz: str) -> str:
    """DD-Mon-YYYY in the organisation's timezone (N-08)."""
    from zoneinfo import ZoneInfo

    local = value.astimezone(ZoneInfo(tz))
    return f"{local.day:02d}-{MONTHS[local.month - 1]}-{local.year}"


@transaction.atomic
def resend(actor: User, recipient: TransmittalRecipient) -> TransmittalRecipient:
    """Bounced or lost email: a fresh link to the same recipient (03 §8 edge case)."""
    require(actor, Action.ISSUE_SHEETS, project=recipient.transmittal.project)
    if recipient.delivery != Delivery.EMAIL:
        raise DomainError("hand_delivery", "This recipient received the drawings by hand.")
    if recipient.link_id:
        ExternalLink.objects.filter(pk=recipient.link_id).update(revoked_at=timezone.now())
    recipient.delivered_at = None
    recipient.bounced_at = None
    recipient.bounce_reason = ""
    recipient.link = None
    recipient.save()
    record(
        organisation_id=recipient.transmittal.organisation_id,
        actor=actor,
        verb="transmittal.resent",
        entity_type="transmittals.transmittalrecipient",
        entity_id=recipient.pk,
        entity_label=f"{recipient.transmittal} → {recipient.contact}",
        project_id=recipient.transmittal.project_id,
    )
    transaction.on_commit(lambda: _deliver_after_commit(recipient.pk))
    return recipient


def _deliver_after_commit(recipient_id: Any) -> None:
    recipient = TransmittalRecipient.objects.select_related(
        "transmittal__project__organisation", "transmittal__sent_by", "contact"
    ).get(pk=recipient_id)
    with transaction.atomic():
        deliver(recipient)


def mark_delivered(recipient_id: Any) -> None:
    TransmittalRecipient.objects.filter(pk=recipient_id, delivered_at__isnull=True).update(
        delivered_at=timezone.now()
    )


def mark_bounced(recipient_id: Any, reason: str) -> None:
    TransmittalRecipient.objects.filter(pk=recipient_id).update(
        bounced_at=timezone.now(), bounce_reason=reason[:300]
    )


def resolve_link(token: str) -> ExternalLink | None:
    return (
        ExternalLink.objects.select_related(
            "transmittal__project__organisation", "transmittal__sent_by", "contact"
        )
        .filter(token_hash=hash_token(token), revoked_at__isnull=True)
        .first()
    )


def link_revisions(link: ExternalLink) -> list[SheetRevision]:
    if link.kind == LinkKind.NOTICE:
        return list(link.revisions.select_related("sheet", "file").order_by("sheet__number"))
    return [
        i.revision
        for i in link.transmittal.items.select_related(
            "revision__sheet", "revision__file"
        ).order_by("revision__sheet__number")
    ]


def distribution(sheet: Sheet) -> list[dict[str, Any]]:
    """'Who has which revision' for one sheet (03 §8 reports)."""
    rows = []
    items = TransmittalItem.objects.filter(revision__sheet=sheet).select_related(
        "transmittal", "revision"
    )
    for item in items:
        for r in item.transmittal.recipients.select_related("contact__external_org"):
            rows.append(
                {
                    "contact": r.contact.full_name,
                    "organisation": r.contact.external_org.name if r.contact.external_org else "",
                    "revision": item.revision.code,
                    "revision_state": item.revision.state,
                    "transmittal": item.transmittal.number,
                    "sent_at": item.transmittal.sent_at,
                    "delivery": r.delivery,
                    "downloaded_at": r.last_downloaded_at,
                }
            )
    return sorted(rows, key=lambda r: (r["contact"], r["sent_at"]))

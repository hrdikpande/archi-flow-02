"""Side effects of issuing (02 §7): cover, emails, A-03 notices. All idempotent."""

from functools import partial

from django.db import transaction

from apps.accounts.roles import ProjectRole
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles
from apps.projects.people import members_with_role
from apps.register.models import SheetRevision

from .models import Delivery, ExternalLink, LinkKind, Transmittal, TransmittalRecipient


@handles("transmittal.sent")
def make_cover(event: OutboxEvent) -> None:
    from .tasks import generate_cover

    transmittal_id = event.payload["transmittal_id"]
    transaction.on_commit(lambda: generate_cover.delay(transmittal_id))


@handles("transmittal.sent")
def email_recipients(event: OutboxEvent) -> None:
    from .services import deliver

    recipients = TransmittalRecipient.objects.filter(
        transmittal_id=event.payload["transmittal_id"],
        delivery=Delivery.EMAIL,
        delivered_at__isnull=True,
        link__isnull=True,
    ).select_related("transmittal__project__organisation", "transmittal__sent_by", "contact")
    for recipient in recipients:
        deliver(recipient)


@handles("transmittal.sent")
def copy_project_lead(event: OutboxEvent) -> None:
    from apps.notifications.services import notify_many

    t = Transmittal.objects.select_related("project", "sent_by").get(
        pk=event.payload["transmittal_id"]
    )
    leads = [u for u in members_with_role(t.project_id, ProjectRole.PL) if u.pk != t.sent_by_id]
    notify_many(
        leads,
        "transmittal_sent",
        title=f"{t.number} sent: {t.items.count()} sheets to {t.recipients.count()} recipients",
        body=f"Sent by {t.sent_by.short_name}.",
        link=f"/projects/{t.project_id}/transmittals/{t.pk}",
        project=t.project,
        entity=t,
        dedupe_key=f"transmittal-sent:{t.pk}",
    )


@handles("revision.issued")
def notify_previous_recipients(event: OutboxEvent) -> None:
    """A-03: everyone who received an earlier revision gets a link to the new one."""
    from apps.notifications.services import notify_many

    from .services import create_link, display_date, public_url
    from .tasks import send_notice_email

    revision = SheetRevision.objects.select_related(
        "sheet__project__organisation", "transmittal"
    ).get(pk=event.payload["revision_id"])
    transmittal = revision.transmittal
    if transmittal is None:
        return
    sheet = revision.sheet
    current = set(transmittal.recipients.values_list("contact_id", flat=True))
    earlier = (
        TransmittalRecipient.objects.filter(
            transmittal__items__revision__sheet=sheet, delivery=Delivery.EMAIL
        )
        .exclude(transmittal=transmittal)
        .exclude(contact_id__in=current)
        .select_related("contact", "transmittal")
    )
    told = 0
    seen = set()
    org = sheet.project.organisation
    for r in earlier:
        if r.contact_id in seen or not r.contact.email:
            continue
        seen.add(r.contact_id)
        already = ExternalLink.objects.filter(
            kind=LinkKind.NOTICE, contact=r.contact, transmittal=transmittal, revisions=revision
        ).exists()
        if already:
            continue
        link, token = create_link(transmittal, r.contact, LinkKind.NOTICE, [revision])
        old = r.transmittal.items.filter(revision__sheet=sheet).select_related("revision").first()
        context = {
            "name": r.contact.full_name,
            "firm": org.name,
            "number": sheet.number,
            "title": sheet.title,
            "project": f"{sheet.project.code} {sheet.project.name}",
            "revision": revision.code,
            "old_revision": old.revision.code if old else "",
            "url": public_url(token),
            "expires": display_date(link.expires_at, org.timezone),
        }
        email = r.contact.email
        transaction.on_commit(partial(send_notice_email.delay, email, context))
        told += 1
    if told:
        notify_many(
            members_with_role(sheet.project_id, ProjectRole.DC),
            "transmittal_sent",
            title=f"{sheet.number} {revision.code}: told {told} earlier recipient(s)",
            link=f"/projects/{sheet.project_id}/sheets/{sheet.pk}",
            project=sheet.project,
            entity=revision,
            dedupe_key=f"a03:{revision.pk}",
        )

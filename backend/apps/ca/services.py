"""Construction administration (P3, 03 §14): RFIs (F-30), submittals (F-31), site visit reports
(F-32), change orders (F-33). Every change is audited; side effects go through the outbox."""

from datetime import date
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, PermissionDeniedError, can, require
from apps.audit.services import record_change, snapshot
from apps.core.exceptions import ConflictError, DomainError
from apps.files import storage
from apps.outbox.services import emit
from apps.projects.models import Project, ProjectMembership
from apps.register.models import Sheet

from . import common
from .models import (
    ChangeOrder,
    ChangeStatus,
    Party,
    ReportState,
    Rfi,
    RfiStatus,
    SiteObservation,
    SiteReport,
    Submittal,
    SubmittalStatus,
)

RFI_FIELDS = ("subject", "status", "ball_in_court", "assignee", "due_on", "response")
SUBMITTAL_FIELDS = ("title", "status", "round", "reviewer", "review_comment", "file")
CO_FIELDS = ("title", "status", "cost_impact", "schedule_impact_days", "decision_note")


def _sheets(project: Project, sheets: list[Sheet] | None) -> list[Sheet]:
    sheets = sheets or []
    if any(s.project_id != project.pk for s in sheets):
        raise DomainError("invalid_sheet", "A linked sheet belongs to another project.")
    return sheets


def _member(project: Project, user: User | None) -> None:
    if (
        user is not None
        and not ProjectMembership.objects.filter(project=project, user=user).exists()
    ):
        raise DomainError("not_member", f"{user} is not on this project's team.")


def _emit(kind: str, obj: Any, what: str) -> None:
    emit(
        f"{kind}.{what}",
        {"id": str(obj.pk), "project_id": str(obj.project_id)},
        organisation_id=obj.organisation_id,
    )


def visible(model: type[Any], user: User, project: Project) -> QuerySet[Any]:
    require(user, Action.VIEW_PROJECT, project=project)
    return model.objects.filter(project=project)


# --- F-30 RFIs ------------------------------------------------------------------------------


@transaction.atomic
def create_rfi(
    actor: User,
    project: Project,
    *,
    subject: str,
    question: str,
    received_on: date,
    due_on: date,
    raised_by: Any = None,
    raised_by_name: str = "",
    sheets: list[Sheet] | None = None,
    assignee: User | None = None,
    attachment_ids: list[Any] | None = None,
    cost_impact: bool = False,
    schedule_impact: bool = False,
) -> Rfi:
    require(actor, Action.MANAGE_CA, project=project)
    if due_on < received_on:
        raise DomainError("invalid_due", "The response is due before the RFI was received.")
    sheets = _sheets(project, sheets)
    _member(project, assignee)
    project = common.lock_project(project)
    seq, number = common.next_number(project, Rfi, "RFI")
    rfi = Rfi.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=number,
        subject=subject.strip(),
        question=question,
        received_on=received_on,
        due_on=due_on,
        raised_by=raised_by,
        raised_by_name=raised_by_name,
        assignee=assignee,
        cost_impact=cost_impact,
        schedule_impact=schedule_impact,
        created_by=actor,
        ball_in_court=Party.FIRM,
    )
    rfi.sheets.set(sheets)
    rfi.attachments.set(common.upload_files(actor, attachment_ids or []))
    record_change(
        rfi, actor=actor, verb="rfi.created", before=None, after=snapshot(rfi, RFI_FIELDS)
    )
    _emit("rfi", rfi, "created")
    return rfi


def _can_answer(actor: User, rfi: Rfi) -> bool:
    return rfi.assignee_id == actor.pk or can(actor, Action.MANAGE_CA, project=rfi.project)


@transaction.atomic
def update_rfi(actor: User, rfi: Rfi, **data: Any) -> Rfi:
    rfi = Rfi.objects.select_for_update(of=("self",)).select_related("project").get(pk=rfi.pk)
    require(actor, Action.MANAGE_CA, project=rfi.project)
    before = snapshot(rfi, RFI_FIELDS)
    if "sheets" in data:
        rfi.sheets.set(_sheets(rfi.project, data.pop("sheets")))
    if "assignee" in data:
        _member(rfi.project, data["assignee"])
    for k in (
        "subject",
        "question",
        "due_on",
        "assignee",
        "ball_in_court",
        "cost_impact",
        "schedule_impact",
    ):
        if k in data:
            setattr(rfi, k, data[k])
    rfi.save()
    record_change(
        rfi, actor=actor, verb="rfi.updated", before=before, after=snapshot(rfi, RFI_FIELDS)
    )
    _emit("rfi", rfi, "changed")
    return rfi


@transaction.atomic
def respond_rfi(
    actor: User, rfi: Rfi, response: str, revise_sheets: list[Sheet] | None = None
) -> dict[str, Any]:
    """Answer the RFI; the ball goes to the contractor. Optionally start the next revision of
    issued sheets the answer changes (F-30: 'answering it may start a new revision')."""
    rfi = Rfi.objects.select_for_update(of=("self",)).select_related("project").get(pk=rfi.pk)
    if not _can_answer(actor, rfi):
        raise PermissionDeniedError(Action.MANAGE_CA)
    if rfi.status in (RfiStatus.CLOSED, RfiStatus.VOID):
        raise ConflictError("rfi_closed", f"{rfi.number} is {rfi.get_status_display().lower()}.")
    if not response.strip():
        raise DomainError("response_required", "Write the answer.")
    before = snapshot(rfi, RFI_FIELDS)
    rfi.response, rfi.status = response, RfiStatus.ANSWERED
    rfi.responded_at, rfi.responded_by, rfi.ball_in_court = timezone.now(), actor, Party.CONTRACTOR
    rfi.save()
    started, skipped = common.start_revisions(actor, _sheets(rfi.project, revise_sheets))
    record_change(
        rfi,
        actor=actor,
        verb="rfi.answered",
        before=before,
        after={**snapshot(rfi, RFI_FIELDS), "revisions_started": started},
    )
    _emit("rfi", rfi, "changed")
    return {"rfi": rfi, "revisions_started": started, "skipped": skipped}


@transaction.atomic
def close_rfi(actor: User, rfi: Rfi, void: bool = False, reason: str = "") -> Rfi:
    rfi = Rfi.objects.select_for_update(of=("self",)).select_related("project").get(pk=rfi.pk)
    require(actor, Action.MANAGE_CA, project=rfi.project)
    if void and not reason.strip():
        raise DomainError("reason_required", "Say why the RFI is void.")
    if not void and rfi.status != RfiStatus.ANSWERED:
        raise ConflictError("not_answered", "Answer the RFI before closing it.")
    before = snapshot(rfi, RFI_FIELDS)
    rfi.status = RfiStatus.VOID if void else RfiStatus.CLOSED
    if void:
        rfi.response = rfi.response or f"Void: {reason.strip()}"
    rfi.ball_in_court = ""
    rfi.save()
    record_change(
        rfi,
        actor=actor,
        verb="rfi.voided" if void else "rfi.closed",
        before=before,
        after=snapshot(rfi, RFI_FIELDS),
    )
    _emit("rfi", rfi, "changed")
    return rfi


# --- F-31 submittals ------------------------------------------------------------------------


def ball_in_court(submittal: Submittal) -> str:
    """Who owes the next action (F-31: 'the log shows who owes the next action')."""
    if submittal.status == SubmittalStatus.PENDING:
        return Party.FIRM
    if submittal.status in (SubmittalStatus.REVISE_RESUBMIT, SubmittalStatus.REJECTED):
        return Party.CONTRACTOR
    return ""  # approved / approved as noted: closed


@transaction.atomic
def create_submittal(
    actor: User,
    project: Project,
    *,
    title: str,
    kind: str,
    received_on: date,
    file_upload: Any,
    spec_section: str = "",
    due_on: date | None = None,
    submitted_by: Any = None,
    submitted_by_name: str = "",
    reviewer: User | None = None,
    sheets: list[Sheet] | None = None,
) -> Submittal:
    require(actor, Action.MANAGE_CA, project=project)
    sheets = _sheets(project, sheets)
    _member(project, reviewer)
    if reviewer is not None and not can(reviewer, Action.REVIEW_SUBMITTAL, project=project):
        raise DomainError("not_reviewer", f"{reviewer} cannot review submittals on this project.")
    file = common.upload_files(actor, [file_upload])[0]
    project = common.lock_project(project)
    seq, number = common.next_number(project, Submittal, "SUB")
    sub = Submittal.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=number,
        title=title.strip(),
        kind=kind,
        spec_section=spec_section,
        received_on=received_on,
        due_on=due_on,
        submitted_by=submitted_by,
        submitted_by_name=submitted_by_name,
        reviewer=reviewer,
        file=file,
        created_by=actor,
    )
    sub.sheets.set(sheets)
    record_change(
        sub,
        actor=actor,
        verb="submittal.created",
        before=None,
        after=snapshot(sub, SUBMITTAL_FIELDS),
    )
    _emit("submittal", sub, "created")
    return sub


@transaction.atomic
def review_submittal(actor: User, sub: Submittal, *, status: str, comment: str = "") -> Submittal:
    """Set the review status and stamp the PDF with status, date and reviewer (F-31)."""
    from .stamp import stamp_submittal

    sub = (
        Submittal.objects.select_for_update(of=("self",))
        .select_related("project__organisation", "file")
        .get(pk=sub.pk)
    )
    require(actor, Action.REVIEW_SUBMITTAL, project=sub.project)
    if sub.status != SubmittalStatus.PENDING:
        raise ConflictError(
            "already_reviewed", f"{sub.number} round {sub.round} is already reviewed."
        )
    if status not in SubmittalStatus.values or status == SubmittalStatus.PENDING:
        raise DomainError("invalid_status", "Choose a review status.")
    if (
        status
        in (
            SubmittalStatus.REVISE_RESUBMIT,
            SubmittalStatus.REJECTED,
            SubmittalStatus.APPROVED_AS_NOTED,
        )
        and not comment.strip()
    ):
        raise DomainError("comment_required", "Say what the contractor must change or note.")
    before = snapshot(sub, SUBMITTAL_FIELDS)
    sub.status, sub.review_comment = status, comment
    sub.reviewed_at, sub.reviewed_by = timezone.now(), actor
    if sub.file is not None and sub.file.mime == "application/pdf":
        stamped = stamp_submittal(storage.get_bytes(sub.file.storage_key), sub, actor)
        sub.stamped_file = common.store_generated(
            sub.organisation_id, stamped, f"{sub.number} R{sub.round} stamped.pdf", "stamped"
        )
    sub.save()
    record_change(
        sub,
        actor=actor,
        verb="submittal.reviewed",
        before=before,
        after=snapshot(sub, SUBMITTAL_FIELDS),
    )
    _emit("submittal", sub, "reviewed")
    return sub


@transaction.atomic
def resubmit(actor: User, sub: Submittal, file_upload: Any) -> Submittal:
    sub = Submittal.objects.select_for_update(of=("self",)).select_related("project").get(pk=sub.pk)
    require(actor, Action.MANAGE_CA, project=sub.project)
    if sub.status != SubmittalStatus.REVISE_RESUBMIT and sub.status != SubmittalStatus.REJECTED:
        raise ConflictError("not_returned", "Only a returned submittal can be resubmitted.")
    before = snapshot(sub, SUBMITTAL_FIELDS)
    sub.file = common.upload_files(actor, [file_upload])[0]
    sub.round += 1
    sub.status, sub.review_comment, sub.stamped_file = SubmittalStatus.PENDING, "", None
    sub.reviewed_at = sub.reviewed_by = None
    sub.save()
    record_change(
        sub,
        actor=actor,
        verb="submittal.resubmitted",
        before=before,
        after=snapshot(sub, SUBMITTAL_FIELDS),
    )
    _emit("submittal", sub, "created")
    return sub


# --- F-32 site visit reports ----------------------------------------------------------------


@transaction.atomic
def create_report(
    actor: User,
    project: Project,
    *,
    visit_date: date,
    attendees: str = "",
    weather: str = "",
    summary: str = "",
) -> SiteReport:
    require(actor, Action.FILE_SITE_REPORT, project=project)
    project = common.lock_project(project)
    seq, number = common.next_number(project, SiteReport, "SVR")
    report = SiteReport.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=number,
        visit_date=visit_date,
        attendees=attendees,
        weather=weather,
        summary=summary,
        created_by=actor,
    )
    record_change(
        report,
        actor=actor,
        verb="site_report.created",
        before=None,
        after=snapshot(report, ("visit_date", "state")),
    )
    return report


def _editable(actor: User, report: SiteReport) -> None:
    require(actor, Action.FILE_SITE_REPORT, project=report.project)
    if report.state == ReportState.FILED:
        raise ConflictError("filed", f"{report.number} is filed and cannot be changed.")


@transaction.atomic
def update_report(actor: User, report: SiteReport, **data: Any) -> SiteReport:
    report = (
        SiteReport.objects.select_for_update(of=("self",))
        .select_related("project")
        .get(pk=report.pk)
    )
    _editable(actor, report)
    for k in ("visit_date", "attendees", "weather", "summary"):
        if k in data:
            setattr(report, k, data[k])
    report.save()
    return report


@transaction.atomic
def add_observation(
    actor: User,
    report: SiteReport,
    *,
    text: str,
    sheet: Sheet | None = None,
    action: str = "",
    action_owner: str = "",
    photo_ids: list[Any] | None = None,
) -> SiteObservation:
    report = (
        SiteReport.objects.select_for_update(of=("self",))
        .select_related("project")
        .get(pk=report.pk)
    )
    _editable(actor, report)
    if not text.strip():
        raise DomainError("text_required", "Describe what you saw.")
    if sheet is not None:
        _sheets(report.project, [sheet])
    if len(photo_ids or []) > 12:
        raise DomainError("too_many_photos", "Add at most 12 photos to one observation.")
    seq = report.observations.count() + 1
    obs = SiteObservation.objects.create(
        report=report, seq=seq, text=text, sheet=sheet, action=action, action_owner=action_owner
    )
    obs.photos.set([common.store_photo(actor, pid) for pid in photo_ids or []])
    return obs


@transaction.atomic
def remove_observation(actor: User, obs: SiteObservation) -> None:
    _editable(actor, obs.report)
    obs.delete()


@transaction.atomic
def file_report(actor: User, report: SiteReport) -> SiteReport:
    """File (lock) the report and render its PDF (F-32: 'report exports to PDF')."""
    from .report_pdf import render_report

    report = (
        SiteReport.objects.select_for_update(of=("self",))
        .select_related("project__organisation")
        .get(pk=report.pk)
    )
    _editable(actor, report)
    if not report.observations.exists():
        raise DomainError("empty_report", "Add at least one observation before filing.")
    report.state, report.filed_at = ReportState.FILED, timezone.now()
    pdf = render_report(report, actor)
    report.pdf = common.store_generated(
        report.organisation_id, pdf, f"{report.number}.pdf", "site-reports"
    )
    report.save()
    record_change(
        report,
        actor=actor,
        verb="site_report.filed",
        before={"state": ReportState.DRAFT},
        after={"state": ReportState.FILED},
    )
    _emit("site_report", report, "filed")
    return report


# --- F-33 change orders ---------------------------------------------------------------------


@transaction.atomic
def create_change_order(
    actor: User,
    project: Project,
    *,
    title: str,
    description: str,
    origin: str,
    rfi: Rfi | None = None,
    cost_impact: Decimal | None = None,
    schedule_impact_days: int | None = None,
    sheets: list[Sheet] | None = None,
) -> ChangeOrder:
    require(actor, Action.MANAGE_CA, project=project)
    if rfi is not None and rfi.project_id != project.pk:
        raise DomainError("invalid_rfi", "That RFI belongs to another project.")
    sheets = _sheets(project, sheets)
    project = common.lock_project(project)
    seq, number = common.next_number(project, ChangeOrder, "CO")
    co = ChangeOrder.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=number,
        title=title.strip(),
        description=description,
        origin=origin,
        rfi=rfi,
        cost_impact=cost_impact,
        schedule_impact_days=schedule_impact_days,
        created_by=actor,
    )
    co.sheets.set(sheets)
    record_change(
        co, actor=actor, verb="change_order.created", before=None, after=snapshot(co, CO_FIELDS)
    )
    _emit("change_order", co, "created")
    return co


@transaction.atomic
def decide_change_order(actor: User, co: ChangeOrder, approve: bool, note: str = "") -> ChangeOrder:
    co = ChangeOrder.objects.select_for_update(of=("self",)).select_related("project").get(pk=co.pk)
    require(actor, Action.APPROVE_CHANGE_ORDER, project=co.project)
    if co.status != ChangeStatus.PROPOSED:
        raise ConflictError("decided", f"{co.number} is already {co.get_status_display().lower()}.")
    if not approve and not note.strip():
        raise DomainError("reason_required", "Say why the change is rejected.")
    before = snapshot(co, CO_FIELDS)
    co.status = ChangeStatus.APPROVED if approve else ChangeStatus.REJECTED
    co.decided_at, co.decided_by, co.decision_note = timezone.now(), actor, note
    co.save()
    record_change(
        co, actor=actor, verb="change_order.decided", before=before, after=snapshot(co, CO_FIELDS)
    )
    _emit("change_order", co, "changed")
    return co


@transaction.atomic
def start_revision_cycle(actor: User, co: ChangeOrder) -> dict[str, Any]:
    """F-33: 'a change order can create a new sheet revision cycle'."""
    co = ChangeOrder.objects.select_for_update(of=("self",)).select_related("project").get(pk=co.pk)
    require(actor, Action.MANAGE_CA, project=co.project)
    if co.status != ChangeStatus.APPROVED:
        raise ConflictError("not_approved", "Approve the change order first.")
    started, skipped = common.start_revisions(actor, list(co.sheets.all()))
    co.revision_cycle_started = True
    co.status = ChangeStatus.IMPLEMENTED
    co.save()
    record_change(
        co,
        actor=actor,
        verb="change_order.implemented",
        before=None,
        after={"revisions_started": started},
    )
    return {"change_order": co, "revisions_started": started, "skipped": skipped}

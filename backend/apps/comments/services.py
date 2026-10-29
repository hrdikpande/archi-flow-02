"""Client comment log (F-24), stage approvals (F-26). Status: new → assigned → responded →
closed, or rejected with a reason; a response is required to close (03 §12)."""

from datetime import date
from typing import Any

from django.db import transaction
from django.db.models import Max, QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, PermissionDeniedError, can, require
from apps.audit.services import record_change, snapshot
from apps.core.exceptions import ConflictError, DomainError
from apps.files.models import FileObject, UploadKind
from apps.files.services import ready_upload
from apps.outbox.services import emit
from apps.projects.models import Project, ProjectMembership, Stage, StageState
from apps.register.models import Sheet

from .models import ClientApproval, ClientComment, CommentStatus

FIELDS = ("status", "assignee", "response", "reject_reason", "source", "received_on", "body")
ATTACHMENT_KINDS = (UploadKind.DOCUMENT, UploadKind.SHEET, UploadKind.IMAGE)


def visible_comments(user: User, project: Project) -> QuerySet[ClientComment]:
    require(user, Action.VIEW_PROJECT, project=project)
    return (
        ClientComment.objects.filter(project=project)
        .select_related("assignee", "from_contact", "stage", "responded_by", "logged_by")
        .prefetch_related("sheets", "attachments")
    )


def _check_refs(
    project: Project, sheets: list[Sheet], stage: Stage | None, assignee: User | None
) -> None:
    if any(s.project_id != project.pk for s in sheets):
        raise DomainError("invalid_sheet", "A linked sheet belongs to another project.")
    if stage is not None and stage.project_id != project.pk:
        raise DomainError("invalid_stage", "That stage belongs to another project.")
    if (
        assignee is not None
        and not ProjectMembership.objects.filter(project=project, user=assignee).exists()
    ):
        raise DomainError("not_member", f"{assignee} is not on this project's team.")


def _emit(comment: ClientComment, what: str) -> None:
    emit(
        f"comment.{what}",
        {
            "comment_id": str(comment.pk),
            "project_id": str(comment.project_id),
            "assignee_id": str(comment.assignee_id) if comment.assignee_id else None,
        },
        organisation_id=comment.organisation_id,
    )


@transaction.atomic
def log_comment(
    actor: User | None,
    project: Project,
    *,
    source: str,
    received_on: date,
    body: str,
    from_name: str = "",
    from_contact: Any = None,
    subject: str = "",
    sheets: list[Sheet] | None = None,
    stage: Stage | None = None,
    assignee: User | None = None,
    attachments: list[FileObject] | None = None,
) -> ClientComment:
    """Manual log by PL/DL/DC (actor) or email capture (actor None: the system)."""
    if actor is not None:
        require(actor, Action.LOG_CLIENT_COMMENTS, project=project)
    if not body.strip():
        raise DomainError("body_required", "Write what the client said.")
    sheets = sheets or []
    _check_refs(project, sheets, stage, assignee)
    project = Project.objects.select_for_update().get(pk=project.pk)
    seq = (ClientComment.objects.filter(project=project).aggregate(m=Max("seq"))["m"] or 0) + 1
    comment = ClientComment.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=f"{project.code}-CC-{seq:04d}",
        source=source,
        received_on=received_on,
        from_name=from_name,
        from_contact=from_contact,
        subject=subject[:300],
        body=body,
        stage=stage,
        assignee=assignee,
        logged_by=actor,
        status=CommentStatus.ASSIGNED if assignee else CommentStatus.NEW,
    )
    comment.sheets.set(sheets)
    if attachments:
        comment.attachments.set(attachments)
    record_change(
        comment, actor=actor, verb="comment.created", before=None, after=snapshot(comment, FIELDS)
    )
    _emit(comment, "created")
    return comment


def can_work_on(actor: User, comment: ClientComment) -> bool:
    return comment.assignee_id == actor.pk or can(
        actor, Action.LOG_CLIENT_COMMENTS, project=comment.project
    )


@transaction.atomic
def update_comment(actor: User, comment: ClientComment, **data: Any) -> ClientComment:
    """Assign, edit links, respond, close or reject."""
    comment = (
        ClientComment.objects.select_for_update(of=("self",))
        .select_related("project")
        .get(pk=comment.pk)
    )
    if not can_work_on(actor, comment):
        raise PermissionDeniedError(Action.LOG_CLIENT_COMMENTS)
    before = snapshot(comment, FIELDS)
    action = data.pop("action", None)
    sheets = data.pop("sheets", None)
    assignee = data.pop("assignee", comment.assignee) if "assignee" in data else comment.assignee
    _check_refs(comment.project, sheets or [], data.get("stage"), assignee)
    for k in ("source", "received_on", "body", "stage", "subject"):
        if k in data:
            setattr(comment, k, data[k])
    if sheets is not None:
        comment.sheets.set(sheets)
    newly_assigned = assignee is not None and assignee.pk != comment.assignee_id
    comment.assignee = assignee
    if newly_assigned and comment.status == CommentStatus.NEW:
        comment.status = CommentStatus.ASSIGNED
    if "response" in data:
        comment.response = data["response"]
    if action == "respond":
        if not comment.response.strip():
            raise DomainError("response_required", "Write the response first.")
        comment.status = CommentStatus.RESPONDED
        comment.responded_at, comment.responded_by = timezone.now(), actor
    elif action == "close":
        if not comment.response.strip():
            raise DomainError("response_required", "A comment can be closed only with a response.")
        if not comment.responded_at:
            comment.responded_at, comment.responded_by = timezone.now(), actor
        comment.status, comment.closed_at = CommentStatus.CLOSED, timezone.now()
    elif action == "reject":
        reason = (data.get("reject_reason") or "").strip()
        if not reason:
            raise DomainError("reason_required", "Say why the comment is rejected.")
        comment.status, comment.reject_reason, comment.closed_at = (
            CommentStatus.REJECTED,
            reason,
            timezone.now(),
        )
    elif action == "reopen":
        if comment.status not in (
            CommentStatus.CLOSED,
            CommentStatus.REJECTED,
            CommentStatus.RESPONDED,
        ):
            raise ConflictError(
                "not_closed", "Only a responded, closed or rejected comment can be reopened."
            )
        comment.status = CommentStatus.ASSIGNED if comment.assignee_id else CommentStatus.NEW
        comment.closed_at = None
    elif action is not None:
        raise DomainError("invalid_action", f"Unknown action “{action}”.")
    comment.save()
    record_change(
        comment,
        actor=actor,
        verb=f"comment.{action or 'updated'}",
        before=before,
        after=snapshot(comment, FIELDS),
    )
    _emit(comment, "assigned" if newly_assigned else "changed")
    return comment


def attach(actor: User, comment: ClientComment, upload_ids: list[Any]) -> ClientComment:
    if not can_work_on(actor, comment):
        raise PermissionDeniedError(Action.LOG_CLIENT_COMMENTS)
    files = [ready_upload(actor, u, ATTACHMENT_KINDS).file for u in upload_ids]
    comment.attachments.add(*[f for f in files if f])
    return comment


# --- F-26 client approval per stage -------------------------------------------------------


@transaction.atomic
def record_approval(
    actor: User,
    stage: Stage,
    *,
    approved_by: str,
    approved_on: date,
    evidence_upload: Any,
    approved_contact: Any = None,
    note: str = "",
) -> ClientApproval:
    """Moves a stage whose deliverables are issued to client_approved (and so on to A-09)."""
    from apps.projects.services import system_transition_stage

    stage = Stage.objects.select_related("project").get(pk=stage.pk)
    require(actor, Action.RECORD_CLIENT_APPROVAL, project=stage.project)
    if stage.state not in (StageState.ACTIVE, StageState.DELIVERABLES_ISSUED):
        raise ConflictError(
            "stage_state",
            f"{stage.name} is {stage.get_state_display().lower()}; record approval on an "
            "active stage or one whose deliverables are issued.",
        )
    if not approved_by.strip():
        raise DomainError("approved_by_required", "Who approved it on the client side?")
    evidence = ready_upload(actor, evidence_upload, ATTACHMENT_KINDS).file
    if evidence is None:
        raise DomainError("evidence_required", "Attach the approval letter or email.")
    approval = ClientApproval.objects.create(
        organisation_id=stage.organisation_id,
        stage=stage,
        approved_by=approved_by.strip(),
        approved_contact=approved_contact,
        approved_on=approved_on,
        evidence=evidence,
        note=note,
        recorded_by=actor,
    )
    record_change(
        approval,
        actor=actor,
        verb="client_approval.recorded",
        before=None,
        after=snapshot(approval, ("approved_by", "approved_on", "evidence", "note")),
    )
    if stage.state == StageState.DELIVERABLES_ISSUED:
        system_transition_stage(stage, "client_approved")
    emit(
        "client_approval.recorded",
        {"stage_id": str(stage.pk), "project_id": str(stage.project_id)},
        organisation_id=stage.organisation_id,
    )
    return approval

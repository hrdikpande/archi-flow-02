"""Sheet transitions and reviews (F-10, F-11). The only code that writes Sheet.state."""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.services import record
from apps.core.context import get_context
from apps.core.exceptions import ConflictError
from apps.files.models import FileObject, UploadKind
from apps.outbox.services import emit
from apps.projects.models import ProjectMembership
from apps.register.models import RevisionState, Sheet, SheetRevision, SheetState

from .models import Review, ReviewKind, ReviewState, StatusTransition
from .state_machine import PREVIOUS, REMEMBERS_PREVIOUS, TRANSITIONS, Actor, Context, Transition

PROJECT_ACTORS = {
    ProjectRole.PL: Actor.PL,
    ProjectRole.DL: Actor.DL,
    ProjectRole.DC: Actor.DC,
    ProjectRole.SENIOR_REVIEWER: Actor.SENIOR,
}


class TransitionNotAllowedError(ConflictError):
    def __init__(self, detail: str, allowed: list[str]) -> None:
        super().__init__("transition_not_allowed", detail, allowed_actions=allowed)


def actors_for(user: User, sheet: Sheet) -> set[Actor]:
    """Who the user is relative to this sheet."""
    if not user.is_active or user.organisation_id != sheet.organisation_id:
        return set()
    actors: set[Actor] = set()
    if user.org_role == OrgRole.ADMIN:
        actors.add(Actor.ADMIN)
    role = (
        ProjectMembership.objects.filter(project_id=sheet.project_id, user=user)
        .values_list("role", flat=True)
        .first()
    )
    if role is None:
        return actors
    if role in PROJECT_ACTORS:
        actors.add(PROJECT_ACTORS[ProjectRole(role)])
    if sheet.owner_id == user.pk:
        actors.add(Actor.OWNER)
    if sheet.checker_id == user.pk:
        actors.add(Actor.CHECKER)
    elif sheet.checker_id and sheet.state in CHECKER_STATES:
        from .delegation import is_acting_for

        if is_acting_for(user, sheet.checker_id, sheet.project_id):
            actors.add(Actor.CHECKER)  # F-12: today's delegate acts as the checker
    return actors


CHECKER_STATES = (SheetState.READY_FOR_CHECK, SheetState.IN_CHECK)


def _primary_role(t: Transition, actors: set[Actor]) -> str:
    for preferred in (
        Actor.OWNER,
        Actor.CHECKER,
        Actor.SENIOR,
        Actor.DC,
        Actor.DL,
        Actor.PL,
        Actor.ADMIN,
    ):
        if preferred in actors and preferred in t.actors:
            return preferred.value
    return ""


def senior_qc_required(sheet: Sheet) -> bool:
    return bool(sheet.stage.requires_senior_qc)


def _open_review(sheet: Sheet, kind: str) -> Review | None:
    return sheet.reviews.filter(kind=kind, state=ReviewState.OPEN, round=sheet.review_round).first()


def _senior_qc_done(sheet: Sheet) -> bool:
    return sheet.reviews.filter(
        kind=ReviewKind.SENIOR_QC, state=ReviewState.APPROVED, round=sheet.review_round
    ).exists()


def draft_revision(sheet: Sheet) -> SheetRevision | None:
    return sheet.revisions.filter(state=RevisionState.DRAFT).first()


def issue_blocker(sheet: Sheet) -> str | None:
    """Why 'Issue' is blocked (shown on the ActionBar, DESIGN.md §4)."""
    draft = draft_revision(sheet)
    if draft is None or draft.file_id is None:
        return "Upload PDF first."
    if draft.naming_status == "pending":
        return "The PDF name is still being checked."
    if draft.naming_status == "blocked":
        return draft.naming_message or "The PDF name breaks the naming rule."
    return None


@dataclass
class AllowedAction:
    action: str
    label: str
    primary: bool
    needs_reason: bool
    hint: str
    blocked_reason: str | None = None


def allowed_actions(sheet: Sheet, user: User) -> list[AllowedAction]:
    """The actions this user may take now (returned with every sheet: `allowed_actions`)."""
    actors = actors_for(user, sheet)
    result: list[AllowedAction] = []
    for t in sorted(TRANSITIONS.values(), key=lambda x: x.order):
        if sheet.state not in t.sources or not (actors & t.actors):
            continue
        if t.action in ("start_check", "approve") and sheet.owner_id == user.pk:
            continue
        if t.action == "withdraw" and Actor.OWNER not in actors and Actor.PL not in actors:
            continue
        blocked = None
        if t.action == "issue":
            blocked = issue_blocker(sheet)
        if t.action == "submit" and not sheet.checker_id:
            blocked = "Assign a checker first."
        if t.action == "approve" and sheet.state == SheetState.IN_CHECK:
            senior_open = _open_review(sheet, ReviewKind.SENIOR_QC)
            if senior_open and Actor.SENIOR not in actors:
                blocked = "Waiting for senior QC."
        needs_reason = t.needs_reason or (t.action == "withdraw" and Actor.OWNER not in actors)
        result.append(AllowedAction(t.action, t.label, t.primary, needs_reason, t.hint, blocked))
    return result


def _transition_error(sheet: Sheet, user: User, detail: str) -> TransitionNotAllowedError:
    allowed = [a.action for a in allowed_actions(sheet, user) if a.blocked_reason is None]
    return TransitionNotAllowedError(detail, allowed)


def _set_state(sheet: Sheet, t: Transition, target: str) -> None:
    if t.action in REMEMBERS_PREVIOUS:
        sheet.state_before_hold = sheet.state
    elif target == PREVIOUS:
        target = sheet.state_before_hold or SheetState.PLANNED
        sheet.state_before_hold = ""
    sheet.state = target
    sheet.state_changed_at = timezone.now()


def _redline_files(actor: User, upload_ids: Iterable[Any]) -> list[FileObject]:
    """Redlines are PDFs (any pages) or images (F-11)."""
    from apps.files.services import ready_upload

    kinds = (UploadKind.DOCUMENT, UploadKind.SHEET, UploadKind.IMAGE)
    return [f for f in (ready_upload(actor, uid, kinds).file for uid in upload_ids) if f]


@transaction.atomic
def transition(
    sheet: Sheet,
    action: str,
    actor: User,
    *,
    reason: str = "",
    comment: str = "",
    redline_upload_ids: Iterable[Any] = (),
    checklist: Iterable[int] | None = None,
    system: bool = False,
) -> Sheet:
    """Lock, check role and guards, change state, record history and audit, emit an event."""
    sheet = (
        Sheet.objects.select_for_update(of=("self",))
        .select_related("stage", "project")
        .get(pk=sheet.pk)
    )
    t = TRANSITIONS.get(action)
    if t is None:
        raise _transition_error(sheet, actor, f"Unknown action “{action}”.")
    if sheet.state not in t.sources:
        raise _transition_error(
            sheet,
            actor,
            f"{sheet.number} is {sheet.get_state_display().lower()}; “{t.label}” is not possible.",
        )
    if t.system_only and not system:
        raise _transition_error(sheet, actor, "Issue sheets from the issue and transmittal screen.")
    actors = actors_for(actor, sheet)
    if not (actors & t.actors):
        raise _transition_error(sheet, actor, f"You can't “{t.label}” {sheet.number}.")
    redlines = _redline_files(actor, redline_upload_ids)
    ctx = Context(reason=reason, comment=comment, redline_count=len(redlines))
    for guard in t.guards:
        if problem := guard(sheet, actor, ctx):
            raise _transition_error(sheet, actor, problem)
    forced = t.action == "withdraw" and Actor.OWNER not in actors
    if (t.needs_reason or forced) and not reason.strip():
        raise _transition_error(sheet, actor, f"Give a reason to “{t.label}”.")

    from_state = sheet.state
    target = t.target
    notes: dict[str, Any] = {}

    if t.action == "approve":
        target = _approve(sheet, actor, actors, comment, redlines, notes)
    elif t.action == "return":
        _close_reviews(sheet, actor, ReviewState.RETURNED, comment, redlines)
    elif t.action == "start_check":
        Review.objects.create(
            organisation_id=sheet.organisation_id,
            sheet=sheet,
            kind=ReviewKind.CHECK,
            round=sheet.review_round,
            reviewer=actor,
            revision=draft_revision(sheet),
        )
    elif t.action == "submit":
        from . import checklists

        ticked = {int(i) for i in (checklist or [])}
        if missing := checklists.missing_mandatory(sheet, ticked):
            raise _transition_error(
                sheet, actor, "Tick every mandatory pre-check item first: " + "; ".join(missing)
            )
        sheet.review_round += 1
        checklists.store_response(sheet, actor, ticked)
    elif t.action in ("reopen", "withdraw"):
        sheet.reviews.filter(state=ReviewState.OPEN).update(
            state=ReviewState.RETURNED,
            closed_at=timezone.now(),
            comment="Closed: the sheet went back to work.",
        )
    elif t.action == "next_revision":
        from apps.register.revisions import create_empty_draft

        create_empty_draft(sheet, actor)

    if target != from_state:
        _set_state(sheet, t, target)
    sheet.save()
    _record(sheet, t, from_state, actor, actors, reason or comment)
    notes.update(reason=reason, comment=comment)
    emit(
        "sheet.state_changed",
        {
            "sheet_id": str(sheet.pk),
            "project_id": str(sheet.project_id),
            "action": t.action,
            "from": from_state,
            "to": sheet.state,
            "actor_id": str(actor.pk),
            **{k: v for k, v in notes.items() if v},
        },
        organisation_id=sheet.organisation_id,
    )
    return sheet


def _approve(
    sheet: Sheet,
    actor: User,
    actors: set[Actor],
    comment: str,
    redlines: list[FileObject],
    notes: dict[str, Any],
) -> str:
    """Approve; on a stage that needs senior QC the first approval opens the second step
    and the sheet stays in check until the senior reviewer approves (03 §7)."""
    senior_open = _open_review(sheet, ReviewKind.SENIOR_QC)
    if senior_open is not None:
        if Actor.SENIOR not in actors and Actor.PL not in actors:
            raise _transition_error(sheet, actor, "Waiting for senior QC.")
        _close(senior_open, actor, ReviewState.APPROVED, comment, redlines)
        return TRANSITIONS["approve"].target
    _close_reviews(sheet, actor, ReviewState.APPROVED, comment, redlines, kind=ReviewKind.CHECK)
    if senior_qc_required(sheet) and not _senior_qc_done(sheet):
        seniors = list(
            ProjectMembership.objects.filter(
                project_id=sheet.project_id, role=ProjectRole.SENIOR_REVIEWER
            ).values_list("user_id", flat=True)
        )
        review = Review.objects.create(
            organisation_id=sheet.organisation_id,
            sheet=sheet,
            kind=ReviewKind.SENIOR_QC,
            round=sheet.review_round,
            revision=draft_revision(sheet),
            reviewer_id=seniors[0] if len(seniors) == 1 else None,
        )
        notes["senior_qc_review_id"] = str(review.pk)
        notes["senior_qc_needed"] = True
        return sheet.state  # stays in check
    return TRANSITIONS["approve"].target


def _close(
    review: Review, actor: User, state: str, comment: str, redlines: list[FileObject]
) -> None:
    review.state = state
    review.closed_at = timezone.now()
    if review.reviewer_id is None:
        review.reviewer = actor
    if comment:
        review.comment = comment
    review.save()
    if redlines:
        review.redlines.add(*redlines)


def _close_reviews(
    sheet: Sheet,
    actor: User,
    state: str,
    comment: str,
    redlines: list[FileObject],
    kind: str | None = None,
) -> None:
    open_reviews = sheet.reviews.filter(state=ReviewState.OPEN, round=sheet.review_round)
    if kind:
        open_reviews = open_reviews.filter(kind=kind)
    reviews = list(open_reviews)
    if not reviews:
        reviews = [
            Review.objects.create(
                organisation_id=sheet.organisation_id,
                sheet=sheet,
                kind=kind or ReviewKind.CHECK,
                round=sheet.review_round,
                reviewer=actor,
                revision=draft_revision(sheet),
            )
        ]
    for review in reviews:
        _close(review, actor, state, comment, redlines)


def _record(
    sheet: Sheet,
    t: Transition,
    from_state: str,
    actor: User | None,
    actors: set[Actor],
    reason: str,
) -> None:
    StatusTransition.objects.create(
        organisation_id=sheet.organisation_id,
        sheet=sheet,
        action=t.action,
        from_state=from_state,
        to_state=sheet.state,
        actor=actor,
        role=_primary_role(t, actors),
        reason=reason[:2000],
        request_id=get_context().request_id,
    )
    record(
        organisation_id=sheet.organisation_id,
        actor=actor,
        verb=f"sheet.{t.action}",
        entity_type="register.sheet",
        entity_id=sheet.pk,
        entity_label=str(sheet),
        before={"state": from_state},
        after={"state": sheet.state, "reason": reason} if reason else {"state": sheet.state},
        project_id=sheet.project_id,
        discipline_id=sheet.discipline_id,
    )


def record_system_transition(
    sheet: Sheet, action: str, from_state: str, actor: User, reason: str = ""
) -> None:
    """Used by the transmittal issue service, which owns the issue transaction."""
    t = TRANSITIONS[action]
    _record(sheet, t, from_state, actor, actors_for(actor, sheet), reason)


@transaction.atomic
def add_redlines(review: Review, actor: User, upload_ids: Iterable[Any]) -> Review:
    if review.state != ReviewState.OPEN:
        raise ConflictError("review_closed", "This review is closed.")
    actors = actors_for(actor, review.sheet)
    if not actors & {Actor.CHECKER, Actor.SENIOR, Actor.PL} and review.reviewer_id != actor.pk:
        raise ConflictError("not_reviewer", "Only the reviewer can add redlines.")
    files = _redline_files(actor, upload_ids)
    review.redlines.add(*files)
    record(
        organisation_id=review.organisation_id,
        actor=actor,
        verb="review.redlines_added",
        entity_type="workflow.review",
        entity_id=review.pk,
        entity_label=str(review.sheet),
        after={"files": [str(f.pk) for f in files]},
        project_id=review.sheet.project_id,
        discipline_id=review.sheet.discipline_id,
    )
    return review

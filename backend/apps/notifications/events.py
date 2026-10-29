"""Workflow and team events → notifications (03 §18). Dedupe keys make re-dispatch safe."""

from typing import Any

from apps.accounts.models import User
from apps.accounts.roles import ProjectRole
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles
from apps.projects.models import Project
from apps.projects.people import members_with_role
from apps.register.models import Sheet

from .services import notify, notify_many


def _sheet(sheet_id: str) -> "Sheet | None":
    return Sheet.objects.select_related("project", "owner", "checker").filter(pk=sheet_id).first()


def _link(sheet: "Sheet") -> str:
    return f"/projects/{sheet.project_id}/sheets/{sheet.pk}"


@handles("sheet.assigned")
def sheet_assigned(event: OutboxEvent) -> None:
    sheet = _sheet(event.payload["sheet_id"])
    user = User.objects.filter(pk=event.payload["user_id"]).first()
    if sheet and user:
        notify(
            user,
            "sheet_assigned",
            title=f"{sheet.number} {sheet.title} is assigned to you",
            link=_link(sheet),
            project=sheet.project,
            entity=sheet,
            dedupe_key=f"assigned:{event.pk}",
        )


@handles("sheet.state_changed")
def sheet_moved(event: OutboxEvent) -> None:
    p = event.payload
    sheet = _sheet(p["sheet_id"])
    if sheet is None:
        return
    action, key = p.get("action"), f"moved:{event.pk}"
    common: dict[str, Any] = {
        "link": _link(sheet),
        "project": sheet.project,
        "entity": sheet,
        "dedupe_key": key,
    }
    if action == "submit" and sheet.checker:
        notify(
            sheet.checker,
            "review_requested",
            title=f"{sheet.number} is ready for your check",
            body=sheet.title,
            **common,
        )
    elif action == "return" and sheet.owner:
        notify(
            sheet.owner,
            "sheet_returned",
            title=f"{sheet.number} was returned with redlines",
            body=p.get("comment", ""),
            **common,
        )
    elif action == "approve" and p.get("senior_qc_needed"):
        from apps.workflow.models import Review

        review = Review.objects.filter(pk=p.get("senior_qc_review_id")).first()
        seniors = (
            [review.reviewer]
            if review and review.reviewer
            else members_with_role(sheet.project_id, ProjectRole.SENIOR_REVIEWER)
        )
        notify_many(
            seniors,
            "senior_qc_needed",
            title=f"Senior QC needed on {sheet.number}",
            body=sheet.title,
            **common,
        )
    elif action == "approve" and p.get("to") == "approved_for_issue":
        audience = [sheet.owner, *members_with_role(sheet.project_id, ProjectRole.DC)]
        notify_many(
            audience,
            "sheet_approved",
            title=f"{sheet.number} is approved for issue",
            body=sheet.title,
            **common,
        )


@handles("project.member_added")
def member_added(event: OutboxEvent) -> None:
    project = Project.objects.filter(pk=event.payload["project_id"]).first()
    user = User.objects.filter(pk=event.payload["user_id"]).first()
    if project and user:
        notify(
            user,
            "project_member_added",
            title=f"You were added to {project.code} {project.name}",
            link=f"/projects/{project.pk}",
            project=project,
            entity=project,
            dedupe_key=f"member:{event.pk}",
        )


@handles("revision.naming_blocked")
def naming_blocked(event: OutboxEvent) -> None:
    from apps.register.models import SheetRevision

    revision = (
        SheetRevision.objects.select_related("sheet__project")
        .filter(pk=event.payload["revision_id"])
        .first()
    )
    uid = event.payload.get("user_id")
    user = User.objects.filter(pk=uid).first() if uid else None
    if revision and user:
        notify(
            user,
            "naming_blocked",
            title=f"{revision.sheet.number}: the PDF name breaks a rule",
            body=event.payload.get("message", ""),
            link=_link(revision.sheet),
            project=revision.sheet.project,
            entity=revision.sheet,
            dedupe_key=f"naming:{event.pk}",
        )

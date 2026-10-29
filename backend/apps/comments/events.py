"""Comment notifications and flags (02 §7), and approvals that wait for deliverables (F-26)."""

from apps.automation.engine import refresh_flags
from apps.core.models import Organisation
from apps.notifications.services import notify
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

from .models import ClientApproval, ClientComment


@handles("comment.assigned")
def tell_assignee(event: OutboxEvent) -> None:
    c = (
        ClientComment.objects.select_related("assignee", "project")
        .filter(pk=event.payload["comment_id"])
        .first()
    )
    if c is None or c.assignee is None:
        return
    notify(
        c.assignee,
        "comment_assigned",
        title=f"Client comment {c.number} assigned to you",
        body=(c.subject or c.body)[:200],
        link=f"/projects/{c.project_id}/comments?open={c.pk}",
        project=c.project,
        dedupe_key=f"comment-assigned:{c.pk}:{c.assignee_id}",
    )


@handles("comment.created")
@handles("comment.changed")
@handles("comment.assigned")
def refresh_overdue(event: OutboxEvent) -> None:
    if event.organisation_id:
        refresh_flags(
            Organisation.objects.get(pk=event.organisation_id),
            ("A-08",),
            [event.payload["comment_id"]],
        )


@handles("stage.state_changed")
def approval_waiting_for_deliverables(event: OutboxEvent) -> None:
    """Approval recorded while the stage was active: when its deliverables are issued, the
    stage moves straight on to client_approved."""
    from apps.projects.models import Stage, StageState
    from apps.projects.services import system_transition_stage

    if event.payload.get("to") != StageState.DELIVERABLES_ISSUED:
        return
    stage = Stage.objects.filter(pk=event.payload["stage_id"]).first()
    if stage is not None and ClientApproval.objects.filter(stage=stage).exists():
        system_transition_stage(stage, "client_approved")

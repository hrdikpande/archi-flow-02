"""Assignment notices and A-10 refresh when an RFI changes (02 §7)."""

from apps.automation.engine import refresh_flags
from apps.core.models import Organisation
from apps.notifications.services import notify
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

from .models import Rfi, Submittal


@handles("rfi.created")
@handles("rfi.changed")
def rfi_changed(event: OutboxEvent) -> None:
    rfi = Rfi.objects.select_related("assignee").filter(pk=event.payload["id"]).first()
    if rfi is None:
        return
    if event.organisation_id:
        refresh_flags(Organisation.objects.get(pk=event.organisation_id), ("A-10",), [str(rfi.pk)])
    if rfi.assignee and rfi.status == "open":
        notify(
            rfi.assignee,
            "ca_assigned",
            title=f"{rfi.number} assigned to you: {rfi.subject}"[:200],
            link=f"/projects/{rfi.project_id}/construction/rfis?open={rfi.pk}",
            dedupe_key=f"rfi-assigned:{rfi.pk}:{rfi.assignee_id}",
        )


@handles("submittal.created")
def submittal_waiting(event: OutboxEvent) -> None:
    sub = Submittal.objects.select_related("reviewer").filter(pk=event.payload["id"]).first()
    if sub is None or sub.reviewer is None:
        return
    notify(
        sub.reviewer,
        "ca_assigned",
        title=f"{sub.number} round {sub.round} waiting for your review",
        body=sub.title,
        link=f"/projects/{sub.project_id}/construction/submittals?open={sub.pk}",
        dedupe_key=f"submittal-review:{sub.pk}:{sub.round}",
    )

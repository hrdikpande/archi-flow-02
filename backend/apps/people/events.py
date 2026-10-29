"""S5 exit: person-week flags recompute on allocation, capacity and timesheet events."""

from apps.automation.engine import RULES, apply, context
from apps.core.models import Organisation
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles


def _recompute(event: OutboxEvent, key: str, *, raise_new: bool) -> None:
    """A-05 raises straight away (the S5 exit criterion: 'flags recompute on events'); A-06
    only clears on submit, since its reminders belong to the Monday sweep."""
    if not event.organisation_id:
        return
    organisation = Organisation.objects.get(pk=event.organisation_id)
    ctx = context(organisation, key)
    if ctx is not None and key in RULES:
        apply(RULES[key], ctx, only=[event.payload["user_id"]], raise_new=raise_new)


@handles("allocation.changed")
def allocation_changed(event: OutboxEvent) -> None:
    _recompute(event, "A-05", raise_new=True)


@handles("capacity.changed")
def capacity_changed(event: OutboxEvent) -> None:
    _recompute(event, "A-05", raise_new=True)


@handles("timesheet.submitted")
def timesheet_submitted(event: OutboxEvent) -> None:
    _recompute(event, "A-06", raise_new=False)

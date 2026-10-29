"""F-57: check each newly issued revision (if the firm turned drawing checks on)."""

from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

from . import checks


@handles("revision.issued")
def check_issued_revision(event: OutboxEvent) -> None:
    if rid := event.payload.get("revision_id"):
        checks.check_revision(rid)

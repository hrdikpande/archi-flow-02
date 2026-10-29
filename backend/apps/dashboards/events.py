"""02 §7: sheet state changes and sweep results invalidate the dashboard read model. State
changes are debounced to one refresh a minute so a bulk action (e.g. issuing 200 sheets) costs a
single refresh."""

from django.core.cache import cache

from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

DEBOUNCE_KEY = "dashboards:refresh-pending"


@handles("sheet.state_changed")
def sheet_state_changed(event: OutboxEvent) -> None:
    from .tasks import refresh

    if cache.add(DEBOUNCE_KEY, "1", timeout=60):
        refresh.apply_async(countdown=60)


@handles("automation.flags_changed")
def flags_changed(event: OutboxEvent) -> None:
    """A sweep raised or cleared flags: late/at-risk counts change, refresh now (sweeps run at
    most every 15 minutes, so no debounce is needed)."""
    from .tasks import refresh

    refresh.delay()

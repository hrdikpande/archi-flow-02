"""Keep sheet flags current between sweeps: clear or refresh when the facts change."""

from apps.core.models import Organisation
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

from . import rules  # noqa: F401  (registers A-01, A-02)
from .engine import refresh_flags

SHEET_RULES = ("A-01", "A-02", "A-07")


def _refresh(event: OutboxEvent, sheet_ids: list[str]) -> None:
    if event.organisation_id and sheet_ids:
        refresh_flags(Organisation.objects.get(pk=event.organisation_id), SHEET_RULES, sheet_ids)


@handles("sheet.state_changed")
def sheet_state_changed(event: OutboxEvent) -> None:
    _refresh(event, [event.payload["sheet_id"]])


@handles("sheet.dates_changed")
def sheet_dates_changed(event: OutboxEvent) -> None:
    _refresh(event, [event.payload["sheet_id"]])


@handles("package.date_changed")
def package_date_changed(event: OutboxEvent) -> None:
    from apps.register.models import Sheet

    ids = [
        str(i)
        for i in Sheet.objects.filter(package_id=event.payload["package_id"]).values_list(
            "pk", flat=True
        )
    ]
    _refresh(event, ids)

"""Domain gauges for Prometheus (N-05, T-06): read at scrape time from the database, so alert
rules see the scheduler, sweeps and queues the same way /healthz does."""

from collections.abc import Iterator
from typing import Any

from django.utils import timezone
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import REGISTRY, Collector


class DomainCollector(Collector):
    def describe(self) -> Iterator[Any]:
        """Names only, so registering does not query the database at start-up."""
        yield GaugeMetricFamily("drawingops_beat_heartbeat_age_seconds", "")
        yield GaugeMetricFamily("drawingops_sweeps_missing", "", labels=["rule"])
        yield GaugeMetricFamily("drawingops_outbox_pending", "")
        yield GaugeMetricFamily("drawingops_exports_waiting", "")

    def collect(self) -> Iterator[Any]:
        from apps.automation.engine import missing_daily_runs
        from apps.core.models import Heartbeat, Organisation
        from apps.exports.models import ExportJob, ExportState
        from apps.outbox.models import OutboxEvent

        try:
            beat = Heartbeat.objects.filter(name="beat").first()
            age = GaugeMetricFamily(
                "drawingops_beat_heartbeat_age_seconds", "Seconds since Celery beat last ran"
            )
            age.add_metric([], (timezone.now() - beat.last_seen).total_seconds() if beat else -1)
            yield age
            missing = GaugeMetricFamily(
                "drawingops_sweeps_missing",
                "Daily sweeps not run after 09:00 local time",
                labels=["rule"],
            )
            missed = {k for org in Organisation.objects.all() for k in missing_daily_runs(org)}
            for rule in sorted(missed):
                missing.add_metric([rule], 1)
            yield missing
            pending = GaugeMetricFamily(
                "drawingops_outbox_pending", "Outbox events not yet delivered"
            )
            pending.add_metric([], OutboxEvent.objects.filter(dispatched_at__isnull=True).count())
            yield pending
            exports = GaugeMetricFamily(
                "drawingops_exports_waiting", "Background exports queued or running"
            )
            exports.add_metric(
                [],
                ExportJob.objects.filter(
                    state__in=[ExportState.QUEUED, ExportState.RUNNING]
                ).count(),
            )
            yield exports
        except Exception:  # a scrape must never fail because the database is down
            return


_registered = False


def register() -> None:
    global _registered
    if not _registered:
        REGISTRY.register(DomainCollector())
        _registered = True

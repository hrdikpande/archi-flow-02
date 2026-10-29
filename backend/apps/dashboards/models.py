"""Dashboard read models (02 §4 dashboards/, F-22, F-23, F-53)."""

from django.db import models

from apps.core.models import OrgScopedModel


class SheetStats(models.Model):
    """Materialised view `dash_sheet_stats`: sheet counts per project × discipline, refreshed
    every 5 minutes by beat and soon after sheet state changes (F-22: data ≤ 15 min old)."""

    pk = models.CompositePrimaryKey("project_id", "discipline_id")
    organisation_id = models.UUIDField()
    project_id = models.UUIDField()
    discipline_id = models.UUIDField()
    planned = models.IntegerField()
    issued = models.IntegerField()
    late = models.IntegerField()
    at_risk = models.IntegerField()
    in_check = models.IntegerField()
    refreshed_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "dash_sheet_stats"

    def __str__(self) -> str:
        return f"{self.project_id}/{self.discipline_id}: {self.issued}/{self.planned}"


class MetricSnapshot(OrgScopedModel):
    """Org-wide headline numbers once a day, for the "delta vs last week" on metric cards."""

    date = models.DateField()
    key = models.CharField(max_length=40)
    value = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "metric_snapshot"
        constraints = [
            models.UniqueConstraint(
                fields=["organisation", "date", "key"], name="metric_snapshot_unique"
            )
        ]

    def __str__(self) -> str:
        return f"{self.date} {self.key}={self.value}"

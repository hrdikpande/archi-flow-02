"""M15 intelligence (P4, after gate G3; 02 §17). Everything here is advisory: it never changes a
sheet, an allocation or an issue. Models are retrained weekly and their predictions stored; no
model object is persisted (nothing is ever unpickled)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class FeatureSnapshot(OrgScopedModel):
    """T-09 feature store: an open sheet's features as they were on `as_of` (a Monday)."""

    sheet = models.ForeignKey("register.Sheet", on_delete=models.CASCADE, related_name="+")
    as_of = models.DateField()
    features = models.JSONField()
    planned_date = models.DateField()
    late = models.BooleanField(null=True)  # filled once the planned date has passed

    class Meta:
        db_table = "feature_snapshot"
        constraints = [
            models.UniqueConstraint(fields=["sheet", "as_of"], name="feature_snapshot_once")
        ]
        indexes = [models.Index(fields=["organisation", "as_of"], name="feature_org_asof")]

    def __str__(self) -> str:
        return f"{self.sheet_id} @ {self.as_of}"


class ModelKind(models.TextChoices):
    LATE_RISK = "late_risk", "Late-risk prediction (F-55)"
    WORKLOAD = "workload", "Workload forecast (F-56)"


class RunStatus(models.TextChoices):
    OK = "ok", "Trained"
    SKIPPED = "skipped", "Skipped (gate G3 not met or too little data)"
    FAILED = "failed", "Failed"


class ModelRun(OrgScopedModel):
    kind = models.CharField(max_length=12, choices=ModelKind.choices)
    status = models.CharField(max_length=8, choices=RunStatus.choices)
    gate = models.JSONField(default=dict)  # G3 figures at run time
    metrics = models.JSONField(default=dict)  # back-test results (T-10)
    training_rows = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True)
    forced = models.BooleanField(default=False)  # trained before G3 (evaluation only, never prod)

    class Meta:
        db_table = "model_run"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.kind} {self.status} {self.created_at:%Y-%m-%d}"


class Prediction(OrgScopedModel):
    """F-55: chance an open sheet misses its planned date, with the top reasons."""

    run = models.ForeignKey(ModelRun, on_delete=models.CASCADE, related_name="predictions")
    sheet = models.ForeignKey("register.Sheet", on_delete=models.CASCADE, related_name="+")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    score = models.FloatField()
    reasons = models.JSONField(default=list)

    class Meta:
        db_table = "prediction"
        ordering = ["-score"]
        indexes = [models.Index(fields=["run", "project"], name="prediction_run_project")]

    def __str__(self) -> str:
        return f"{self.sheet_id}: {self.score:.2f}"


class PredictionFeedback(OrgScopedModel):
    """02 §17: 'leads decide; overrides recorded'."""

    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name="feedback")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    agree = models.BooleanField()
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "prediction_feedback"

    def __str__(self) -> str:
        return f"{self.prediction_id} agree={self.agree}"


class WorkloadForecast(OrgScopedModel):
    """F-56: predicted hours per discipline per week for the next 8 weeks."""

    run = models.ForeignKey(ModelRun, on_delete=models.CASCADE, related_name="forecasts")
    discipline = models.ForeignKey("core.Discipline", on_delete=models.CASCADE, related_name="+")
    week = models.DateField()
    hours = models.DecimalField(max_digits=8, decimal_places=1)
    baseline_hours = models.DecimalField(max_digits=8, decimal_places=1)

    class Meta:
        db_table = "workload_forecast"
        ordering = ["discipline__code", "week"]

    def __str__(self) -> str:
        return f"{self.discipline_id} {self.week}: {self.hours}"


class FindingStatus(models.TextChoices):
    OPEN = "open", "Waiting for a reviewer"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected (false alarm)"


class Finding(OrgScopedModel):
    """F-57 rule-based drawing check finding on an issued PDF. Advisory: never blocks an issue."""

    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.CASCADE, related_name="findings"
    )
    sheet = models.ForeignKey("register.Sheet", on_delete=models.CASCADE, related_name="findings")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    rule = models.CharField(max_length=20)
    message = models.CharField(max_length=500)
    status = models.CharField(
        max_length=10, choices=FindingStatus.choices, default=FindingStatus.OPEN
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "finding"
        ordering = ["rule"]
        constraints = [
            models.UniqueConstraint(fields=["revision", "rule", "message"], name="finding_once")
        ]

    def __str__(self) -> str:
        return f"{self.rule}: {self.message}"

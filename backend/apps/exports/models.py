from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class ExportKind(models.TextChoices):
    REGISTER = "register", "Register"
    TRANSMITTAL_LOG = "transmittal_log", "Transmittal log"
    LATE_AT_RISK = "late_at_risk", "Late and at-risk sheets"
    WORKLOAD = "workload", "Workload"
    TIMESHEETS = "timesheets", "Timesheets"
    PROJECT_ARCHIVE = "project_archive", "Full project export (N-06)"


class ExportFormat(models.TextChoices):
    XLSX = "xlsx", "Excel"
    PDF = "pdf", "PDF"
    ZIP = "zip", "Zip (JSON + files)"


class ExportState(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class ExportJob(OrgScopedModel):
    """F-52 (02 §6 `export_job`): one export of a list view with its filters."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=20, choices=ExportKind.choices)
    format = models.CharField(max_length=4, choices=ExportFormat.choices)
    filters = models.JSONField(default=dict)
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    state = models.CharField(max_length=8, choices=ExportState.choices, default=ExportState.QUEUED)
    row_count = models.PositiveIntegerField(default=0)
    file = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    error = models.TextField(blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "export_job"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.kind}.{self.format} ({self.state})"

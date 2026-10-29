"""M11 coordination (P3, F-34 / I-07): clash results imported from BCF 2.1/3.0 (.bcfzip) or a
Navisworks clash report, tracked as issues linked to sheets and disciplines."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class ClashSource(models.TextChoices):
    BCF = "bcf", "BCF"
    NAVISWORKS = "navisworks", "Navisworks report"


class ClashStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In progress"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class ClashImport(OrgScopedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    source = models.CharField(max_length=12, choices=ClashSource.choices)
    original_name = models.CharField(max_length=255)
    file = models.ForeignKey("files.FileObject", on_delete=models.PROTECT, related_name="+")
    counts = models.JSONField(default=dict)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        db_table = "clash_import"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.original_name} ({self.source})"


class ClashIssue(OrgScopedModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="clashes"
    )
    source = models.CharField(max_length=12, choices=ClashSource.choices)
    guid = models.CharField(max_length=120)  # BCF topic Guid / Navisworks clash guid
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    source_status = models.CharField(max_length=60, blank=True)  # as written by the tool
    status = models.CharField(max_length=12, choices=ClashStatus.choices, default=ClashStatus.OPEN)
    priority = models.CharField(max_length=60, blank=True)
    topic_type = models.CharField(max_length=60, blank=True)
    labels = models.JSONField(default=list)
    assigned_to_text = models.CharField(max_length=200, blank=True)  # from the file
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    sheets = models.ManyToManyField("register.Sheet", blank=True, related_name="clashes")
    snapshot = models.ForeignKey(
        "files.FileObject", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    source_modified = models.DateTimeField(null=True, blank=True)
    last_import = models.ForeignKey(
        ClashImport, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    status_locked = models.BooleanField(default=False)  # set once someone changes it here

    class Meta:
        db_table = "clash_issue"
        ordering = ["status", "title"]
        constraints = [
            # Re-import updates the existing issue instead of duplicating it (F-34).
            models.UniqueConstraint(fields=["project", "source", "guid"], name="clash_issue_once"),
        ]

    def __str__(self) -> str:
        return self.title

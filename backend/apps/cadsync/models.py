"""F-09 / I-03 / I-04: sheet lists from the Revit add-in and AutoCAD plugin become proposals a
DL approves; nothing is created automatically. I-02: CAD file activity per sheet (no copying)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class SyncSource(models.TextChoices):
    REVIT = "revit", "Revit"
    AUTOCAD = "autocad", "AutoCAD"


class SyncBatch(OrgScopedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    source = models.CharField(max_length=10, choices=SyncSource.choices)
    model_path = models.CharField(max_length=500, blank=True)
    app_version = models.CharField(max_length=60, blank=True)
    plugin_version = models.CharField(max_length=30, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    counts = models.JSONField(default=dict)

    class Meta:
        db_table = "cad_sync_batch"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.source} sync for {self.project}"


class ProposalKind(models.TextChoices):
    NEW = "new", "New sheet"
    TITLE = "title", "Title differs"
    REVISION = "revision", "Title-block revision differs"


class ProposalState(models.TextChoices):
    OPEN = "open", "Waiting for a DL"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Replaced by a newer sync"


class SyncProposal(OrgScopedModel):
    batch = models.ForeignKey(SyncBatch, on_delete=models.CASCADE, related_name="proposals")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=10, choices=ProposalKind.choices)
    number = models.CharField(max_length=40)
    cad_title = models.CharField(max_length=300)
    cad_revision = models.CharField(max_length=20, blank=True)
    sheet = models.ForeignKey(
        "register.Sheet", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    register_title = models.CharField(max_length=300, blank=True)
    register_revision = models.CharField(max_length=20, blank=True)
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    state = models.CharField(
        max_length=10, choices=ProposalState.choices, default=ProposalState.OPEN
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "cad_sync_proposal"
        ordering = ["number"]

    def __str__(self) -> str:
        return f"{self.get_kind_display()}: {self.number}"


class FileEventKind(models.TextChoices):
    CREATED = "created", "Created"
    MODIFIED = "modified", "Changed"
    DELETED = "deleted", "Deleted"
    RENAMED = "renamed", "Renamed"


class CadFileEvent(OrgScopedModel):
    """I-02: 'CAD file changed' activity per sheet. The file itself is never copied."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    sheet = models.ForeignKey(
        "register.Sheet", on_delete=models.CASCADE, null=True, blank=True, related_name="cad_events"
    )
    path = models.CharField(max_length=500)
    event = models.CharField(max_length=10, choices=FileEventKind.choices)
    at = models.DateTimeField()
    by = models.CharField(max_length=200, blank=True)  # as the storage reports it
    connector = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "cad_file_event"
        ordering = ["-at"]
        indexes = [models.Index(fields=["sheet", "-at"], name="cad_event_sheet_at")]

    def __str__(self) -> str:
        return f"{self.path} {self.event}"

"""Drawing register (M02): sheets, revisions, naming rules, saved views, imports."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.search import SearchVectorField
from django.db import models

from apps.core.models import OrgScopedModel


class SheetState(models.TextChoices):
    """03 §3. Transitions live only in apps/workflow/state_machine.py."""

    PLANNED = "planned", "Planned"
    IN_PROGRESS = "in_progress", "In progress"
    READY_FOR_CHECK = "ready_for_check", "Ready for check"
    IN_CHECK = "in_check", "In check"
    CHANGES_REQUESTED = "changes_requested", "Changes requested"
    APPROVED_FOR_ISSUE = "approved_for_issue", "Approved for issue"
    ISSUED = "issued", "Issued"
    SUPERSEDED = "superseded", "Superseded"
    ON_HOLD = "on_hold", "On hold"
    CANCELLED = "cancelled", "Cancelled"


class Sheet(OrgScopedModel):
    """One drawing sheet the firm owes. It exists from the day it is planned (F-04)."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="sheets")
    stage = models.ForeignKey("projects.Stage", on_delete=models.PROTECT, related_name="sheets")
    package = models.ForeignKey(
        "projects.Package", on_delete=models.SET_NULL, null=True, blank=True, related_name="sheets"
    )
    discipline = models.ForeignKey("core.Discipline", on_delete=models.PROTECT, related_name="+")
    number = models.CharField(max_length=40)
    title = models.CharField(max_length=300)
    aliases = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    checker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    planned_issue_date = models.DateField(null=True, blank=True)
    state = models.CharField(max_length=24, choices=SheetState.choices, default=SheetState.PLANNED)
    state_before_hold = models.CharField(max_length=24, choices=SheetState.choices, blank=True)
    current_revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    replaced_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replaces"
    )
    cad_link = models.CharField(max_length=500, blank=True)
    # F-44: maintained by a database trigger (apps/search migrations); GIN-indexed.
    search_vector = SearchVectorField(null=True, editable=False)
    notes = models.TextField(blank=True)
    state_changed_at = models.DateTimeField(null=True, blank=True)
    review_round = models.PositiveIntegerField(default=0)  # +1 on every submit for check

    class Meta:
        db_table = "sheet"
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["project", "number"], name="sheet_number_unique"),
        ]
        indexes = [
            models.Index(fields=["project", "state"], name="sheet_project_state"),
            models.Index(fields=["owner", "state"], name="sheet_owner_state"),
            models.Index(fields=["checker", "state"], name="sheet_checker_state"),
        ]

    def __str__(self) -> str:
        return f"{self.number} {self.title}"

    @property
    def effective_planned_date(self):
        """A sheet without its own date inherits its package's date (F-49)."""
        if self.planned_issue_date:
            return self.planned_issue_date
        return self.package.planned_date if self.package_id and self.package else None


class RevisionState(models.TextChoices):
    DRAFT = "draft", "Draft"
    ISSUED = "issued", "Issued"
    SUPERSEDED = "superseded", "Superseded"


class NamingStatus(models.TextChoices):
    PENDING = "pending", "Checking"
    OK = "ok", "OK"
    BLOCKED = "blocked", "Blocked"


class SheetRevision(OrgScopedModel):
    """One draft or issued version of a sheet (F-06). Issued files are immutable."""

    sheet = models.ForeignKey(Sheet, on_delete=models.CASCADE, related_name="revisions")
    code = models.CharField(max_length=8)
    seq = models.PositiveIntegerField()
    state = models.CharField(
        max_length=12, choices=RevisionState.choices, default=RevisionState.DRAFT
    )
    stage = models.ForeignKey(
        "projects.Stage", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    purpose = models.CharField(max_length=6, blank=True)
    suitability = models.CharField(max_length=6, blank=True)
    file = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    original_name = models.CharField(max_length=255, blank=True)
    naming_status = models.CharField(
        max_length=10, choices=NamingStatus.choices, default=NamingStatus.PENDING
    )
    naming_message = models.TextField(blank=True)
    change_summary = models.CharField(max_length=500, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    transmittal = models.ForeignKey(
        "transmittals.Transmittal",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="issued_revisions",
    )
    superseded_at = models.DateTimeField(null=True, blank=True)
    watermarked_key = models.CharField(max_length=300, blank=True)
    is_historic = models.BooleanField(default=False, help_text="Loaded by onboarding (F-54).")

    class Meta:
        db_table = "sheet_revision"
        ordering = ["sheet", "-seq"]
        constraints = [
            models.UniqueConstraint(fields=["sheet", "code"], name="revision_code_unique"),
            models.UniqueConstraint(fields=["sheet", "seq"], name="revision_seq_unique"),
            # Exactly one issued (current) revision per sheet (02 §5, F-06).
            models.UniqueConstraint(
                fields=["sheet"],
                condition=models.Q(state="issued"),
                name="one_issued_revision_per_sheet",
            ),
            models.UniqueConstraint(
                fields=["sheet"],
                condition=models.Q(state="draft"),
                name="one_draft_revision_per_sheet",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sheet.number} {self.code} ({self.state})"


class NamingTarget(models.TextChoices):
    SHEET_NUMBER = "sheet_number", "Sheet number"
    FILE_NAME = "file_name", "File name"


class NamingRule(OrgScopedModel):
    """Regex rule for sheet numbers or uploaded file names, per org or per project (F-35)."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    target = models.CharField(max_length=16, choices=NamingTarget.choices)
    regex = models.CharField(max_length=300)
    example = models.CharField(max_length=120)
    message = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "naming_rule"
        ordering = ["target", "created_at"]

    def __str__(self) -> str:
        return f"{self.get_target_display()}: {self.regex}"


class SavedView(OrgScopedModel):
    """A user's named set of register filters and columns (DESIGN.md S-05)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_views"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    name = models.CharField(max_length=80)
    config = models.JSONField(default=dict)

    class Meta:
        db_table = "saved_view"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ImportKind(models.TextChoices):
    SHEETS = "sheets", "Sheet register"


class ImportState(models.TextChoices):
    PREVIEW = "preview", "Preview"
    COMMITTED = "committed", "Imported"
    UNDONE = "undone", "Undone"


class ImportJob(OrgScopedModel):
    """Excel/CSV register import: upload → mapping → preview → commit → undo (F-05, I-01)."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="imports"
    )
    kind = models.CharField(max_length=10, choices=ImportKind.choices, default=ImportKind.SHEETS)
    original_name = models.CharField(max_length=255)
    headers = models.JSONField(default=list)
    rows = models.JSONField(default=list)  # raw cell text, row by row
    mapping = models.JSONField(default=dict)  # field -> column index
    skip_rows = models.JSONField(default=list)
    overrides = models.JSONField(default=dict)  # "row index" -> {field: value}
    state = models.CharField(
        max_length=10, choices=ImportState.choices, default=ImportState.PREVIEW
    )
    report = models.JSONField(default=dict)
    created_sheet_ids = models.JSONField(default=list)
    committed_at = models.DateTimeField(null=True, blank=True)
    undo_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "import_job"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.original_name} ({self.state})"


class OnboardingState(models.TextChoices):
    DRAFT = "draft", "Draft"
    COMMITTED = "committed", "Committed"


class OnboardingJob(OrgScopedModel):
    """F-54: one live project loaded from the onboarding workbook plus its PDFs."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    original_name = models.CharField(max_length=255)
    data = models.JSONField(default=dict)  # sheet name -> list of row dicts
    files = models.JSONField(default=dict)  # PDF file name (lower) -> FileObject id
    report = models.JSONField(default=dict)
    state = models.CharField(
        max_length=10, choices=OnboardingState.choices, default=OnboardingState.DRAFT
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "onboarding_job"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Onboarding {self.original_name} ({self.state})"

    @property
    def report_view(self) -> dict:
        """The validation report with every key present (empty until validated)."""
        return {"errors": [], "missing_files": [], "counts": {}, "ready": False, **self.report}

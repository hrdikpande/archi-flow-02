"""Projects, fee stages, stage templates, packages and project teams (M01: F-01..03, F-49)."""

from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.search import SearchVectorField
from django.db import models

from apps.accounts.roles import ProjectRole
from apps.core.models import OrgScopedModel


class ProjectStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ON_HOLD = "on_hold", "On hold"
    CLOSED = "closed", "Closed"


class ProjectType(models.TextChoices):
    HOSPITAL = "hospital", "Hospital"
    RESIDENTIAL = "residential", "Residential"
    COMMERCIAL = "commercial", "Commercial"
    OTHER = "other", "Other"


class Project(OrgScopedModel):
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    client = models.ForeignKey(
        "contacts.ExternalOrg", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    type = models.CharField(max_length=16, choices=ProjectType.choices, default=ProjectType.OTHER)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=16, choices=ProjectStatus.choices, default=ProjectStatus.ACTIVE
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    # Free-text tags such as "Revit 2024", "AutoCAD 2023" (F-01).
    cad_versions = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    # F-44: maintained by a database trigger (apps/search migrations); GIN-indexed.
    search_vector = SearchVectorField(null=True, editable=False)
    stage_plan_final = models.BooleanField(default=False)
    appointment_letter = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "project"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "code"], name="project_code_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class ProjectMembership(OrgScopedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=ProjectRole.choices)
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "project_membership"
        constraints = [
            models.UniqueConstraint(fields=["project", "user"], name="membership_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.get_role_display()} · {self.project.code}"


class StageTemplate(OrgScopedModel):
    """Org default fee-stage template (F-02, F-42). Percentages are placeholders (AS-05)."""

    name = models.CharField(max_length=120)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "stage_template"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organisation"],
                condition=models.Q(is_default=True),
                name="one_default_stage_template",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class StageTemplateItem(models.Model):
    template = models.ForeignKey(StageTemplate, on_delete=models.CASCADE, related_name="items")
    seq = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=120)
    fee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    required_purposes = ArrayField(models.CharField(max_length=6), default=list, blank=True)
    requires_senior_qc = models.BooleanField(default=False)

    class Meta:
        db_table = "stage_template_item"
        ordering = ["seq"]
        constraints = [
            models.UniqueConstraint(fields=["template", "seq"], name="template_item_seq_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.seq}. {self.name} {self.fee_pct}%"


class StageState(models.TextChoices):
    """03 §4."""

    PLANNED = "planned", "Planned"
    ACTIVE = "active", "Active"
    DELIVERABLES_ISSUED = "deliverables_issued", "Deliverables issued"
    CLIENT_APPROVED = "client_approved", "Client approved"
    READY_TO_INVOICE = "ready_to_invoice", "Ready to invoice"
    INVOICED = "invoiced", "Invoiced"
    CLOSED = "closed", "Closed"
    ON_HOLD = "on_hold", "On hold"


# Default purposes a stage needs before its deliverables count as issued (03 §4).
DEFAULT_REQUIRED_PURPOSES = ["FA", "GFC"]


class Stage(OrgScopedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="stages")
    seq = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=120)
    fee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    fee_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)
    state = models.CharField(max_length=24, choices=StageState.choices, default=StageState.PLANNED)
    state_before_hold = models.CharField(max_length=24, choices=StageState.choices, blank=True)
    requires_senior_qc = models.BooleanField(default=False)
    required_purposes = ArrayField(
        models.CharField(max_length=6), default=list, blank=True
    )  # empty = DEFAULT_REQUIRED_PURPOSES

    class Meta:
        db_table = "stage"
        ordering = ["project", "seq"]
        constraints = [
            models.UniqueConstraint(fields=["project", "seq"], name="stage_seq_unique"),
            models.CheckConstraint(
                condition=models.Q(planned_end__isnull=True)
                | models.Q(planned_start__isnull=True)
                | models.Q(planned_end__gte=models.F("planned_start")),
                name="stage_planned_end_after_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.seq} {self.name}"

    @property
    def purposes_required(self) -> list[str]:
        return list(self.required_purposes) or list(DEFAULT_REQUIRED_PURPOSES)


class Package(OrgScopedModel):
    """Optional group of sheets with one date, e.g. "HVAC GFC set" (F-49)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="packages")
    name = models.CharField(max_length=120)
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    planned_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "package"
        ordering = ["planned_date", "name"]
        constraints = [
            models.UniqueConstraint(fields=["project", "name"], name="package_name_unique"),
        ]

    def __str__(self) -> str:
        return self.name

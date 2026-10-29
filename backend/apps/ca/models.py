"""M10 construction administration (P3, 03 §14): RFIs F-30, submittals F-31, site visit
reports F-32, change orders F-33. Same register pattern: numbered per project, linked to
sheets, "ball in court" shows who owes the next action."""

import uuid

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class Party(models.TextChoices):
    """Who owes the next action (ball in court)."""

    FIRM = "firm", "Our firm"
    CLIENT = "client", "Client"
    CONTRACTOR = "contractor", "Contractor"
    CONSULTANT = "consultant", "Consultant"


class Numbered(OrgScopedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    seq = models.PositiveIntegerField()
    number = models.CharField(max_length=60)
    sheets = models.ManyToManyField("register.Sheet", blank=True, related_name="+")
    attachments = models.ManyToManyField("files.FileObject", blank=True, related_name="+")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        abstract = True

    def __str__(self) -> str:
        return self.number


class RfiStatus(models.TextChoices):
    OPEN = "open", "Open"
    ANSWERED = "answered", "Answered"
    CLOSED = "closed", "Closed"
    VOID = "void", "Void"


class Rfi(Numbered):
    subject = models.CharField(max_length=300)
    question = models.TextField()
    raised_by = models.ForeignKey(
        "contacts.Contact", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    raised_by_name = models.CharField(max_length=200, blank=True)
    received_on = models.DateField()
    due_on = models.DateField()
    ball_in_court = models.CharField(
        max_length=12, choices=Party.choices, default=Party.FIRM, blank=True
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    status = models.CharField(max_length=10, choices=RfiStatus.choices, default=RfiStatus.OPEN)
    response = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    cost_impact = models.BooleanField(default=False)
    schedule_impact = models.BooleanField(default=False)

    class Meta:
        db_table = "rfi"
        ordering = ["-seq"]
        constraints = [models.UniqueConstraint(fields=["project", "seq"], name="rfi_seq")]


class SubmittalKind(models.TextChoices):
    SHOP_DRAWING = "shop_drawing", "Shop drawing"
    PRODUCT_DATA = "product_data", "Product data"
    SAMPLE = "sample", "Sample"
    OTHER = "other", "Other"


class SubmittalStatus(models.TextChoices):
    PENDING = "pending", "Waiting for review"
    APPROVED = "approved", "Approved"
    APPROVED_AS_NOTED = "approved_as_noted", "Approved as noted"
    REVISE_RESUBMIT = "revise_resubmit", "Revise and resubmit"
    REJECTED = "rejected", "Rejected"


class Submittal(Numbered):
    title = models.CharField(max_length=300)
    kind = models.CharField(max_length=14, choices=SubmittalKind.choices)
    spec_section = models.CharField(max_length=60, blank=True)
    submitted_by = models.ForeignKey(
        "contacts.Contact", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    submitted_by_name = models.CharField(max_length=200, blank=True)
    received_on = models.DateField()
    due_on = models.DateField(null=True, blank=True)
    round = models.PositiveSmallIntegerField(default=1)  # resubmissions keep the number
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    status = models.CharField(
        max_length=18, choices=SubmittalStatus.choices, default=SubmittalStatus.PENDING
    )
    file = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    stamped_file = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    review_comment = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "submittal"
        ordering = ["-seq"]
        constraints = [models.UniqueConstraint(fields=["project", "seq"], name="submittal_seq")]


class ReportState(models.TextChoices):
    DRAFT = "draft", "Draft"
    FILED = "filed", "Filed"


class SiteReport(Numbered):
    visit_date = models.DateField()
    attendees = models.TextField(blank=True)
    weather = models.CharField(max_length=120, blank=True)
    summary = models.TextField(blank=True)
    state = models.CharField(max_length=6, choices=ReportState.choices, default=ReportState.DRAFT)
    filed_at = models.DateTimeField(null=True, blank=True)
    pdf = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "site_report"
        ordering = ["-visit_date", "-seq"]
        constraints = [models.UniqueConstraint(fields=["project", "seq"], name="site_report_seq")]


class SiteObservation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(SiteReport, on_delete=models.CASCADE, related_name="observations")
    seq = models.PositiveSmallIntegerField()
    text = models.TextField()
    sheet = models.ForeignKey(
        "register.Sheet", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    action = models.TextField(blank=True)  # what must be done, by whom
    action_owner = models.CharField(max_length=12, choices=Party.choices, blank=True)
    photos = models.ManyToManyField("files.FileObject", blank=True, related_name="+")

    class Meta:
        db_table = "site_observation"
        ordering = ["seq"]

    def __str__(self) -> str:
        return f"{self.report} #{self.seq}"


class ChangeOrigin(models.TextChoices):
    RFI = "rfi", "RFI"
    CLIENT = "client", "Client request"
    SITE = "site", "Site condition"
    DESIGN = "design", "Design development"
    OTHER = "other", "Other"


class ChangeStatus(models.TextChoices):
    PROPOSED = "proposed", "Proposed"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    IMPLEMENTED = "implemented", "Implemented"


class ChangeOrder(Numbered):
    title = models.CharField(max_length=300)
    description = models.TextField()
    origin = models.CharField(max_length=8, choices=ChangeOrigin.choices)
    rfi = models.ForeignKey(Rfi, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    cost_impact = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    schedule_impact_days = models.IntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=ChangeStatus.choices, default=ChangeStatus.PROPOSED
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decision_note = models.TextField(blank=True)
    revision_cycle_started = models.BooleanField(default=False)

    class Meta:
        db_table = "change_order"
        ordering = ["-seq"]
        constraints = [models.UniqueConstraint(fields=["project", "seq"], name="change_order_seq")]

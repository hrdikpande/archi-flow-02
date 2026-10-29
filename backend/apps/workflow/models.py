"""Status history, reviews, delegation and pre-check lists (M03: F-10..F-13)."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models

from apps.core.models import OrgScopedModel
from apps.register.models import SheetState


class StatusTransition(OrgScopedModel):
    """One row per state change: from, to, user, role, time, reason (F-10, F-39)."""

    sheet = models.ForeignKey(
        "register.Sheet", on_delete=models.CASCADE, related_name="transitions"
    )
    action = models.CharField(max_length=32)
    from_state = models.CharField(max_length=24, choices=SheetState.choices)
    to_state = models.CharField(max_length=24, choices=SheetState.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    role = models.CharField(max_length=24, blank=True)
    reason = models.TextField(blank=True)
    request_id = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "status_transition"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["sheet", "created_at"], name="transition_sheet_at")]

    def __str__(self) -> str:
        return f"{self.sheet_id}: {self.from_state} → {self.to_state}"


class ReviewKind(models.TextChoices):
    CHECK = "check", "Check"
    SENIOR_QC = "senior_qc", "Senior QC"


class ReviewState(models.TextChoices):
    OPEN = "open", "Open"
    RETURNED = "returned", "Returned"
    APPROVED = "approved", "Approved"


class Review(OrgScopedModel):
    """A check by the checker, or the senior QC second step when the stage needs it (F-11)."""

    sheet = models.ForeignKey("register.Sheet", on_delete=models.CASCADE, related_name="reviews")
    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    kind = models.CharField(max_length=12, choices=ReviewKind.choices)
    round = models.PositiveIntegerField(default=1)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    state = models.CharField(max_length=10, choices=ReviewState.choices, default=ReviewState.OPEN)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True)
    redlines = models.ManyToManyField("files.FileObject", blank=True, related_name="+")

    class Meta:
        db_table = "review"
        ordering = ["-opened_at"]
        indexes = [models.Index(fields=["reviewer", "state"], name="review_reviewer_state")]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} of {self.sheet_id} ({self.state})"


class Delegation(OrgScopedModel):
    """F-12: while a reviewer is away, new reviews route to a delegate between two dates."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="delegations"
    )
    delegate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="delegated_to_me"
    )
    start = models.DateField()
    end = models.DateField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "delegation"
        ordering = ["-start"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end__gte=models.F("start")), name="delegation_dates"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} → {self.delegate} {self.start}–{self.end}"


class Checklist(OrgScopedModel):
    """F-13 designer pre-check list for a discipline and stage(s) (S-19)."""

    name = models.CharField(max_length=120)
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    # Stage names it applies to (matched case-insensitively on each project); empty = all stages.
    stage_names = ArrayField(models.CharField(max_length=120), default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "checklist"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ChecklistItem(models.Model):
    checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name="items")
    seq = models.PositiveSmallIntegerField()
    text = models.CharField(max_length=300)
    mandatory = models.BooleanField(default=True)

    class Meta:
        db_table = "checklist_item"
        ordering = ["seq"]

    def __str__(self) -> str:
        return self.text


class ChecklistResponse(OrgScopedModel):
    """The ticks a designer gave when submitting a round; shown with that round's review."""

    sheet = models.ForeignKey("register.Sheet", on_delete=models.CASCADE, related_name="checklists")
    round = models.PositiveIntegerField()
    items = models.JSONField(default=list)  # [{id, checklist, text, mandatory, ticked}]
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        db_table = "checklist_response"
        constraints = [
            models.UniqueConstraint(fields=["sheet", "round"], name="checklist_response_round"),
        ]

    def __str__(self) -> str:
        return f"{self.sheet} round {self.round}"

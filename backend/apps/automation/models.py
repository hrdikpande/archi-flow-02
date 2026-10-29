"""Automation rules, runs and flags (M06; 02 §8)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class AutomationRule(OrgScopedModel):
    """Thresholds for one rule (A-01…A-10), edited in Admin (F-42). Rules themselves are code."""

    key = models.CharField(max_length=8)
    enabled = models.BooleanField(default=True)
    params = models.JSONField(default=dict)

    class Meta:
        db_table = "automation_rule"
        ordering = ["key"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "key"], name="automation_rule_unique"),
        ]

    def __str__(self) -> str:
        return self.key


class AutomationRun(OrgScopedModel):
    """One execution of a rule; missing runs raise an alert (N-05)."""

    rule = models.CharField(max_length=8)
    run_date = models.DateField(help_text="Organisation-local date the run is for.")
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    raised = models.PositiveIntegerField(default=0)
    cleared = models.PositiveIntegerField(default=0)
    notified = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        db_table = "automation_run"
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["organisation", "rule", "run_date"], name="run_rule_date")]

    def __str__(self) -> str:
        return f"{self.rule} {self.run_date}"


class FlagKind(models.TextChoices):
    AT_RISK = "at_risk", "At risk"
    LATE = "late", "Late"
    OVER_ALLOCATED = "over_allocated", "Over-allocated"
    UNDER_ALLOCATED = "under_allocated", "Under-allocated"
    TIMESHEET_MISSING = "timesheet_missing", "Timesheet missing"
    REVIEW_OVERDUE = "review_overdue", "Review overdue"
    COMMENT_OVERDUE = "comment_overdue", "Comment overdue"
    READY_TO_INVOICE = "ready_to_invoice", "Ready to invoice"
    RFI_DUE = "rfi_due", "RFI due"


class Flag(OrgScopedModel):
    """A computed warning. One open flag per (entity, kind); cleared flags are kept for D-05."""

    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    kind = models.CharField(max_length=20, choices=FlagKind.choices)
    rule = models.CharField(max_length=8)
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    sheet = models.ForeignKey(
        "register.Sheet", on_delete=models.CASCADE, null=True, blank=True, related_name="flags"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    week = models.DateField(null=True, blank=True)
    raised_at = models.DateTimeField()
    cleared_at = models.DateTimeField(null=True, blank=True)
    data = models.JSONField(default=dict)

    class Meta:
        db_table = "flag"
        ordering = ["-raised_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["entity_type", "entity_id", "kind"],
                condition=models.Q(cleared_at__isnull=True),
                name="one_open_flag_per_entity_kind",
            ),
        ]
        indexes = [
            models.Index(
                fields=["project", "kind"],
                name="flag_project_kind",
                condition=models.Q(cleared_at__isnull=True),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} {self.entity_type}:{self.entity_id}"

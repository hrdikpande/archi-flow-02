"""People and workload (M05: F-16..F-19)."""

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class StaffProfile(OrgScopedModel):
    """F-16. SSO-created users appear with a blank discipline until it is set."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_profile"
    )
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    team = models.CharField(max_length=80, blank=True)
    weekly_capacity_h = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal("45"))
    # Optional and hidden: only Admins see it (02 §5); never used to rank people (03 §9).
    cost_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "staff_profile"

    def __str__(self) -> str:
        return f"Profile of {self.user}"


class LeaveType(models.TextChoices):
    ANNUAL = "annual", "Annual leave"
    SICK = "sick", "Sick leave"
    OTHER = "other", "Other"


class Leave(OrgScopedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave"
    )
    start = models.DateField()
    end = models.DateField()
    type = models.CharField(max_length=8, choices=LeaveType.choices, default=LeaveType.ANNUAL)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "leave"
        ordering = ["-start"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end__gte=models.F("start")), name="leave_end_after_start"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} {self.start}–{self.end}"


class Allocation(OrgScopedModel):
    """Planned hours for a person on a project stage in an ISO week (F-17)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="allocations"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="allocations"
    )
    stage = models.ForeignKey(
        "projects.Stage", on_delete=models.CASCADE, related_name="allocations"
    )
    week = models.DateField(help_text="Monday of the ISO week.")
    planned_h = models.DecimalField(max_digits=5, decimal_places=1)

    class Meta:
        db_table = "allocation"
        ordering = ["week"]
        constraints = [
            models.UniqueConstraint(fields=["user", "stage", "week"], name="allocation_unique"),
            models.CheckConstraint(condition=models.Q(planned_h__gt=0), name="allocation_positive"),
        ]
        indexes = [models.Index(fields=["user", "week"], name="allocation_user_week")]

    def __str__(self) -> str:
        return f"{self.user} {self.week} {self.planned_h}h"


class TimesheetState(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    RETURNED = "returned", "Returned"


class Timesheet(OrgScopedModel):
    """One person's week, Monday–Sunday (03 §9). Approved weeks are read-only."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timesheets"
    )
    week = models.DateField(help_text="Monday of the ISO week.")
    state = models.CharField(
        max_length=10, choices=TimesheetState.choices, default=TimesheetState.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    return_reason = models.TextField(blank=True)
    imported = models.BooleanField(default=False)

    class Meta:
        db_table = "timesheet"
        ordering = ["-week"]
        constraints = [
            models.UniqueConstraint(fields=["user", "week"], name="timesheet_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.user} week of {self.week}"


class TimeEntry(OrgScopedModel):
    timesheet = models.ForeignKey(Timesheet, on_delete=models.CASCADE, related_name="entries")
    project = models.ForeignKey("projects.Project", on_delete=models.PROTECT, related_name="+")
    stage = models.ForeignKey(
        "projects.Stage", on_delete=models.PROTECT, related_name="time_entries"
    )
    # 03 §9 edge case: reporting uses the discipline at the time of entry.
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    date = models.DateField()
    hours = models.DecimalField(max_digits=4, decimal_places=1)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "time_entry"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["timesheet", "stage", "date"], name="time_entry_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(hours__gt=0) & models.Q(hours__lte=24), name="time_entry_hours"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date} {self.hours}h"

"""Organisation, its settings and reference data (F-42), plus the base models every app uses."""

import re
import uuid
from datetime import time
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrgScopedQuerySet(models.QuerySet):
    def for_org(self, organisation: "Organisation") -> "OrgScopedQuerySet":
        return self.filter(organisation=organisation)


class OrgScopedModel(TimeStampedModel):
    """Every domain table carries organisation_id, so the code can go multi-tenant (ADR-010)."""

    organisation = models.ForeignKey(
        "core.Organisation", on_delete=models.PROTECT, related_name="+"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    objects = OrgScopedQuerySet.as_manager()

    class Meta:
        abstract = True


class WorkWeek(models.TextChoices):
    MON_FRI = "mon_fri", "Monday to Friday"
    MON_SAT = "mon_sat", "Monday to Saturday"


class Organisation(TimeStampedModel):
    name = models.CharField(max_length=200)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    currency = models.CharField(max_length=3, default="INR")
    work_week = models.CharField(max_length=10, choices=WorkWeek.choices, default=WorkWeek.MON_FRI)

    class Meta:
        db_table = "organisation"

    def __str__(self) -> str:
        return self.name

    @property
    def working_weekdays(self) -> frozenset[int]:
        """ISO weekdays (Mon=0) that count as working days."""
        return frozenset(range(6)) if self.work_week == WorkWeek.MON_SAT else frozenset(range(5))


def default_revision_scheme() -> dict[str, Any]:
    # Placeholder until DEC-06; P = preliminary, C = construction, two digits (P01, C02).
    return {
        "digits": 2,
        "series": [
            {"prefix": "P", "label": "Preliminary"},
            {"prefix": "C", "label": "Construction"},
        ],
    }


def default_purpose_codes() -> list[dict[str, Any]]:
    # F-08. Never use the bare acronym "IFC" for a purpose.
    return [
        {"code": "FI", "label": "For information", "active": True},
        {"code": "FC", "label": "For comment", "active": True},
        {"code": "FA", "label": "For approval", "active": True},
        {"code": "AS", "label": "For authority submission", "active": True},
        {"code": "FT", "label": "For tender", "active": True},
        {"code": "GFC", "label": "Good for Construction (GFC)", "active": True},
        {"code": "REC", "label": "Record / as-built", "active": True},
    ]


def default_suitability_codes() -> list[dict[str, Any]]:
    # Optional ISO 19650 suitability codes.
    return [
        {"code": "S0", "label": "Work in progress", "active": True},
        {"code": "S1", "label": "Suitable for coordination", "active": True},
        {"code": "S2", "label": "Suitable for information", "active": True},
        {"code": "S3", "label": "Suitable for review and comment", "active": True},
        {"code": "S4", "label": "Suitable for stage approval", "active": True},
    ]


def default_thresholds() -> dict[str, Any]:
    """Kept for migration history only: thresholds moved to AutomationRule (DD-022)."""
    return {}


BILLING_FIELDS = {
    "project_code": "Project code",
    "project_name": "Project name",
    "client": "Client",
    "stage": "Stage",
    "fee_pct": "Fee %",
    "fee_amount": "Fee amount (INR)",
    "ready_date": "Ready since",
    "days_waiting": "Days waiting",
    "approved_by": "Client approval by",
    "approved_on": "Approved on",
}


def default_billing_columns() -> list[dict[str, str]]:
    return [{"field": f, "header": h} for f, h in BILLING_FIELDS.items()]


class OrgSettings(TimeStampedModel):
    organisation = models.OneToOneField(
        Organisation, on_delete=models.PROTECT, related_name="settings"
    )
    revision_scheme = models.JSONField(default=default_revision_scheme)
    purpose_codes = models.JSONField(default=default_purpose_codes)
    suitability_codes = models.JSONField(default=default_suitability_codes)
    digest_time = models.TimeField(default=time(8, 30))
    transmittal_link_days = models.PositiveSmallIntegerField(default=30)
    project_code_format = models.CharField(max_length=40, default="YYYY-NNN")
    default_weekly_capacity_h = models.DecimalField(max_digits=4, decimal_places=1, default=45)
    # F-15: recipients who have not acknowledged after this many days show on the PL dashboard.
    acknowledge_within_days = models.PositiveSmallIntegerField(default=5)
    # F-28 / I-08: the column layout agreed with the firm for the ready-to-invoice CSV, and an
    # optional webhook that receives each billing signal as signed JSON.
    billing_csv_columns = models.JSONField(default=default_billing_columns)
    billing_webhook_url = models.URLField(blank=True)
    billing_webhook_secret = models.CharField(max_length=128, blank=True)
    # F-57: off → evaluation (findings only on the labelling screen) → on (shown on sheets);
    # "on" needs ≥ 200 labelled sheets first (02 §17).
    drawing_checks = models.CharField(
        max_length=10,
        choices=[("off", "Off"), ("evaluation", "Evaluation"), ("on", "On")],
        default="off",
    )

    class Meta:
        db_table = "org_settings"

    def __str__(self) -> str:
        return f"Settings for {self.organisation}"


def validate_regex(value: str) -> None:
    try:
        re.compile(value)
    except re.error as exc:
        raise ValidationError(f"Not a valid regular expression: {exc}") from exc


class Discipline(OrgScopedModel):
    code = models.CharField(max_length=3)
    name = models.CharField(max_length=100)
    sheet_prefix_regex = models.CharField(max_length=200, blank=True, validators=[validate_regex])
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "discipline"
        ordering = ["sort_order", "code"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "code"], name="discipline_code_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class Holiday(OrgScopedModel):
    date = models.DateField()
    name = models.CharField(max_length=120)

    class Meta:
        db_table = "holiday"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "date"], name="holiday_date_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.date:%d-%b-%Y} {self.name}"


class Heartbeat(models.Model):
    """Last time a scheduled process ran; /healthz reports it (N-05)."""

    name = models.CharField(max_length=64, primary_key=True)
    last_seen = models.DateTimeField()

    class Meta:
        db_table = "heartbeat"

    def __str__(self) -> str:
        return f"{self.name} at {self.last_seen:%H:%M:%S}"

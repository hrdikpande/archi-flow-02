"""Dates in the organisation's timezone (IST by default)."""

from datetime import date
from zoneinfo import ZoneInfo

from django.utils import timezone

from .models import Organisation


def org_today(organisation: Organisation) -> date:
    return timezone.now().astimezone(ZoneInfo(organisation.timezone)).date()

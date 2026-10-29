from datetime import date
from typing import Any

from django.db.models import QuerySet

from .models import AuditEvent


def audit_events(organisation_id: Any, filters: dict[str, Any]) -> QuerySet[AuditEvent]:
    qs = AuditEvent.objects.filter(organisation_id=organisation_id)
    if v := filters.get("entity_type"):
        qs = qs.filter(entity_type=v)
    if v := filters.get("entity_id"):
        qs = qs.filter(entity_id=v)
    if v := filters.get("actor"):
        qs = qs.filter(actor_id=v)
    if v := filters.get("verb"):
        qs = qs.filter(verb__startswith=v)
    if isinstance(v := filters.get("date_from"), date):
        qs = qs.filter(at__date__gte=v)
    if isinstance(v := filters.get("date_to"), date):
        qs = qs.filter(at__date__lte=v)
    return qs

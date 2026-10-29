"""Write audit rows. Called by every service that changes a record (F-39)."""

from collections.abc import Iterable
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import models

from apps.core.context import get_context

from .models import AuditEvent

JsonDict = dict[str, Any]


def _jsonable(value: Any) -> Any:
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, models.Model):
        return str(value.pk)
    if isinstance(value, list | tuple):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    return value


def snapshot(instance: models.Model, fields: Iterable[str] | None = None) -> JsonDict:
    """Field values of a model as JSON. Foreign keys are stored as their IDs."""
    names = (
        list(fields)
        if fields is not None
        else [
            f.name
            for f in instance._meta.concrete_fields
            if f.name not in {"created_at", "updated_at"}
        ]
    )
    data: JsonDict = {}
    for name in names:
        field = instance._meta.get_field(name)
        attname = getattr(field, "attname", name)
        data[name] = _jsonable(getattr(instance, attname))
    return data


def diff(
    before: JsonDict | None, after: JsonDict | None
) -> tuple[JsonDict | None, JsonDict | None]:
    """Keeps only changed keys so audit rows stay readable."""
    if before is None or after is None:
        return before, after
    changed = {k for k in set(before) | set(after) if before.get(k) != after.get(k)}
    return {k: before.get(k) for k in changed}, {k: after.get(k) for k in changed}


def record(
    *,
    organisation_id: Any,
    actor: Any,
    verb: str,
    entity_type: str,
    entity_id: Any,
    entity_label: str = "",
    before: JsonDict | None = None,
    after: JsonDict | None = None,
    project_id: Any = None,
    discipline_id: Any = None,
) -> AuditEvent:
    ctx = get_context()
    return AuditEvent.objects.create(
        organisation_id=organisation_id,
        actor=actor if actor is not None and getattr(actor, "pk", None) else None,
        actor_label=(getattr(actor, "email", "") if actor is not None else "") or "system",
        verb=verb,
        entity_type=entity_type,
        entity_id=str(entity_id),
        entity_label=entity_label[:300],
        before=_jsonable(before),
        after=_jsonable(after),
        ip=ctx.ip,
        request_id=ctx.request_id,
        project_id=project_id,
        discipline_id=discipline_id,
    )


def placement(instance: models.Model) -> tuple[Any, Any]:
    """(project_id, discipline_id) of a record, for the activity feed (F-45)."""
    if instance._meta.label_lower == "projects.project":
        return instance.pk, None
    project_id = getattr(instance, "project_id", None)
    discipline_id = getattr(instance, "discipline_id", None)
    sheet = getattr(instance, "sheet", None) if hasattr(instance, "sheet_id") else None
    if sheet is not None:
        project_id = project_id or sheet.project_id
        discipline_id = discipline_id or sheet.discipline_id
    transmittal = (
        getattr(instance, "transmittal", None) if hasattr(instance, "transmittal_id") else None
    )
    if transmittal is not None and project_id is None:
        project_id = transmittal.project_id
    return project_id, discipline_id


def record_change(
    instance: models.Model,
    *,
    actor: Any,
    verb: str,
    before: JsonDict | None,
    after: JsonDict | None,
    organisation_id: Any = None,
) -> AuditEvent | None:
    """Audit a create/update/delete of a model; no row if an update changed nothing."""
    b, a = diff(before, after)
    if before is not None and after is not None and not a:
        return None
    project_id, discipline_id = placement(instance)
    return record(
        organisation_id=organisation_id or instance.organisation_id,  # type: ignore[attr-defined]
        actor=actor,
        verb=verb,
        entity_type=instance._meta.label_lower,
        entity_id=instance.pk,
        entity_label=str(instance),
        before=b,
        after=a,
        project_id=project_id,
        discipline_id=discipline_id,
    )

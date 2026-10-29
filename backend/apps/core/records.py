"""Audited create/update/delete used by services. Never call these from views."""

from typing import Any

from django.db import models

from apps.audit.services import record_change, snapshot


def create_record[M: models.Model](model: type[M], *, actor: Any, verb: str, **fields: Any) -> M:
    instance = model(**fields)
    if hasattr(instance, "created_by_id") and actor is not None and actor.pk:
        instance.created_by = actor  # type: ignore[attr-defined]
    instance.full_clean()
    instance.save()
    record_change(instance, actor=actor, verb=verb, before=None, after=snapshot(instance))
    return instance


def update_record[M: models.Model](instance: M, *, actor: Any, verb: str, **fields: Any) -> M:
    before = snapshot(instance)
    for name, value in fields.items():
        setattr(instance, name, value)
    instance.full_clean()
    instance.save()
    record_change(instance, actor=actor, verb=verb, before=before, after=snapshot(instance))
    return instance


def delete_record(instance: models.Model, *, actor: Any, verb: str) -> None:
    before = snapshot(instance)
    record_change(instance, actor=actor, verb=verb, before=before, after=None)
    instance.delete()

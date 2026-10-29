"""Insert-only audit trail (F-39). A database trigger blocks UPDATE and DELETE."""

import uuid
from typing import Any

from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        "core.Organisation", on_delete=models.DO_NOTHING, db_constraint=True, related_name="+"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="+",
    )
    actor_label = models.CharField(max_length=200, blank=True)
    verb = models.CharField(max_length=60)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=64)
    entity_label = models.CharField(max_length=300, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    at = models.DateTimeField(auto_now_add=True, db_index=True)
    # Denormalised at write time so the project activity feed (F-45) filters by project and
    # discipline without joining every entity table. Not foreign keys: rows outlive deletes.
    project_id = models.UUIDField(null=True, blank=True)
    discipline_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "audit_event"
        ordering = ["-at"]
        indexes = [
            models.Index(fields=["organisation", "-at"], name="audit_org_at"),
            models.Index(fields=["entity_type", "entity_id"], name="audit_entity"),
            models.Index(fields=["project_id", "-at"], name="audit_project_at"),
        ]

    def __str__(self) -> str:
        return f"{self.at:%d-%b-%Y %H:%M} {self.actor_label} {self.verb} {self.entity_type}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise RuntimeError("audit_event is insert-only")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise RuntimeError("audit_event is insert-only")

"""Transactional outbox (02 §7, ADR-006)."""

import uuid

from django.db import models
from django.utils import timezone


class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        "core.Organisation", on_delete=models.PROTECT, null=True, related_name="+"
    )
    name = models.CharField(max_length=80, db_index=True)
    payload = models.JSONField(default=dict)
    request_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    available_at = models.DateTimeField(default=timezone.now)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)

    class Meta:
        db_table = "outbox_event"
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["available_at"],
                name="outbox_pending",
                condition=models.Q(dispatched_at__isnull=True, failed_at__isnull=True),
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.id}"


class OutboxDelivery(models.Model):
    """One row per (event, handler) that completed, so re-dispatch never repeats a handler."""

    event = models.ForeignKey(OutboxEvent, on_delete=models.CASCADE, related_name="deliveries")
    handler = models.CharField(max_length=200)
    delivered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "outbox_delivery"
        constraints = [
            models.UniqueConstraint(fields=["event", "handler"], name="outbox_delivery_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.handler} ← {self.event_id}"

"""In-app notifications, per-user preferences and quiet hours (F-21)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel

from .catalogue import EVENTS, MODES


class Notification(OrgScopedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    event = models.CharField(max_length=40, choices=[(k, e.label) for k, e in EVENTS.items()])
    title = models.CharField(max_length=300)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=500, blank=True)
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    entity_type = models.CharField(max_length=60, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    # Makes notify() idempotent: re-running a sweep or handler never duplicates (02 §8).
    dedupe_key = models.CharField(max_length=200)
    mode = models.CharField(max_length=8, default="instant")  # resolved delivery at creation
    read_at = models.DateTimeField(null=True, blank=True)
    emailed_at = models.DateTimeField(null=True, blank=True)
    digested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notification"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "dedupe_key"], name="notification_dedupe"),
        ]
        indexes = [models.Index(fields=["user", "read_at"], name="notification_user_unread")]

    def __str__(self) -> str:
        return f"{self.user}: {self.title}"


class NotificationPreference(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences"
    )
    event = models.CharField(max_length=40)
    mode = models.CharField(max_length=8, choices=[(m, m) for m in MODES])

    class Meta:
        db_table = "notification_preference"
        constraints = [
            models.UniqueConstraint(fields=["user", "event"], name="preference_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.user} {self.event}={self.mode}"


class NotificationSettings(models.Model):
    """Quiet hours: instant emails that fall inside them wait for the next digest (DD-021)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_settings"
    )
    quiet_from = models.TimeField(null=True, blank=True)
    quiet_to = models.TimeField(null=True, blank=True)
    last_digest_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "notification_settings"

    def __str__(self) -> str:
        return f"Settings for {self.user}"

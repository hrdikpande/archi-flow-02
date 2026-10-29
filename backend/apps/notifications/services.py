"""notify() and the daily digest (F-21, 03 §18)."""

from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core.exceptions import DomainError
from apps.core.models import OrgSettings

from .catalogue import DIGEST, EVENTS, INSTANT, MODES, OFF
from .email import send_templated_email
from .models import Notification, NotificationPreference, NotificationSettings


def mode_for(user: User, event: str) -> str:
    spec = EVENTS[event]
    if spec.mandatory:
        return spec.default
    pref = (
        NotificationPreference.objects.filter(user=user, event=event)
        .values_list("mode", flat=True)
        .first()
    )
    return pref or spec.default


def in_quiet_hours(user: User, now: datetime | None = None) -> bool:
    s = NotificationSettings.objects.filter(user=user).first()
    if s is None or s.quiet_from is None or s.quiet_to is None:
        return False
    local = (now or timezone.now()).astimezone(ZoneInfo(user.org.timezone)).time()
    if s.quiet_from <= s.quiet_to:
        return s.quiet_from <= local < s.quiet_to
    return local >= s.quiet_from or local < s.quiet_to  # spans midnight


def absolute(link: str) -> str:
    return f"{settings.FRONTEND_URL}{link}" if link.startswith("/") else link


def notify(
    user: User | None,
    event: str,
    *,
    title: str,
    body: str = "",
    link: str = "",
    project: Any = None,
    entity: Any = None,
    dedupe_key: str,
) -> Notification | None:
    """Create one in-app notification (deduplicated) and email it per the user's preference."""
    if user is None or not user.is_active or user.organisation_id is None:
        return None
    if event not in EVENTS:
        raise ValueError(f"Unknown notification event {event}")
    mode = mode_for(user, event)
    if mode == INSTANT and in_quiet_hours(user):
        mode = DIGEST
    try:
        with transaction.atomic():
            notification = Notification.objects.create(
                organisation_id=user.organisation_id,
                user=user,
                event=event,
                title=title[:300],
                body=body,
                link=link,
                project=project,
                dedupe_key=dedupe_key[:200],
                mode=mode,
                entity_type=entity._meta.label_lower if entity is not None else "",
                entity_id=str(entity.pk) if entity is not None else "",
            )
    except IntegrityError:
        return None  # already notified: sweeps and handlers may run twice (02 §8)
    if mode == INSTANT:
        send_templated_email(
            [user.email],
            "notification",
            {"name": user.short_name, "title": title, "body": body, "link": absolute(link)},
        )
        Notification.objects.filter(pk=notification.pk).update(emailed_at=timezone.now())
    return notification


def notify_many(users: Any, event: str, **kwargs: Any) -> int:
    seen: set[Any] = set()
    count = 0
    for user in users:
        if user is None or user.pk in seen:
            continue
        seen.add(user.pk)
        if notify(user, event, **kwargs):
            count += 1
    return count


def set_preferences(user: User, prefs: dict[str, str]) -> None:
    for event, mode in prefs.items():
        spec = EVENTS.get(event)
        if spec is None or mode not in MODES:
            raise DomainError("invalid_preference", f"Unknown event or mode: {event}={mode}.")
        if spec.mandatory and mode != spec.default:
            raise DomainError(
                "mandatory_event", f"“{spec.label}” is required and cannot be changed."
            )
        NotificationPreference.objects.update_or_create(
            user=user, event=event, defaults={"mode": mode}
        )


def mark_read(user: User, ids: list[Any] | None = None) -> int:
    qs = Notification.objects.filter(user=user, read_at__isnull=True)
    if ids is not None:
        qs = qs.filter(pk__in=ids)
    return qs.update(read_at=timezone.now())


def send_due_digests(now: datetime | None = None) -> int:
    """Run every 15 minutes: each user gets one digest a day, after the org's digest time,
    listing only unread digest items (F-21)."""
    now = now or timezone.now()
    sent = 0
    for org_settings in OrgSettings.objects.select_related("organisation"):
        org = org_settings.organisation
        local = now.astimezone(ZoneInfo(org.timezone))
        if local.time() < (org_settings.digest_time or time(8, 30)):
            continue
        pending = (
            Notification.objects.filter(
                organisation=org, mode=DIGEST, digested_at__isnull=True, read_at__isnull=True
            )
            .select_related("user")
            .order_by("user_id", "created_at")
        )
        by_user: dict[Any, list[Notification]] = {}
        for n in pending:
            by_user.setdefault(n.user, []).append(n)
        for user, items in by_user.items():
            settings_row, _ = NotificationSettings.objects.get_or_create(user=user)
            if settings_row.last_digest_on == local.date():
                continue
            send_templated_email(
                [user.email],
                "digest",
                {
                    "name": user.short_name,
                    "date": local.date(),
                    "items": [
                        {"title": i.title, "body": i.body, "link": absolute(i.link)} for i in items
                    ],
                },
            )
            Notification.objects.filter(pk__in=[i.pk for i in items]).update(digested_at=now)
            settings_row.last_digest_on = local.date()
            settings_row.save(update_fields=["last_digest_on"])
            sent += 1
    return sent


__all__ = ["DIGEST", "INSTANT", "OFF", "notify", "notify_many"]

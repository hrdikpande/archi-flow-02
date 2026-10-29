import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.context import get_context

from .models import OutboxDelivery, OutboxEvent
from .registry import handler_name, handlers_for

logger = logging.getLogger(__name__)


def emit(name: str, payload: dict[str, Any], *, organisation_id: Any = None) -> OutboxEvent:
    """Record a domain event in the caller's transaction; dispatch after commit."""
    event = OutboxEvent.objects.create(
        name=name,
        payload=payload,
        organisation_id=organisation_id,
        request_id=get_context().request_id,
    )
    transaction.on_commit(_schedule_dispatch)
    return event


def _schedule_dispatch() -> None:
    from .tasks import dispatch_pending

    try:
        dispatch_pending.delay()
    except Exception:  # broker down: the 30-second safety sweep will pick the event up
        logger.warning("outbox dispatch could not be queued; safety sweep will retry")


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(30 * 2 ** max(attempts - 1, 0), 3600))


def dispatch_one() -> bool:
    """Lock and process the oldest due event. Returns False when nothing is due."""
    with transaction.atomic():
        event = (
            OutboxEvent.objects.select_for_update(skip_locked=True)
            .filter(dispatched_at__isnull=True, failed_at__isnull=True)
            .filter(available_at__lte=timezone.now())
            .order_by("available_at", "created_at")
            .first()
        )
        if event is None:
            return False
        done = set(event.deliveries.values_list("handler", flat=True))
        errors: list[str] = []
        for fn in handlers_for(event.name):
            name = handler_name(fn)
            if name in done:
                continue
            try:
                with transaction.atomic():
                    fn(event)
                    OutboxDelivery.objects.create(event=event, handler=name)
            except Exception as exc:
                logger.exception("outbox handler failed", extra={"event": event.name})
                errors.append(f"{name}: {exc!r}")
        now = timezone.now()
        if errors:
            event.attempts += 1
            event.last_error = "\n".join(errors)[:4000]
            if event.attempts >= settings.OUTBOX_MAX_ATTEMPTS:
                event.failed_at = now
                logger.error("outbox event failed permanently", extra={"event_id": str(event.id)})
            else:
                event.available_at = now + _backoff(event.attempts)
        else:
            event.dispatched_at = now
        event.save(
            update_fields=["attempts", "last_error", "failed_at", "available_at", "dispatched_at"]
        )
        return True


def dispatch_pending(limit: int = 500) -> int:
    processed = 0
    while processed < limit and dispatch_one():
        processed += 1
    return processed

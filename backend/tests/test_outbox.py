"""02 §7: events are durable, dispatched after commit, and each handler runs once."""

from collections.abc import Iterator
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.outbox import registry
from apps.outbox.models import OutboxDelivery, OutboxEvent
from apps.outbox.services import dispatch_one, dispatch_pending, emit

calls: list[str] = []


def ok_handler(event: OutboxEvent) -> None:
    calls.append(f"ok:{event.payload['n']}")


def flaky_handler(event: OutboxEvent) -> None:
    calls.append("flaky")
    raise RuntimeError("boom")


@pytest.fixture(autouse=True)
def handlers() -> Iterator[None]:
    calls.clear()
    registry.handles("test.happened")(ok_handler)
    yield
    registry.unregister("test.happened", ok_handler)
    registry.unregister("test.happened", flaky_handler)


@pytest.mark.django_db
def test_emit_then_dispatch_runs_handler_once(org) -> None:
    emit("test.happened", {"n": 1}, organisation_id=org.pk)
    assert dispatch_pending() == 1
    assert dispatch_pending() == 0  # nothing left: running again is a no-op
    assert calls == ["ok:1"]
    event = OutboxEvent.objects.get()
    assert event.dispatched_at is not None
    assert OutboxDelivery.objects.filter(event=event).count() == 1


@pytest.mark.django_db
def test_dispatch_is_queued_on_commit(org, django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        emit("test.happened", {"n": 7}, organisation_id=org.pk)
    assert len(callbacks) == 1
    assert calls == ["ok:7"]  # eager Celery in tests


@pytest.mark.django_db
def test_failed_handler_retries_without_repeating_successful_ones(org, settings) -> None:
    registry.handles("test.happened")(flaky_handler)
    emit("test.happened", {"n": 2}, organisation_id=org.pk)
    dispatch_one()
    event = OutboxEvent.objects.get()
    assert event.dispatched_at is None
    assert event.attempts == 1
    assert "boom" in event.last_error
    assert event.available_at > timezone.now()

    OutboxEvent.objects.filter(pk=event.pk).update(available_at=timezone.now())
    dispatch_one()
    assert calls == ["ok:2", "flaky", "flaky"]  # ok_handler did not run twice


@pytest.mark.django_db
def test_event_fails_permanently_after_max_attempts(org, settings) -> None:
    settings.OUTBOX_MAX_ATTEMPTS = 2
    registry.unregister("test.happened", ok_handler)
    registry.handles("test.happened")(flaky_handler)
    emit("test.happened", {"n": 3}, organisation_id=org.pk)
    for _ in range(2):
        OutboxEvent.objects.update(available_at=timezone.now() - timedelta(seconds=1))
        dispatch_one()
    event = OutboxEvent.objects.get()
    assert event.failed_at is not None
    assert dispatch_one() is False


@pytest.mark.django_db
def test_event_without_handlers_is_marked_dispatched(org) -> None:
    emit("nobody.listens", {}, organisation_id=org.pk)
    dispatch_pending()
    assert OutboxEvent.objects.get().dispatched_at is not None

from celery import shared_task
from django.utils import timezone

from .models import Heartbeat


@shared_task(name="apps.core.tasks.heartbeat")
def heartbeat() -> None:
    """Proves beat and a worker are alive; /healthz reports staleness (N-05)."""
    Heartbeat.objects.update_or_create(name="beat", defaults={"last_seen": timezone.now()})

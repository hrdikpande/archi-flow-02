"""Railway cron: `python manage.py scheduler_tick` every 5 minutes (instead of a beat service)."""

from typing import Any

from django.core.management.base import BaseCommand

from apps.core.scheduler import tick


class Command(BaseCommand):
    help = "Enqueue every periodic task once (cron alternative to Celery beat)."

    def handle(self, *args: Any, **opts: Any) -> None:
        self.stdout.write(f"queued {len(tick())} periodic tasks")

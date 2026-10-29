from celery import shared_task

from . import services


@shared_task(name="apps.outbox.tasks.dispatch_pending")
def dispatch_pending() -> int:
    return services.dispatch_pending()

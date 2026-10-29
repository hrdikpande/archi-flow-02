from celery import shared_task

from . import services, summary


@shared_task(name="apps.dashboards.tasks.refresh")
def refresh() -> str:
    return services.refresh().isoformat()


@shared_task(name="apps.dashboards.tasks.send_owner_summaries")
def send_owner_summaries() -> int:
    return summary.send_owner_summaries()

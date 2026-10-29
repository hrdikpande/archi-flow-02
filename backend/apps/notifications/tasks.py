from typing import Any

from celery import shared_task

from .email import deliver


@shared_task(
    name="apps.notifications.tasks.send_email",
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=6,
)
def send_email(to: list[str], template: str, context: dict[str, Any]) -> None:
    deliver(to, template, context)


@shared_task(name="apps.notifications.tasks.send_due_digests")
def send_due_digests() -> int:
    from .services import send_due_digests as run

    return run()

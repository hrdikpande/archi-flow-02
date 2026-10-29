from typing import Any

from celery import shared_task

from apps.notifications.email import deliver

from . import services


@shared_task(
    name="apps.transmittals.tasks.send_transmittal_email", bind=True, max_retries=5, queue="email"
)
def send_transmittal_email(
    self: Any, recipient_id: str, to: str, template: str, context: dict[str, Any]
) -> None:
    """Delivered/bounced on the transmittal reflect what actually happened (03 §8)."""
    try:
        deliver([to], template, context)
    except OSError as exc:
        if self.request.retries >= self.max_retries:
            services.mark_bounced(recipient_id, str(exc))
            return
        raise self.retry(exc=exc, countdown=60 * 2**self.request.retries) from exc
    except Exception as exc:  # rejected address etc.: not worth retrying
        services.mark_bounced(recipient_id, str(exc))
        return
    services.mark_delivered(recipient_id)


@shared_task(name="apps.transmittals.tasks.generate_cover", queue="pdf")
def generate_cover(transmittal_id: str) -> None:
    from .cover import ensure_cover

    ensure_cover(transmittal_id)


@shared_task(name="apps.transmittals.tasks.send_notice_email", queue="email")
def send_notice_email(to: str, context: dict[str, Any]) -> None:
    deliver([to], "new_revision", context)

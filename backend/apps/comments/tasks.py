from celery import shared_task

from . import inbound


@shared_task(name="apps.comments.tasks.poll_inbound_mail")
def poll_inbound_mail() -> int:
    return inbound.poll_imap()

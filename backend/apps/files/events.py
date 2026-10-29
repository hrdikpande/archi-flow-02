from django.db import transaction

from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles


@handles("file.uploaded")
def queue_upload_processing(event: OutboxEvent) -> None:
    from .tasks import process_upload

    upload_id = event.payload["upload_id"]
    transaction.on_commit(lambda: process_upload.delay(upload_id))

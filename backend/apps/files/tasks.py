from celery import shared_task

from . import services


@shared_task(
    name="apps.files.tasks.process_upload",
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=5,
)
def process_upload(upload_id: str) -> str:
    return services.process_upload(upload_id).state


@shared_task(name="apps.files.tasks.purge_stale_uploads")
def purge_stale_uploads() -> int:
    return services.purge_stale_uploads()

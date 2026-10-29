from celery import shared_task

from . import services


@shared_task(name="apps.exports.tasks.build_export")
def build_export(job_id: str) -> str:
    try:
        job = services.build(job_id)
    finally:
        from .models import ExportJob

        services.notify_ready(ExportJob.objects.get(pk=job_id))
    return job.state

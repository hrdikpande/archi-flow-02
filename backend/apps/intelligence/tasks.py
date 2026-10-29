from celery import shared_task

from apps.core.models import Organisation

from . import services


@shared_task(name="apps.intelligence.tasks.weekly")
def weekly() -> int:
    """Once per org per week, however often it is triggered (beat or a cron tick)."""
    ran = 0
    for org in Organisation.objects.all():
        if services.due_this_week(org):
            services.weekly(org)
            ran += 1
    return ran

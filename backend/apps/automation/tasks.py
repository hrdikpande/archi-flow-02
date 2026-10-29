from celery import shared_task

from . import engine


@shared_task(name="apps.automation.tasks.run_due_sweeps")
def run_due_sweeps() -> int:
    return len(engine.run_due_sweeps())

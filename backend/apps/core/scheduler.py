"""Cron alternative to Celery beat (Railway cron or Vercel Cron): each tick enqueues every
periodic task. All of them are idempotent and decide for themselves whether work is due
(sweeps once per local day, digests per user's time, the weekly job once a week), so a tick
every 5 minutes gives the same result as beat. The outbox is also dispatched on commit, so
its 30-second safety sweep becoming 5 minutes only delays retries."""

from typing import Any

from celery import current_app

TICK_TASKS = [
    "apps.core.tasks.heartbeat",
    "apps.outbox.tasks.dispatch_pending",
    "apps.automation.tasks.run_due_sweeps",
    "apps.notifications.tasks.send_due_digests",
    "apps.dashboards.tasks.refresh",
    "apps.dashboards.tasks.send_owner_summaries",
    "apps.comments.tasks.poll_inbound_mail",
    "apps.files.tasks.purge_stale_uploads",
    "apps.intelligence.tasks.weekly",
]


def tick() -> list[str]:
    routes: dict[str, Any] = current_app.conf.task_routes or {}
    sent = []
    for name in TICK_TASKS:
        queue = next(
            (r["queue"] for pattern, r in routes.items() if name.startswith(pattern.rstrip("*"))),
            "default",
        )
        current_app.send_task(name, queue=queue)
        sent.append(name)
    return sent

"""Production plumbing for Railway + Vercel: client IP behind proxies, security headers, the
cron alternative to beat, and the weekly-job guard."""

from unittest import mock

import pytest
from django.test import RequestFactory

from apps.core import scheduler
from apps.core.middleware import _client_ip


@pytest.mark.parametrize(
    ("hops", "xff", "expected"),
    [
        (1, "203.0.113.9", "203.0.113.9"),
        (1, "6.6.6.6, 203.0.113.9", "203.0.113.9"),  # a forged first entry is ignored
        (2, "203.0.113.9, 76.76.21.21", "203.0.113.9"),  # Vercel, then the Railway edge
        (2, "6.6.6.6, 203.0.113.9, 76.76.21.21", "203.0.113.9"),
        (2, "203.0.113.9", "10.0.0.1"),  # fewer hops than expected: fall back to the socket
    ],
)
def test_client_ip_counts_trusted_proxies(settings, hops, xff, expected):
    settings.TRUSTED_PROXY_COUNT = hops
    request = RequestFactory().get("/", HTTP_X_FORWARDED_FOR=xff, REMOTE_ADDR="10.0.0.1")
    assert _client_ip(request) == expected


def test_security_headers_on_every_response(client, db):
    response = client.get("/livez")
    assert "default-src 'self'" in response["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in response["Content-Security-Policy"]
    assert response["Permissions-Policy"].startswith("camera=()")


def test_cron_tick_needs_the_secret(client, settings, db):
    settings.CRON_SECRET = ""
    assert client.get("/integrations/cron/tick").status_code == 403  # off without a secret
    settings.CRON_SECRET = "s3cret-value"
    assert (
        client.get("/integrations/cron/tick", HTTP_AUTHORIZATION="Bearer wrong").status_code == 403
    )
    with mock.patch("apps.core.cron.tick", return_value=["x"]) as tick:
        ok = client.get("/integrations/cron/tick", HTTP_AUTHORIZATION="Bearer s3cret-value")
    assert ok.status_code == 200 and ok.json() == {"queued": ["x"]} and tick.called


def test_tick_routes_each_task_to_its_queue():
    with mock.patch.object(scheduler.current_app, "send_task") as send:
        sent = scheduler.tick()
    queues = {c.args[0]: c.kwargs["queue"] for c in send.call_args_list}
    assert len(sent) == len(scheduler.TICK_TASKS)
    assert queues["apps.automation.tasks.run_due_sweeps"] == "sweeps"
    assert queues["apps.notifications.tasks.send_due_digests"] == "email"
    assert queues["apps.files.tasks.purge_stale_uploads"] == "pdf"
    assert queues["apps.outbox.tasks.dispatch_pending"] == "default"


def test_weekly_job_runs_once_per_week_however_often_ticked(org):
    from apps.intelligence.models import ModelRun
    from apps.intelligence.tasks import weekly

    assert weekly() == 1
    runs = ModelRun.objects.count()
    assert weekly() == 0 and ModelRun.objects.count() == runs

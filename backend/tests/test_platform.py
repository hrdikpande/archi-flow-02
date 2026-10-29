"""I-12 email safety, N-05 health and request IDs."""

from datetime import timedelta

import pytest
from django.core import mail
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

from apps.core.models import Heartbeat
from apps.core.tasks import heartbeat
from apps.notifications.email import deliver, email_target_problem

SMTP = "django.core.mail.backends.smtp.EmailBackend"


@pytest.mark.parametrize(
    ("environment", "backend", "host", "blocked"),
    [
        ("staging", SMTP, "smtp.gmail.com", True),
        ("development", SMTP, "mailpit", False),
        ("development", "django.core.mail.backends.console.EmailBackend", "smtp.x.com", False),
        ("production", SMTP, "smtp.firm.example", False),
    ],
)
def test_real_email_only_from_production(settings, environment, backend, host, blocked) -> None:
    settings.ENVIRONMENT, settings.EMAIL_BACKEND, settings.EMAIL_HOST = environment, backend, host
    assert (email_target_problem() is not None) is blocked
    if blocked:
        with pytest.raises(ImproperlyConfigured):
            deliver(["a@b.c"], "test_email", {"name": "A", "organisation": "O"})


def test_test_email_is_sent_after_commit(admin_client, django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=True):
        assert admin_client.post("/api/v1/org/test-email").status_code == 202
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["admin@firm.example"]
    assert "outbound email works" in message.body
    assert message.alternatives[0][1] == "text/html"


def test_healthz_reports_components_and_scheduler(client, db) -> None:
    body = client.get("/healthz").json()
    assert body["status"] == "ok"
    assert body["checks"]["scheduler"] == "unknown"
    heartbeat()
    assert client.get("/healthz").json()["checks"]["scheduler"] == "ok"
    Heartbeat.objects.update(last_seen=timezone.now() - timedelta(hours=1))
    assert client.get("/healthz").json()["checks"]["scheduler"] == "stale"


def test_request_id_is_returned_and_spoofing_is_ignored(client, db) -> None:
    assert len(client.get("/livez")["X-Request-ID"]) == 32
    assert (
        client.get("/livez", HTTP_X_REQUEST_ID="abcd-1234-efgh")["X-Request-ID"] == "abcd-1234-efgh"
    )
    assert client.get("/livez", HTTP_X_REQUEST_ID="<script>")["X-Request-ID"] != "<script>"


def test_errors_have_code_and_detail(admin_client) -> None:
    body = admin_client.post("/api/v1/disciplines", {"code": "", "name": ""}).json()
    assert body["code"] == "invalid"
    assert "code" in body["errors"]


def test_django_admin_login_goes_through_spa(client, db) -> None:
    response = client.get("/django-admin/login/")
    assert response.status_code == 302
    assert response["Location"].endswith("/sign-in?next=/django-admin/")

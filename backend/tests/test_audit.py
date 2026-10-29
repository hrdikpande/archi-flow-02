"""F-39: every change audited with actor, before/after, IP and request ID; rows are insert-only."""

import csv
import io

import pytest
from django.db import connection, transaction
from django.db.utils import InternalError, ProgrammingError

from apps.audit.models import AuditEvent
from apps.audit.services import record
from apps.contacts.services import create_external_org
from apps.core import services
from apps.core.models import Discipline


def test_discipline_change_is_audited_with_diff(admin, admin_client) -> None:
    created = admin_client.post(
        "/api/v1/disciplines", {"code": "q", "name": "Quality"}, HTTP_X_REQUEST_ID="req-12345678"
    )
    assert created.status_code == 201
    assert created.json()["code"] == "Q"
    admin_client.patch(f"/api/v1/disciplines/{created.json()['id']}", {"name": "QA"})

    events = list(AuditEvent.objects.filter(entity_id=created.json()["id"]).order_by("at"))
    assert [e.verb for e in events] == ["discipline.created", "discipline.updated"]
    assert events[0].request_id == "req-12345678"
    assert events[0].actor == admin
    assert events[0].ip == "127.0.0.1"
    assert events[1].before == {"name": "Quality"}
    assert events[1].after == {"name": "QA"}


def test_unchanged_update_writes_no_row(admin, org) -> None:
    discipline = services.create_discipline(admin, code="Z", name="Zone")
    before = AuditEvent.objects.count()
    services.update_discipline(admin, discipline, name="Zone")
    assert AuditEvent.objects.count() == before


@pytest.mark.parametrize("sql", ["UPDATE audit_event SET verb = 'x'", "DELETE FROM audit_event"])
def test_database_blocks_update_and_delete(admin, org, sql: str) -> None:
    record(organisation_id=org.pk, actor=admin, verb="t", entity_type="t", entity_id="1")
    with (
        pytest.raises((InternalError, ProgrammingError)),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(sql)
    assert AuditEvent.objects.filter(verb="t").count() == 1


def test_model_refuses_edit_and_delete(admin, org) -> None:
    event = record(organisation_id=org.pk, actor=admin, verb="t", entity_type="t", entity_id="1")
    event.verb = "changed"
    with pytest.raises(RuntimeError):
        event.save()
    with pytest.raises(RuntimeError):
        event.delete()


def test_export_csv_neutralises_formulas_and_is_audited(admin, admin_client, org) -> None:
    create_external_org(admin, name='=HYPERLINK("http://evil")', kind="client")
    response = admin_client.get("/api/v1/audit/export")
    assert response.status_code == 200
    body = b"".join(response.streaming_content).decode()
    rows = list(csv.reader(io.StringIO(body)))
    assert rows[0][:3] == ["at", "actor", "verb"]
    labels = [r[5] for r in rows[1:]]
    assert any(label.startswith("'") and "HYPERLINK" in label for label in labels)
    assert AuditEvent.objects.filter(verb="audit.exported").exists()


def test_audit_list_filters_and_is_scoped(admin, admin_client, org, other_org, make_user) -> None:
    services.create_discipline(admin, code="Q", name="Quality")
    stranger = make_user("admin", organisation=other_org)
    services.create_discipline(stranger, code="W", name="Water")
    data = admin_client.get("/api/v1/audit", {"verb": "discipline."}).json()
    labels = [e["entity_label"] for e in data["results"]]
    assert labels == ["Q Quality"]


def test_login_and_failed_login_are_audited(admin, org, client) -> None:
    from django.contrib.auth import authenticate

    authenticate(email="admin@firm.example", password="wrong-password")
    assert AuditEvent.objects.filter(verb="auth.login_failed").exists()
    client.force_login(admin)
    assert AuditEvent.objects.filter(verb="auth.login", actor=admin).exists()


def test_discipline_regex_must_compile(admin_client) -> None:
    response = admin_client.post(
        "/api/v1/disciplines", {"code": "R", "name": "Roads", "sheet_prefix_regex": "(["}
    )
    assert response.status_code == 400
    assert not Discipline.objects.filter(code="R").exists()

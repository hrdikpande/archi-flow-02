"""F-21 notifications: catalogue, preferences, mandatory events, digest, quiet hours."""

from datetime import datetime, time
from zoneinfo import ZoneInfo

import time_machine
from django.core import mail

from apps.notifications.models import Notification, NotificationSettings
from apps.notifications.services import notify, send_due_digests

IST = ZoneInfo("Asia/Kolkata")


def test_instant_email_and_dedupe(team, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        notify(
            team.designer,
            "sheet_assigned",
            title="A-101 is assigned to you",
            link="/x",
            dedupe_key="k1",
        )
        notify(
            team.designer,
            "sheet_assigned",
            title="A-101 is assigned to you",
            link="/x",
            dedupe_key="k1",
        )
    assert Notification.objects.count() == 1
    assert [m.subject for m in mail.outbox] == ["A-101 is assigned to you"]


def test_preferences_mandatory_locked(team, client_for):
    client = client_for(team.designer)
    prefs = client.get("/api/v1/notification-preferences").json()
    assigned = next(e for e in prefs["events"] if e["event"] == "sheet_assigned")
    assert assigned == {**assigned, "mandatory": True, "mode": "instant"}
    locked = client.put(
        "/api/v1/notification-preferences", {"modes": {"sheet_assigned": "off"}}, format="json"
    )
    assert locked.status_code == 400 and locked.json()["code"] == "mandatory_event"
    ok = client.put(
        "/api/v1/notification-preferences",
        {"modes": {"sheet_approved": "off"}, "quiet_from": "20:00", "quiet_to": "07:00"},
        format="json",
    ).json()
    assert next(e for e in ok["events"] if e["event"] == "sheet_approved")["mode"] == "off"
    assert ok["quiet_from"] == "20:00:00"


def test_off_means_no_email_but_in_app(team, client_for, django_capture_on_commit_callbacks):
    client_for(team.designer).put(
        "/api/v1/notification-preferences", {"modes": {"sheet_approved": "off"}}, format="json"
    )
    with django_capture_on_commit_callbacks(execute=True):
        notify(team.designer, "sheet_approved", title="Approved", dedupe_key="k2")
    assert mail.outbox == []
    assert (
        client_for(team.designer).get("/api/v1/notifications").json()["results"][0]["title"]
        == "Approved"
    )


def test_daily_digest_lists_only_unread_and_sends_once(team, django_capture_on_commit_callbacks):
    with time_machine.travel(datetime(2026, 10, 26, 7, 0, tzinfo=IST), tick=False):
        notify(team.designer, "sheet_at_risk", title="A-101 at risk", dedupe_key="d1")
        notify(team.designer, "sheet_at_risk", title="A-102 at risk", dedupe_key="d2")
        Notification.objects.filter(dedupe_key="d2").update(read_at=datetime.now(tz=IST))
        assert send_due_digests() == 0  # before 08:30
    with (
        time_machine.travel(datetime(2026, 10, 26, 8, 31, tzinfo=IST), tick=False),
        django_capture_on_commit_callbacks(execute=True),
    ):
        assert send_due_digests() == 1
        assert send_due_digests() == 0
    digest = mail.outbox[-1]
    assert "A-101 at risk" in digest.body and "A-102" not in digest.body


def test_quiet_hours_defer_instant_to_digest(team, django_capture_on_commit_callbacks):
    NotificationSettings.objects.create(user=team.designer, quiet_from=time(20), quiet_to=time(7))
    with (
        time_machine.travel(datetime(2026, 10, 26, 22, 0, tzinfo=IST), tick=False),
        django_capture_on_commit_callbacks(execute=True),
    ):
        n = notify(team.designer, "sheet_returned", title="Returned", dedupe_key="q1")
    assert n.mode == "digest" and mail.outbox == []


def test_workflow_events_notify_the_right_people(team, django_capture_on_commit_callbacks):
    from apps.outbox.services import dispatch_pending
    from apps.workflow.services import transition

    from .workflow_fixtures import new_sheet

    sheet = new_sheet(team)
    transition(sheet, "start", team.designer)
    transition(sheet, "submit", team.designer)
    with django_capture_on_commit_callbacks(execute=True):
        dispatch_pending()
    assert Notification.objects.filter(user=team.checker, event="review_requested").exists()
    transition(sheet, "start_check", team.checker)
    transition(sheet, "return", team.checker, comment="Fix it")
    with django_capture_on_commit_callbacks(execute=True):
        dispatch_pending()
    returned = Notification.objects.get(user=team.designer, event="sheet_returned")
    assert returned.body == "Fix it"


def test_mark_read(team, client_for):
    notify(team.designer, "sheet_approved", title="x", dedupe_key="m1")
    client = client_for(team.designer)
    assert client.get("/api/v1/notification-preferences").json()["unread"] == 1
    client.post("/api/v1/notifications/read", {}, format="json")
    assert client.get("/api/v1/notifications", {"unread": 1}).json()["results"] == []

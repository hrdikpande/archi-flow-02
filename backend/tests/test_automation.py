"""A-01, A-02 sweeps (F-20): idempotent, working-day maths, escalation, missing-run alert."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
import time_machine

from apps.automation.engine import missing_daily_runs, run_due_sweeps, run_rule
from apps.automation.models import AutomationRule, AutomationRun, Flag
from apps.core.models import Holiday, WorkWeek
from apps.notifications.models import Notification
from apps.register.models import SheetState as S

from .workflow_fixtures import new_sheet

IST = ZoneInfo("Asia/Kolkata")


def at(y, m, d, hh=8, mm=5):
    return datetime(y, m, d, hh, mm, tzinfo=IST)


class TestAtRisk:
    @time_machine.travel(at(2026, 10, 26), tick=False)  # Monday
    def test_raises_within_7_working_days_and_is_idempotent(self, team):
        due_soon = new_sheet(team, "A-101", planned_issue_date=date(2026, 11, 3))  # 6 wd
        new_sheet(team, "A-102", planned_issue_date=date(2026, 11, 20))  # far away
        new_sheet(team, "A-103", planned_issue_date=date(2026, 11, 3), state=S.IN_CHECK)
        run_rule(team.org, "A-01")
        run_rule(team.org, "A-01")  # twice: no duplicates
        flags = Flag.objects.filter(kind="at_risk", cleared_at__isnull=True)
        assert [f.sheet_id for f in flags] == [due_soon.pk]
        assert flags.get().data["days"] == 6
        notified = Notification.objects.filter(event="sheet_at_risk")
        assert notified.filter(user=team.designer).count() == 1
        assert AutomationRun.objects.filter(rule="A-01").count() == 2

    @time_machine.travel(at(2026, 10, 26), tick=False)
    def test_holidays_and_saturdays_change_the_count(self, team):
        sheet = new_sheet(team, planned_issue_date=date(2026, 11, 5))  # 8 wd Mon–Fri
        run_rule(team.org, "A-01")
        assert not Flag.objects.filter(sheet=sheet).exists()
        team.org.work_week = WorkWeek.MON_SAT
        team.org.save()
        run_rule(team.org, "A-01")  # Saturday counts: now 9 working days, still outside
        assert not Flag.objects.filter(sheet=sheet).exists()
        team.org.work_week = WorkWeek.MON_FRI
        team.org.save()
        AutomationRule.objects.filter(organisation=team.org, key="A-01").update(
            params={"at_risk_working_days": 7, "states": ["planned", "in_progress"]}
        )
        for d in (27, 28):
            Holiday.objects.create(organisation=team.org, date=date(2026, 10, d), name="Holiday")
        run_rule(team.org, "A-01")  # two holidays: 6 working days → at risk
        assert Flag.objects.get(sheet=sheet).data["days"] == 6

    @time_machine.travel(at(2026, 10, 26), tick=False)
    def test_package_date_is_inherited(self, team):
        from apps.projects.models import Package

        package = Package.objects.create(
            organisation=team.org, project=team.project, name="GFC", planned_date=date(2026, 10, 28)
        )
        sheet = new_sheet(team, package=package)
        run_rule(team.org, "A-01")
        assert Flag.objects.filter(sheet=sheet, kind="at_risk").exists()


class TestLate:
    def test_late_then_escalated_after_3_working_days_then_cleared_on_issue(self, team):
        sheet = new_sheet(team, planned_issue_date=date(2026, 10, 23), state=S.IN_PROGRESS)
        with time_machine.travel(at(2026, 10, 26), tick=False):
            run_rule(team.org, "A-02")
        flag = Flag.objects.get(sheet=sheet, kind="late")
        assert flag.data["days"] == 1
        assert Notification.objects.filter(event="sheet_late", user=team.pl).count() == 1
        with time_machine.travel(at(2026, 10, 28), tick=False):
            run_rule(team.org, "A-02")
        assert "escalated_at" not in Flag.objects.get(pk=flag.pk).data
        with time_machine.travel(at(2026, 10, 29), tick=False):
            run_rule(team.org, "A-02")
            run_rule(team.org, "A-02")
        flag.refresh_from_db()
        assert flag.data["escalated_at"] and flag.data["days"] == 4
        escalations = Notification.objects.filter(user=team.pl, title__startswith="Escalation")
        assert escalations.count() == 1
        sheet.state = S.ISSUED
        sheet.save()
        with time_machine.travel(at(2026, 10, 30), tick=False):
            run_rule(team.org, "A-02")
        flag.refresh_from_db()
        assert flag.cleared_at is not None  # history kept for D-05

    def test_event_clears_flag_without_waiting_for_the_sweep(
        self, team, django_capture_on_commit_callbacks
    ):
        from apps.outbox.services import dispatch_pending
        from apps.workflow.services import transition

        sheet = new_sheet(team, planned_issue_date=date(2026, 10, 30))
        with time_machine.travel(at(2026, 10, 26), tick=False):
            run_rule(team.org, "A-01")
            assert Flag.objects.filter(sheet=sheet, cleared_at__isnull=True).exists()
            transition(sheet, "start", team.designer)
            transition(sheet, "submit", team.designer)  # in check: no longer "at risk"
            with django_capture_on_commit_callbacks(execute=True):
                dispatch_pending()
        assert not Flag.objects.filter(sheet=sheet, cleared_at__isnull=True).exists()


class TestScheduling:
    def test_sweeps_run_once_after_8_local_time(self, team):
        new_sheet(team, planned_issue_date=date(2026, 10, 27))
        with time_machine.travel(at(2026, 10, 26, 6, 50), tick=False):
            assert run_due_sweeps() == []
        with time_machine.travel(at(2026, 10, 26, 7, 50), tick=False):
            assert {r.rule for r in run_due_sweeps()} == {"A-05"}  # Monday 07:00 (03 §10)
        with time_machine.travel(at(2026, 10, 26, 8, 0), tick=False):
            assert {r.rule for r in run_due_sweeps()} == {"A-01", "A-02", "A-07", "A-08", "A-10"}
        with time_machine.travel(at(2026, 10, 26, 8, 15), tick=False):
            assert run_due_sweeps() == []

    def test_missing_run_alert_after_9(self, team, admin):
        with time_machine.travel(at(2026, 10, 26, 8, 30), tick=False):
            assert missing_daily_runs(team.org) == []
        with time_machine.travel(at(2026, 10, 26, 9, 5), tick=False):
            assert set(missing_daily_runs(team.org)) == {"A-01", "A-02", "A-07", "A-08", "A-10"}
            from apps.automation.engine import alert_missing_runs

            assert alert_missing_runs(team.org) == 1
            assert alert_missing_runs(team.org) == 0  # deduplicated
        assert Notification.objects.filter(user=admin, event="sweep_missing").count() == 1

    def test_disabled_rule_does_not_run_or_alert(self, team):
        AutomationRule.objects.create(organisation=team.org, key="A-01", enabled=False)
        with time_machine.travel(at(2026, 10, 26, 9, 30), tick=False):
            assert run_rule(team.org, "A-01") is None
            assert "A-01" not in missing_daily_runs(team.org)


def test_thresholds_api(admin_client, team):
    rules = admin_client.get("/api/v1/automation-rules").json()
    a01 = next(r for r in rules if r["key"] == "A-01")
    assert a01["params"]["at_risk_working_days"] == 7 and a01["schedule"] == "Daily 08:00"
    bad = admin_client.patch(
        f"/api/v1/automation-rules/{a01['id']}",
        {"params": {"at_risk_working_days": -1}},
        format="json",
    )
    assert bad.status_code == 400
    ok = admin_client.patch(
        f"/api/v1/automation-rules/{a01['id']}",
        {"params": {"at_risk_working_days": 5}},
        format="json",
    )
    assert ok.json()["params"]["at_risk_working_days"] == 5


@pytest.mark.parametrize("rule", ["A-01", "A-02"])
def test_run_now_endpoint(admin_client, team, rule):
    rules = admin_client.get("/api/v1/automation-rules").json()
    rid = next(r["id"] for r in rules if r["key"] == rule)
    assert admin_client.post(f"/api/v1/automation-rules/{rid}/run").json()["error"] == ""

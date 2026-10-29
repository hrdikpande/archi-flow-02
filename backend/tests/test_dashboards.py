"""S6: dashboards D-01..D-05, hours reports, weekly owner summary, read-model refresh."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
import time_machine
from django.core.cache import cache
from django.utils import timezone

from apps.accounts.permissions import PermissionDeniedError
from apps.accounts.roles import OrgRole, ProjectRole
from apps.automation.models import Flag, FlagKind
from apps.dashboards import services
from apps.dashboards.events import DEBOUNCE_KEY
from apps.dashboards.models import MetricSnapshot
from apps.dashboards.summary import send_owner_summaries
from apps.notifications.models import Notification
from apps.outbox.services import dispatch_pending, emit
from apps.people import services as people
from apps.people.models import TimeEntry, Timesheet
from apps.projects.models import Project, ProjectMembership, StageState
from apps.register.models import RevisionState, SheetRevision, SheetState
from apps.workflow.models import Review, ReviewKind, ReviewState, StatusTransition

from .workflow_fixtures import new_sheet

IST = ZoneInfo("Asia/Kolkata")


def flag(team, sheet, kind, days=3):
    return Flag.objects.create(
        organisation=team.org,
        entity_type="sheet",
        entity_id=str(sheet.pk),
        kind=kind,
        rule="A-02" if kind == FlagKind.LATE else "A-01",
        project=team.project,
        sheet=sheet,
        raised_at=timezone.now(),
        data={"days": days},
    )


def issue(team, sheet, code="C01", when=None):
    rev = SheetRevision.objects.create(
        organisation=team.org,
        sheet=sheet,
        code=code,
        seq=sheet.revisions.count() + 1,
        state=RevisionState.ISSUED,
        stage=sheet.stage,
        purpose="GFC",
        issued_at=when or timezone.now(),
        issued_by=team.dc,
    )
    sheet.state, sheet.current_revision = SheetState.ISSUED, rev
    sheet.save()
    return rev


@pytest.fixture
def owner(make_user):
    return make_user(OrgRole.OWNER, email="owner@firm.example", name="Nikhil Prasad")


@pytest.fixture
def board(team):
    late = new_sheet(team, "A-101", planned_issue_date=date(2026, 10, 1))
    risky = new_sheet(team, "A-102", planned_issue_date=date(2026, 11, 2))
    done = new_sheet(team, "A-103", planned_issue_date=date(2026, 10, 10))
    flag(team, late, FlagKind.LATE, 5)
    flag(team, risky, FlagKind.AT_RISK, 4)
    issue(team, done, when=datetime(2026, 10, 12, 12, tzinfo=IST))
    services.refresh()
    return late, risky, done


class TestPortfolio:
    def test_counts_rows_and_permissions(self, team, owner, board):
        data = services.portfolio(owner)
        assert (data["late"], data["at_risk"], data["active_projects"]) == (1, 1, 1)
        row = data["projects"][0]
        assert (row["planned"], row["issued"], row["late"]) == (3, 1, 1)
        assert row["leads"] == ["Priya L."] or row["leads"][0].startswith("Priya")
        assert data["updated_at"] is not None
        assert services.portfolio(team.pl)["active_projects"] == 1  # PL: own projects
        with pytest.raises(PermissionDeniedError):
            services.portfolio(team.designer)

    def test_pl_does_not_see_other_projects(self, team, owner, board):
        other = Project.objects.create(organisation=team.org, code="2026-099", name="Other")
        ProjectMembership.objects.create(
            organisation=team.org, project=other, user=team.pl, role=ProjectRole.DESIGNER
        )
        assert [r["project"].code for r in services.portfolio(team.pl)["projects"]] == ["2026-014"]
        assert services.portfolio(owner)["active_projects"] == 2

    def test_delta_vs_last_week(self, team, owner, board):
        week_ago = timezone.localdate() - timedelta(days=7)
        MetricSnapshot.objects.create(organisation=team.org, date=week_ago, key="late", value=4)
        data = services.portfolio(owner)
        assert data["late_delta"] == -3
        assert data["at_risk_delta"] is None  # no snapshot a week ago

    def test_flag_changes_show_after_refresh(self, team, owner, board):
        late, *_ = board
        Flag.objects.filter(sheet=late).update(cleared_at=timezone.now())
        assert services.portfolio(owner)["late"] == 1  # read model is cached …
        services.refresh()
        assert services.portfolio(owner)["late"] == 0  # … until refreshed

    def test_state_change_event_schedules_refresh(self, team, owner, board):
        cache.delete(DEBOUNCE_KEY)
        emit("sheet.state_changed", {"sheet_id": str(board[0].pk)}, organisation_id=team.org.pk)
        dispatch_pending()
        assert cache.get(DEBOUNCE_KEY) == "1"

    def test_discipline_load(self, team, owner):
        people.update_profile(team.dl, team.designer, discipline=team.arch)
        week = people.monday(timezone.localdate())
        people.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[week],
            hours=Decimal("45"),
        )
        services.refresh()
        load = services.portfolio(owner)["discipline_load"]
        arch = next(r for r in load if r["code"] == "A")
        assert len(arch["cells"]) == 4 and arch["cells"][0]["planned_h"] == Decimal("45")


class TestProjectDashboard:
    def test_burn_up_late_list_team_and_scope(self, team, board):
        week = people.monday(timezone.localdate())
        people.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[week],
            hours=Decimal("30"),
        )
        data = services.project_dashboard(team.pl, team.project)
        allseries = data["burn_up"]["series"][0]
        assert allseries["discipline"] == "All" and allseries["total"] == 3
        assert allseries["planned"][-1] == 3
        assert max(v for v in allseries["issued"] if v is not None) == 1
        assert [i["sheet"].number for i in data["late"]] == ["A-101"]
        assert data["team_this_week"][0]["planned_h"] == Decimal("30")
        assert data["by_discipline"][0]["planned"] == 3
        with pytest.raises(PermissionDeniedError):
            services.project_dashboard(team.outsider, team.project)


class TestDisciplineDashboard:
    def test_assignments_queue_capacity(self, team, board):
        _, risky, _ = board
        risky.state, risky.state_changed_at = (
            SheetState.IN_CHECK,
            timezone.now() - timedelta(days=3),
        )
        risky.save()
        people.update_profile(team.dl, team.designer, discipline=team.arch)
        data = services.discipline_dashboard(team.dl, team.arch)
        row = data["assignments"][0]
        assert row["owner"] == team.designer and row["total"] == 2 and row["late"] == 1
        assert [q["sheet"].number for q in data["check_queue"]] == ["A-102"]
        assert data["capacity"][0]["user"] == team.designer
        assert len(data["capacity"][0]["cells"]) == 2  # this week and next
        with pytest.raises(PermissionDeniedError):
            services.discipline_dashboard(team.designer, team.arch)


class TestMyWork:
    def test_due_returned_reviews_and_timesheet(self, team, board):
        _, risky, _ = board
        risky.state = SheetState.CHANGES_REQUESTED
        risky.save()
        StatusTransition.objects.create(
            organisation=team.org,
            sheet=risky,
            action="return",
            from_state=SheetState.IN_CHECK,
            to_state=SheetState.CHANGES_REQUESTED,
            actor=team.checker,
            reason="Fix grid lines",
        )
        data = services.my_work(team.designer)
        assert [d["sheet"].number for d in data["due"]] == ["A-101", "A-102"]
        assert data["due"][0]["next_action"].action == "start"
        assert data["returned"][0]["by"] == team.checker.short_name
        assert data["returned"][0]["reason"] == "Fix grid lines"
        assert data["timesheet"]["capacity_h"] == Decimal("45.0")
        assert data["logs_hours"] is True


class TestBaseline:
    def test_four_metrics_and_definitions(self, team, owner, admin):
        on_time = new_sheet(team, "A-201", planned_issue_date=date(2026, 10, 20))
        late = new_sheet(team, "A-202", planned_issue_date=date(2026, 10, 1))
        issue(team, on_time, when=datetime(2026, 10, 15, 12, tzinfo=IST))
        issue(team, late, when=datetime(2026, 10, 9, 12, tzinfo=IST))
        review = Review.objects.create(
            organisation=team.org,
            sheet=late,
            kind=ReviewKind.CHECK,
            reviewer=team.checker,
            state=ReviewState.APPROVED,
        )
        Review.objects.filter(pk=review.pk).update(
            opened_at=datetime(2026, 10, 5, 10, tzinfo=IST),
            closed_at=datetime(2026, 10, 8, 10, tzinfo=IST),
        )
        sheet = Timesheet.objects.create(
            organisation=team.org, user=team.designer, week=date(2026, 10, 5)
        )
        TimeEntry.objects.create(
            organisation=team.org,
            timesheet=sheet,
            project=team.project,
            stage=team.stage,
            date=date(2026, 10, 6),
            hours=Decimal("8"),
        )
        people.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[date(2026, 10, 5)],
            hours=Decimal("16"),
        )
        data = services.baseline(owner, date(2026, 10, 1), date(2026, 10, 31))
        assert data["issued_late"] == {"sheets": 2, "late": 1, "pct": 50.0}
        assert data["days_in_check"] == {"checks": 1, "average": 3.0}  # Mon→Thu
        assert data["hours_vs_planned"][0]["pct"] == 50
        assert data["invoice_lag"]["average_days"] is None
        assert set(data["definitions"]) == {
            "issued_late",
            "days_in_check",
            "hours_vs_planned",
            "invoice_lag",
        }
        assert (
            services.baseline(admin, date(2026, 10, 1), date(2026, 10, 31))["issued_late"]["late"]
            == 1
        )
        with pytest.raises(PermissionDeniedError):
            services.baseline(team.pl, date(2026, 10, 1), date(2026, 10, 31))

    def test_invoice_lag_from_stage_audit(self, team, owner):
        from apps.projects.services import system_transition_stage

        with time_machine.travel(datetime(2026, 10, 1, 10, tzinfo=IST)):
            team.stage.state = StageState.ACTIVE
            team.stage.save()
            system_transition_stage(team.stage, StageState.DELIVERABLES_ISSUED)
        with time_machine.travel(datetime(2026, 10, 11, 10, tzinfo=IST)):
            team.stage.refresh_from_db()
            team.stage.state = StageState.READY_TO_INVOICE
            team.stage.save()
            system_transition_stage(team.stage, StageState.INVOICED)
        lag = services.baseline(owner, date(2026, 10, 1), date(2026, 10, 31))["invoice_lag"]
        assert lag == {"stages": 1, "average_days": 10.0}


class TestHoursReport:
    def test_groups_and_visibility(self, team, owner, make_user):
        accounts = make_user(OrgRole.ACCOUNTS)
        sheet = Timesheet.objects.create(
            organisation=team.org, user=team.designer, week=date(2026, 10, 5)
        )
        TimeEntry.objects.create(
            organisation=team.org,
            timesheet=sheet,
            project=team.project,
            stage=team.stage,
            date=date(2026, 10, 6),
            hours=Decimal("8"),
        )
        start, end = date(2026, 10, 1), date(2026, 10, 31)
        rows = services.hours_report(accounts, start, end, "stage")["rows"]
        assert rows[0]["label"] == "2026-014 · Working drawings" and rows[0]["logged_h"] == Decimal(
            "8"
        )
        with pytest.raises(PermissionDeniedError):
            services.hours_report(accounts, start, end, "person")
        person = services.hours_report(owner, start, end, "person")["rows"]
        designer = next(r for r in person if r["label"] == team.designer.full_name)
        assert designer["logged_h"] == Decimal("8") and designer["available_h"] > 0
        with pytest.raises(PermissionDeniedError):
            services.hours_report(team.designer, start, end, "project")


class TestOwnerSummary:
    def test_monday_0830_once_per_week(self, team, owner, board):
        with time_machine.travel(datetime(2026, 10, 26, 8, 20, tzinfo=IST), tick=False):
            assert send_owner_summaries() == 0
        with time_machine.travel(datetime(2026, 10, 26, 8, 35, tzinfo=IST), tick=False):
            assert send_owner_summaries() == 1
            assert send_owner_summaries() == 0
        with time_machine.travel(datetime(2026, 10, 27, 8, 35, tzinfo=IST), tick=False):
            assert send_owner_summaries() == 0  # Tuesday
        note = Notification.objects.get(user=owner, event="weekly_owner_summary")
        assert "1 late, 1 at risk" in note.title and "2026-014" in note.body

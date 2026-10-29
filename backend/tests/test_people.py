"""S5: capacity, allocations, workload visibility, timesheets, A-05/A-06 (03 §9)."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
import time_machine

from apps.accounts.permissions import PermissionDeniedError
from apps.accounts.roles import OrgRole, ProjectRole
from apps.automation.engine import run_rule
from apps.automation.models import Flag
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import Holiday
from apps.notifications.models import Notification
from apps.outbox.services import dispatch_pending
from apps.people import services
from apps.people.models import Allocation, Leave, TimeEntry, TimesheetState
from apps.projects.models import Project, ProjectMembership, Stage

IST = ZoneInfo("Asia/Kolkata")
MONDAY = date(2026, 10, 26)


def at(y, m, d, hh=8, mm=5):
    return datetime(y, m, d, hh, mm, tzinfo=IST)


def other_project(team, code="2026-020"):
    project = Project.objects.create(organisation=team.org, code=code, name="Other")
    stage = Stage.objects.create(organisation=team.org, project=project, seq=1, name="Concept")
    return project, stage


class TestCapacity:
    def test_capacity_nets_out_holidays_and_leave(self, team):
        profile = services.profile_for(team.designer)
        assert profile.weekly_capacity_h == Decimal("45")
        cap = services.Capacity(team.org, MONDAY, MONDAY)
        assert cap.hours(profile, MONDAY) == Decimal("45.0")
        Holiday.objects.create(organisation=team.org, date=MONDAY + timedelta(days=2), name="Fest")
        Leave.objects.create(
            organisation=team.org,
            user=team.designer,
            start=MONDAY,
            end=MONDAY + timedelta(days=1),
            type="annual",
        )
        cap = services.Capacity(team.org, MONDAY, MONDAY)
        assert cap.hours(profile, MONDAY) == Decimal("18.0")  # 2 of 5 days left

    def test_part_time_capacity_is_per_person(self, team):
        services.update_profile(team.dl, team.designer, weekly_capacity_h=Decimal("22.5"))
        cap = services.Capacity(team.org, MONDAY, MONDAY)
        assert cap.hours(services.profile_for(team.designer), MONDAY) == Decimal("22.5")

    def test_only_admin_sets_cost_rate_and_designer_cannot_manage(self, team):
        with pytest.raises(DomainError):
            services.update_profile(team.dl, team.designer, cost_rate=Decimal("900"))
        with pytest.raises(PermissionDeniedError):
            services.update_profile(team.designer, team.dc, weekly_capacity_h=Decimal("40"))


class TestAllocations:
    def test_allocate_weeks_in_one_action_then_zero_removes(self, team):
        weeks = [MONDAY + timedelta(weeks=i) for i in range(4)]
        rows = services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=weeks,
            hours=Decimal("20"),
        )
        assert len(rows) == 4
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=weeks[:1],
            hours=Decimal("0"),
        )
        assert Allocation.objects.filter(user=team.designer).count() == 3

    def test_copy_forward(self, team):
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("16"),
        )
        assert services.copy_forward(team.dl, user=team.designer, week=MONDAY, count=3) == 3
        weeks = sorted(Allocation.objects.filter(user=team.designer).values_list("week", flat=True))
        assert weeks == [MONDAY + timedelta(weeks=i) for i in range(4)]

    def test_rules(self, team):
        _, foreign_stage = other_project(team)
        with pytest.raises(PermissionDeniedError):
            services.set_allocations(
                team.designer,
                user=team.designer,
                project=team.project,
                stage=team.stage,
                weeks=[MONDAY],
                hours=Decimal("5"),
            )
        with pytest.raises(DomainError, match="another project"):
            services.set_allocations(
                team.dl,
                user=team.designer,
                project=team.project,
                stage=foreign_stage,
                weeks=[MONDAY],
                hours=Decimal("5"),
            )
        with pytest.raises(DomainError, match="not on this project"):
            services.set_allocations(
                team.dl,
                user=team.outsider,
                project=team.project,
                stage=team.stage,
                weeks=[MONDAY],
                hours=Decimal("5"),
            )


class TestA05:
    @time_machine.travel(at(2026, 10, 27), tick=False)
    def test_flags_recompute_on_allocation_events(self, team):
        """S5 exit: person-week flags recompute on allocation events."""
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("60"),
        )
        dispatch_pending()
        flag = Flag.objects.get(user=team.designer, cleared_at__isnull=True)
        assert flag.kind == "over_allocated" and flag.data["pct"] == 133
        assert Notification.objects.filter(event="allocation_flag", user=team.dl).exists()
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("30"),
        )
        dispatch_pending()
        assert not Flag.objects.filter(user=team.designer, cleared_at__isnull=True).exists()

    @time_machine.travel(at(2026, 10, 26, 7, 30), tick=False)
    def test_weekly_sweep_under_allocated_and_idempotent(self, team):
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("40"),
        )
        run_rule(team.org, "A-05")
        run_rule(team.org, "A-05")
        open_flags = Flag.objects.filter(rule="A-05", cleared_at__isnull=True)
        assert not open_flags.filter(user=team.designer).exists()  # 89%: inside the band
        assert open_flags.filter(user=team.pl, kind="under_allocated").count() == 1  # 0%

    @time_machine.travel(at(2026, 10, 26, 7, 30), tick=False)
    def test_leave_raises_flag_through_capacity_event(self, team):
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("40"),
        )
        dispatch_pending()
        services.add_leave(
            team.dl, team.designer, start=MONDAY, end=MONDAY + timedelta(days=1), type="annual"
        )
        dispatch_pending()  # capacity 27 h → 148%
        assert Flag.objects.get(user=team.designer, cleared_at__isnull=True).data["pct"] == 148


class TestVisibility:
    def test_who_sees_whose_hours(self, team, make_user):
        owner = make_user(OrgRole.OWNER)
        assert set(services.visible_people(team.designer)) == {team.designer}
        assert set(services.visible_people(team.outsider)) == {team.outsider}
        pl_sees = set(services.visible_people(team.pl))
        assert team.designer in pl_sees and team.outsider not in pl_sees
        assert team.outsider in set(services.visible_people(owner))

    def test_dl_sees_discipline(self, team, make_user):
        lead = make_user(OrgRole.STAFF)
        project, _ = other_project(team)
        ProjectMembership.objects.create(
            organisation=team.org,
            project=project,
            user=lead,
            role=ProjectRole.DL,
            discipline=team.arch,
        )
        services.update_profile(lead, team.outsider, discipline=team.arch)
        seen = set(services.visible_people(lead))
        assert team.outsider in seen and team.designer not in seen

    def test_workload_cells_and_bands(self, team):
        services.set_allocations(
            team.dl,
            user=team.designer,
            project=team.project,
            stage=team.stage,
            weeks=[MONDAY],
            hours=Decimal("59.5"),
        )
        data = services.workload(team.pl, MONDAY, MONDAY + timedelta(weeks=1))
        row = next(r for r in data["people"] if r["user"] == team.designer)
        assert [c["pct"] for c in row["cells"]] == [132, 0]
        assert [c["band"] for c in row["cells"]] == ["over", "under"]
        assert all(r["user"] != team.outsider for r in data["people"])


class TestTimesheets:
    def entries(self, team, hours="8"):
        return [
            {"stage": team.stage.pk, "date": MONDAY + timedelta(days=i), "hours": hours}
            for i in range(5)
        ]

    def test_save_submit_lock_approve(self, team):
        sheet = services.timesheet_for(team.designer, MONDAY)
        services.save_entries(team.designer, sheet, self.entries(team))
        assert TimeEntry.objects.filter(timesheet=sheet).count() == 5
        services.submit(team.designer, sheet)
        with pytest.raises(ConflictError):
            services.save_entries(team.designer, sheet, self.entries(team, "1"))
        assert not services.can_approve(team.designer, sheet)
        assert services.approvals_for(team.dl) == [sheet]
        services.approve(team.dl, sheet)
        sheet.refresh_from_db()
        assert sheet.state == TimesheetState.APPROVED and sheet.approved_by == team.dl

    def test_return_needs_reason_and_reopens(self, team):
        sheet = services.timesheet_for(team.designer, MONDAY)
        services.save_entries(team.designer, sheet, self.entries(team))
        services.submit(team.designer, sheet)
        with pytest.raises(DomainError):
            services.return_sheet(team.pl, sheet, "  ")
        services.return_sheet(team.pl, sheet, "Tuesday is on the wrong stage")
        services.save_entries(team.designer, sheet, self.entries(team, "7.5"))
        services.submit(team.designer, sheet)

    def test_entry_rules(self, team):
        sheet = services.timesheet_for(team.designer, MONDAY)
        _, foreign_stage = other_project(team)
        with pytest.raises(DomainError, match="only on projects"):
            services.save_entries(
                team.designer, sheet, [{"stage": foreign_stage.pk, "date": MONDAY, "hours": "2"}]
            )
        with pytest.raises(DomainError, match="outside this week"):
            services.save_entries(
                team.designer,
                sheet,
                [{"stage": team.stage.pk, "date": MONDAY + timedelta(days=7), "hours": "2"}],
            )
        with pytest.raises(DomainError, match="More than 24"):
            services.save_entries(
                team.designer,
                sheet,
                [
                    {"stage": team.stage.pk, "date": MONDAY, "hours": "20"},
                    {"stage": team.stage.pk, "date": MONDAY, "hours": "5"},
                ],
            )
        with pytest.raises(DomainError):
            services.save_entries(team.pl, sheet, self.entries(team))  # someone else's week

    def test_entry_keeps_discipline_at_time_of_entry(self, team):
        services.update_profile(team.dl, team.designer, discipline=team.arch)
        sheet = services.timesheet_for(team.designer, MONDAY)
        services.save_entries(team.designer, sheet, self.entries(team)[:1])
        services.update_profile(team.dl, team.designer, discipline=None)
        assert TimeEntry.objects.get(timesheet=sheet).discipline == team.arch


class TestA06:
    def test_reminder_on_tuesday_then_cleared_by_submit(self, team):
        last_week = MONDAY - timedelta(weeks=1)
        with time_machine.travel(at(2026, 10, 27, 12, 5), tick=False):
            run_rule(team.org, "A-06")
            run_rule(team.org, "A-06")
            flag = Flag.objects.get(
                user=team.designer, kind="timesheet_missing", cleared_at__isnull=True
            )
            assert flag.week == last_week
            assert (
                Notification.objects.filter(event="timesheet_missing", user=team.designer).count()
                == 1
            )
            assert Notification.objects.filter(event="timesheet_missing", user=team.dl).exists()
            sheet = services.timesheet_for(team.designer, last_week)
            services.save_entries(
                team.designer, sheet, [{"stage": team.stage.pk, "date": last_week, "hours": "8"}]
            )
            services.submit(team.designer, sheet)
            dispatch_pending()
            flag.refresh_from_db()
            assert flag.cleared_at is not None


class TestCsvImport:
    def test_all_or_nothing_then_import(self, team, admin):
        bad = (
            b"email,date,project,stage,hours,note\n"
            b"designer@firm.example,2026-10-26,2026-014,Working drawings,8,\n"
            b"nobody@firm.example,2026-10-26,2026-014,Working drawings,8,\n"
        )
        with pytest.raises(ConflictError) as err:
            services.import_csv(admin, bad)
        assert "unknown person" in err.value.extra["errors"][0] or err.value.extra["errors"]
        assert not TimeEntry.objects.exists()
        good = (
            b"email,date,project,stage,hours,note\n"
            b"designer@firm.example,26-10-2026,2026-014,Working drawings,8,Plans\n"
            b"designer@firm.example,27-10-2026,2026-014,4,6.5,\n"
        )
        assert services.import_csv(admin, good) == {"rows": 2, "weeks": 1, "skipped": 0}
        sheet = services.timesheet_for(team.designer, MONDAY)
        assert sheet.state == TimesheetState.SUBMITTED and sheet.imported

    def test_only_admin(self, team):
        with pytest.raises(PermissionDeniedError):
            services.import_csv(team.pl, b"email,date,project,stage,hours\n")


class TestApi:
    def test_week_grid_round_trip(self, team, client_for):
        designer, dl = client_for(team.designer), client_for(team.dl)
        week = designer.get("/api/v1/timesheets/me", {"week": "2026-10-28"}).json()
        assert week["timesheet"]["week"] == "2026-10-26"
        assert [s["stage"] for s in week["stages"]] == [str(team.stage.pk)]
        assert len(week["working_days"]) == 5
        sid = week["timesheet"]["id"]
        body = [{"stage": str(team.stage.pk), "date": "2026-10-26", "hours": "8"}]
        res = designer.put(f"/api/v1/timesheets/{sid}/entries", body, format="json")
        assert res.status_code == 200 and res.json()["total_h"] == "8.0"
        assert designer.post(f"/api/v1/timesheets/{sid}/submit").json()["state"] == "submitted"
        approvals = dl.get("/api/v1/timesheets/approvals", {"week": "2026-10-26"}).json()
        assert [t["id"] for t in approvals["to_approve"]] == [sid]
        assert approvals["to_approve"][0]["can_approve"] is True
        assert dl.post(f"/api/v1/timesheets/{sid}/approve").json()["state"] == "approved"
        # The outsider cannot see the timesheet at all.
        assert (
            client_for(team.outsider).post(f"/api/v1/timesheets/{sid}/approve").status_code == 404
        )

    def test_allocation_and_workload(self, team, client_for):
        dl = client_for(team.dl)
        res = dl.put(
            "/api/v1/allocations",
            {
                "user": str(team.designer.pk),
                "project": str(team.project.pk),
                "stage": str(team.stage.pk),
                "weeks": ["2026-11-02", "2026-11-09"],
                "hours": "30",
            },
            format="json",
        )
        assert res.status_code == 200 and len(res.json()) == 2
        res = dl.post(
            "/api/v1/allocations/copy-forward",
            {"user": str(team.designer.pk), "week": "2026-11-09", "count": 2},
            format="json",
        )
        assert res.json() == {"copied": 2}
        data = dl.get("/api/v1/workload", {"from": "2026-11-02", "to": "2026-11-23"}).json()
        assert len(data["weeks"]) == 4
        row = next(p for p in data["people"] if p["user"]["id"] == str(team.designer.pk))
        assert [c["pct"] for c in row["cells"]] == [67, 67, 67, 67]
        # designer sees only their own row
        mine = client_for(team.designer).get("/api/v1/workload").json()
        assert [p["user"]["id"] for p in mine["people"]] == [str(team.designer.pk)]

    def test_staff_directory_hides_cost_rate(self, team, client_for, admin):
        services.update_profile(admin, team.designer, cost_rate=Decimal("850"))
        rows = client_for(team.pl).get("/api/v1/staff").json()
        assert all(r["cost_rate"] is None for r in rows)
        rows = client_for(admin).get("/api/v1/staff").json()
        assert (
            next(r for r in rows if r["user"]["id"] == str(team.designer.pk))["cost_rate"]
            == "850.00"
        )

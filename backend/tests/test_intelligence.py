"""Phase 4: feature store and G3 (T-09/T-10), late-risk (F-55), workload forecast (F-56),
drawing checks (F-57). Training runs on synthetic history with a planted signal."""

import random
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.permissions import PermissionDeniedError
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import OrgSettings
from apps.intelligence import checks, features, late_risk, services, workload
from apps.intelligence.models import (
    FeatureSnapshot,
    Finding,
    FindingStatus,
    ModelKind,
    ModelRun,
    Prediction,
    RunStatus,
    WorkloadForecast,
)
from apps.people.models import TimeEntry, Timesheet
from apps.register.models import Sheet, SheetRevision, SheetState
from apps.workflow.models import StatusTransition

from .test_titleblock import vector_pdf
from .workflow_fixtures import new_sheet, ready_upload_for


def _transition(team, sheet, at, to, action, frm="in_progress"):
    t = StatusTransition.objects.create(
        organisation=team.org,
        sheet=sheet,
        action=action,
        from_state=frm,
        to_state=to,
        actor=team.designer,
    )
    StatusTransition.objects.filter(pk=t.pk).update(created_at=at)


def build_history(team, n=260, weeks=50, seed=3):
    """Sheets over `weeks`; those returned twice are issued late, the rest on time."""
    rng = random.Random(seed)
    now = timezone.now()
    for i in range(n):
        created = now - timedelta(weeks=weeks) + timedelta(days=rng.randint(0, weeks * 7 - 70))
        planned = (created + timedelta(days=28)).date()
        bad = rng.random() < 0.3
        sheet = new_sheet(
            team,
            f"A-{100 + i:03d}",
            planned_issue_date=planned,
            state=SheetState.ISSUED,
            checker=team.checker,
        )
        Sheet.objects.filter(pk=sheet.pk).update(created_at=created)
        _transition(team, sheet, created + timedelta(days=1), "in_progress", "start", "planned")
        if bad:
            _transition(
                team, sheet, created + timedelta(days=6), "changes_requested", "return", "in_check"
            )
            _transition(
                team,
                sheet,
                created + timedelta(days=9),
                "in_progress",
                "resume",
                "changes_requested",
            )
            _transition(
                team, sheet, created + timedelta(days=13), "changes_requested", "return", "in_check"
            )
            _transition(
                team,
                sheet,
                created + timedelta(days=16),
                "in_progress",
                "resume",
                "changes_requested",
            )
        issued = created + timedelta(days=35 if bad else 24)
        _transition(team, sheet, issued, "issued", "issue", "approved_for_issue")
        rev = SheetRevision.objects.create(
            organisation=team.org,
            sheet=sheet,
            code="C01",
            seq=1,
            state="issued",
            stage=team.stage,
            issued_at=issued,
        )
        SheetRevision.objects.filter(pk=rev.pk).update(created_at=created + timedelta(days=2))


def open_sheet(team, number, returns):
    now = timezone.now()
    sheet = new_sheet(
        team,
        number,
        planned_issue_date=(now + timedelta(days=10)).date(),
        state=SheetState.IN_PROGRESS,
        checker=team.checker,
    )
    Sheet.objects.filter(pk=sheet.pk).update(created_at=now - timedelta(days=18))
    _transition(team, sheet, now - timedelta(days=17), "in_progress", "start", "planned")
    for k in range(returns):
        _transition(
            team, sheet, now - timedelta(days=12 - 3 * k), "changes_requested", "return", "in_check"
        )
        _transition(
            team,
            sheet,
            now - timedelta(days=11 - 3 * k),
            "in_progress",
            "resume",
            "changes_requested",
        )
    return sheet


class TestGateAndFeatureStore:
    def test_before_g3_only_the_feature_store_runs(self, team):
        open_sheet(team, "A-900", 1)
        result = services.weekly(team.org)
        assert result["gate"]["met"] is False and result["snapshots"] == 1
        assert FeatureSnapshot.objects.get().features["returns"] == 1
        assert set(ModelRun.objects.values_list("status", flat=True)) == {RunStatus.SKIPPED}
        assert not Prediction.objects.exists()

    def test_force_is_never_allowed_in_production(self, team, settings):
        settings.ENVIRONMENT = "production"
        with pytest.raises(DomainError):
            services.weekly(team.org, force=True)

    def test_features_do_not_see_the_future(self, team):
        build_history(team, n=20, weeks=20)
        h = features.History(team.org)
        first = min(x.created for x in h.sheets).date() + timedelta(days=3)
        for x, f in h.rows(first):
            # a sheet returned later is not counted as returned on this date
            assert f["returns"] <= sum(1 for t in x.returns if t.date() <= first)


class TestLateRisk:
    def test_learns_the_signal_ranks_and_explains(self, team):
        build_history(team)
        risky, calm = open_sheet(team, "A-990", 2), open_sheet(team, "A-991", 0)
        run = late_risk.train_and_predict(team.org, force=True, gate_info=features.gate(team.org))
        assert run.status == RunStatus.OK and run.training_rows > 200
        assert run.metrics["months"], run.metrics
        assert run.metrics["mean_lift"] is not None
        scores = {p.sheet_id: p for p in Prediction.objects.filter(run=run)}
        assert scores[risky.pk].score > scores[calm.pk].score
        assert any("returned" in r["text"] for r in scores[risky.pk].reasons)
        assert Sheet.objects.get(pk=risky.pk).state == SheetState.IN_PROGRESS  # never changes data

    def test_too_little_history_skips(self, team):
        build_history(team, n=10, weeks=10)
        assert (
            late_risk.train_and_predict(team.org, force=True, gate_info={}).status
            == RunStatus.SKIPPED
        )

    def test_api_and_feedback(self, team, client_for):
        build_history(team)
        open_sheet(team, "A-990", 2)
        late_risk.train_and_predict(team.org, force=True, gate_info=features.gate(team.org))
        rows = client_for(team.pl).get(f"/api/v1/projects/{team.project.pk}/risk").json()
        assert rows and rows[0]["advisory"].startswith("Forecast")
        assert (
            client_for(team.designer).get(f"/api/v1/projects/{team.project.pk}/risk").status_code
            == 403
        )
        res = client_for(team.pl).post(
            f"/api/v1/predictions/{rows[0]['id']}/feedback",
            {"agree": False, "note": "Checker is back tomorrow"},
            format="json",
        )
        assert res.status_code == 204


class TestWorkload:
    def test_forecast_8_weeks_with_mape(self, team):
        from apps.people.services import update_profile

        update_profile(team.dl, team.designer, discipline=team.arch)
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())
        rng = random.Random(1)
        for w in range(1, 25):
            week = monday - timedelta(weeks=w)
            due = rng.randint(0, 6)
            for k in range(due):
                s = new_sheet(
                    team, f"A-{w:02d}{k}", planned_issue_date=week + timedelta(days=7 + k)
                )
                Sheet.objects.filter(pk=s.pk).update(
                    created_at=timezone.now() - timedelta(weeks=w + 3)
                )
            sheet = Timesheet.objects.create(
                organisation=team.org, user=team.designer, week=week, state="approved"
            )
            TimeEntry.objects.create(
                organisation=team.org,
                timesheet=sheet,
                project=team.project,
                stage=team.stage,
                discipline=team.arch,
                date=week,
                hours=Decimal(min(24, 8 + 2 * due)),
            )
        run = workload.train_and_forecast(team.org, force=True, gate_info={})
        assert run.status == RunStatus.OK, run.note
        assert "mape_model" in run.metrics and "A" in run.metrics["mape_by_discipline"]
        rows = WorkloadForecast.objects.filter(run=run, discipline=team.arch)
        assert rows.count() == workload.HORIZON and all(r.hours >= 0 for r in rows)
        assert services.latest_run(team.org.pk, ModelKind.WORKLOAD) == run
        with pytest.raises(PermissionDeniedError):
            services.workload_forecast(team.designer)
        from apps.core.models import Discipline

        expected = workload.HORIZON * Discipline.objects.filter(organisation=team.org).count()
        assert services.workload_forecast(team.dl).count() == expected


class TestDrawingChecks:
    def make(self, team, fake_storage, corner):
        sheet = new_sheet(team, "A-101", title="Ground Floor Plan")
        upload = ready_upload_for(team.designer, "A-101.pdf", sha=f"dc-{corner}")
        fake_storage.objects[upload.file.storage_key] = vector_pdf(
            corner, body="Refer to A-999 and A-102 for details"
        )
        new_sheet(team, "A-102", title="First Floor Plan")
        rev = SheetRevision.objects.create(
            organisation=team.org,
            sheet=sheet,
            code="C02",
            seq=1,
            state="issued",
            stage=team.stage,
            file=upload.file,
            issued_at=timezone.now(),
        )
        return rev

    def test_rules_modes_review_and_rollout_gate(self, team, fake_storage, client_for):
        rev = self.make(team, fake_storage, "GROUND FLOOR PLAN\nSHEET NO A-101\nREV C02")
        assert checks.check_revision(rev.pk) == 0  # off by default
        OrgSettings.objects.filter(organisation=team.org).update(drawing_checks="evaluation")
        assert checks.check_revision(rev.pk) > 0
        rules = set(Finding.objects.values_list("rule", flat=True))
        assert {"TB-DATE", "TB-SCALE", "REF-MISSING", "REF-UNISSUED"} <= rules
        assert "TB-NUMBER" not in rules and "TB-REVISION" not in rules and "TB-TITLE" not in rules
        assert checks.check_revision(rev.pk) == 0  # idempotent
        # In evaluation, findings stay off the sheet page; leads label them in the queue.
        assert client_for(team.dl).get(f"/api/v1/sheets/{rev.sheet_id}/findings").json() == []
        queue = client_for(team.dl).get("/api/v1/intelligence/findings").json()
        assert len(queue) == Finding.objects.count()
        f = Finding.objects.get(rule="REF-MISSING")
        assert (
            client_for(team.dl)
            .post(f"/api/v1/findings/{f.pk}/review", {"accept": True}, format="json")
            .json()["status"]
            == FindingStatus.ACCEPTED
        )
        with pytest.raises(PermissionDeniedError):
            checks.review_finding(team.designer, f, False)
        ev = checks.evaluation(team.org.pk)
        assert ev["precision"] == 1.0 and ev["labelled_sheets"] == 0  # other findings still open
        from apps.accounts.models import User

        admin = User.objects.create_user(
            "a@firm.example", "x-strong-pass-1", organisation=team.org, org_role="admin"
        )
        with pytest.raises(ConflictError):
            checks.set_mode(admin, "on")  # needs 200 labelled sheets

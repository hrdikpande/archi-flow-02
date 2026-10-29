"""M02 acceptance criteria for S2: F-04 sheet register (F-35 number rule, audit, performance)."""

import time

import pytest

from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.models import AuditEvent
from apps.core.models import Discipline
from apps.outbox.models import OutboxEvent
from apps.projects.models import Stage
from apps.register.models import NamingRule, Sheet


@pytest.fixture
def setup(org, project, make_user, add_member, client_for):
    dl, designer = (
        make_user(OrgRole.STAFF, name="Dev Lead"),
        make_user(OrgRole.STAFF, name="Priya Sharma"),
    )
    add_member(dl, ProjectRole.DL)
    add_member(designer, ProjectRole.DESIGNER)
    stage = Stage.objects.create(organisation=org, project=project, seq=4, name="Working drawings")
    arch = Discipline.objects.create(
        organisation=org, code="A", name="Architecture", sheet_prefix_regex=r"^A-\d{3}$"
    )
    return {
        "dl": client_for(dl),
        "designer_user": designer,
        "designer": client_for(designer),
        "stage": stage,
        "arch": arch,
        "project": project,
    }


def _body(s, **extra):
    return {
        "number": "A-101",
        "title": "Ground Floor Plan",
        "discipline": str(s["arch"].pk),
        "stage": str(s["stage"].pk),
        "owner": str(s["designer_user"].pk),
        "planned_issue_date": "2026-10-31",
        **extra,
    }


class TestF04Register:
    def test_dl_adds_sheet_owner_is_notified(self, setup):
        response = setup["dl"].post(f"/api/v1/projects/{setup['project'].pk}/sheets", _body(setup))
        assert response.status_code == 201, response.content
        data = response.json()
        assert (data["state"], data["discipline_code"], data["owner_detail"]["short_name"]) == (
            "planned",
            "A",
            "Priya S",
        )
        assert OutboxEvent.objects.filter(name="sheet.assigned").exists()

    def test_number_rule_and_uniqueness(self, setup):
        url = f"/api/v1/projects/{setup['project'].pk}/sheets"
        bad = setup["dl"].post(url, _body(setup, number="A101"))
        assert bad.status_code == 400
        assert "doesn't match the Architecture rule" in bad.json()["detail"]
        setup["dl"].post(url, _body(setup))
        dup = setup["dl"].post(url, _body(setup))
        assert dup.status_code == 409

    def test_project_naming_rule_overrides_org_rule(self, setup, org):
        project = setup["project"]
        NamingRule.objects.create(
            organisation=org, target="sheet_number", regex=r"^A-1\d\d$", example="A-101"
        )
        url = f"/api/v1/projects/{project.pk}/sheets"
        assert setup["dl"].post(url, _body(setup, number="A-201")).status_code == 400
        NamingRule.objects.create(
            organisation=org,
            project=project,
            target="sheet_number",
            regex=r"^A-\d{3}$",
            example="A-201",
        )
        assert setup["dl"].post(url, _body(setup, number="A-201")).status_code == 201

    def test_owner_must_be_on_the_team(self, setup, make_user):
        stranger = make_user(OrgRole.STAFF)
        response = setup["dl"].post(
            f"/api/v1/projects/{setup['project'].pk}/sheets", _body(setup, owner=str(stranger.pk))
        )
        assert response.status_code == 400
        assert "not on this project's team" in response.json()["detail"]

    def test_every_field_change_is_audited_and_renumber_keeps_alias(self, setup):
        sheet = (
            setup["dl"].post(f"/api/v1/projects/{setup['project'].pk}/sheets", _body(setup)).json()
        )
        setup["dl"].patch(
            f"/api/v1/sheets/{sheet['id']}", {"number": "A-102", "title": "GF Plan"}, format="json"
        )
        event = AuditEvent.objects.filter(verb="sheet.updated").latest("at")
        assert event.before["number"] == "A-101" and event.after["number"] == "A-102"
        assert Sheet.objects.get(pk=sheet["id"]).aliases == ["A-101"]
        found = setup["dl"].get(f"/api/v1/projects/{setup['project'].pk}/sheets", {"q": "A-101"})
        assert [s["number"] for s in found.json()] == ["A-102"]

    def test_designer_edits_only_notes_on_own_sheet(self, setup):
        sheet = (
            setup["dl"].post(f"/api/v1/projects/{setup['project'].pk}/sheets", _body(setup)).json()
        )
        url = f"/api/v1/sheets/{sheet['id']}"
        assert (
            setup["designer"].patch(url, {"notes": "check print sent"}, format="json").status_code
            == 200
        )
        blocked = setup["designer"].patch(url, {"title": "Mine now"}, format="json")
        assert blocked.status_code == 400
        assert blocked.json()["code"] == "field_not_editable"

    def test_filters(self, setup):
        url = f"/api/v1/projects/{setup['project'].pk}/sheets"
        setup["dl"].post(url, _body(setup))
        setup["dl"].post(url, _body(setup, number="A-102", owner=None))
        owned = setup["dl"].get(url, {"owner": str(setup["designer_user"].pk)}).json()
        assert [s["number"] for s in owned] == ["A-101"]
        assert len(setup["dl"].get(url, {"state": "planned"}).json()) == 2

    def test_register_of_1000_sheets_loads_fast(self, setup, org):
        """N-01 at the API: 1,000 sheets serialised well inside the 1 s budget."""
        project = setup["project"]
        Sheet.objects.bulk_create(
            Sheet(
                organisation=org,
                project=project,
                stage=setup["stage"],
                discipline=setup["arch"],
                number=f"A-{i:03d}",
                title=f"Sheet {i}",
            )
            for i in range(1000)
        )
        start = time.perf_counter()
        response = setup["dl"].get(f"/api/v1/projects/{project.pk}/sheets")
        elapsed = time.perf_counter() - start
        assert response.status_code == 200 and len(response.json()) == 1000
        assert elapsed < 1.0, f"register took {elapsed:.2f}s"

    def test_delete_only_by_pl(self, setup, make_user, add_member, client_for):
        sheet = (
            setup["dl"].post(f"/api/v1/projects/{setup['project'].pk}/sheets", _body(setup)).json()
        )
        assert setup["dl"].delete(f"/api/v1/sheets/{sheet['id']}").status_code == 403
        pl = make_user(OrgRole.STAFF)
        add_member(pl, ProjectRole.PL)
        assert client_for(pl).delete(f"/api/v1/sheets/{sheet['id']}").status_code == 204


def test_saved_views_are_private(make_user, client_for, project):
    a, b = client_for(make_user()), client_for(make_user())
    a.post(
        "/api/v1/saved-views", {"name": "My HVAC", "config": {"discipline": ["M"]}}, format="json"
    )
    assert [v["name"] for v in a.get("/api/v1/saved-views").json()] == ["My HVAC"]
    assert b.get("/api/v1/saved-views").json() == []

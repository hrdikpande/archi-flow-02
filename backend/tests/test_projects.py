"""M01 acceptance criteria: F-01 project record, F-02 fee stages, F-49 packages, team."""

from decimal import Decimal

import pytest

from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.models import AuditEvent
from apps.outbox.models import OutboxEvent
from apps.projects.models import Project, ProjectMembership, Stage, StageState, StageTemplate
from apps.projects.services import code_pattern
from apps.register.models import Sheet

from .test_api_permissions import make_sheet


@pytest.fixture
def owner_client(make_user, client_for):
    return client_for(make_user(OrgRole.OWNER, name="Nikhil Prasad"))


@pytest.fixture
def template(org):
    t = StageTemplate.objects.create(organisation=org, name="CoA stages", is_default=True)
    for i, (name, pct) in enumerate([("Concept", 10), ("Preliminary", 10), ("Approvals", 0)]):
        t.items.create(seq=i + 1, name=name, fee_pct=pct)
    return t


class TestF01ProjectRecord:
    def test_owner_creates_project_with_lead_and_cad_tags(self, owner_client, make_user, org):
        lead = make_user(OrgRole.STAFF, name="Priya Sharma")
        body = {
            "code": "2026-014",
            "name": "HSR Block B",
            "type": "hospital",
            "location": "Bengaluru",
            "cad_versions": ["Revit 2024", "AutoCAD 2023"],
            "lead_id": str(lead.pk),
        }
        response = owner_client.post("/api/v1/projects", body, format="json")
        assert response.status_code == 201, response.content
        data = response.json()
        assert data["lead"]["full_name"] == "Priya Sharma"
        assert data["cad_versions"] == ["Revit 2024", "AutoCAD 2023"]
        listed = owner_client.get("/api/v1/projects").json()["results"]
        assert [p["code"] for p in listed] == ["2026-014"]
        assert AuditEvent.objects.filter(verb="project.created").exists()
        assert OutboxEvent.objects.filter(name="project.member_added").exists()

    def test_duplicate_code_is_rejected_with_a_clear_message(self, owner_client, project):
        response = owner_client.post("/api/v1/projects", {"code": project.code, "name": "Again"})
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_code_must_follow_the_org_format(self, owner_client):
        response = owner_client.post("/api/v1/projects", {"code": "HSR-B", "name": "Bad"})
        assert response.status_code == 400
        assert "YYYY-NNN" in response.json()["detail"]

    def test_pl_eligible_staff_creates_and_leads(self, make_user, client_for):
        staff = make_user(OrgRole.STAFF)
        assert (
            client_for(staff)
            .post("/api/v1/projects", {"code": "2026-020", "name": "X"})
            .status_code
            == 403
        )
        staff.can_lead_projects = True
        staff.save()
        response = client_for(staff).post("/api/v1/projects", {"code": "2026-020", "name": "X"})
        assert response.status_code == 201
        assert response.json()["my_role"] == "pl"

    def test_project_with_no_stages_has_no_current_stage(self, owner_client, project):
        assert owner_client.get(f"/api/v1/projects/{project.pk}").json()["current_stage"] is None

    def test_code_pattern(self):
        assert code_pattern("YYYY-NNN").match("2026-014")
        assert not code_pattern("YYYY-NNN").match("2026-14")


class TestF02FeeStages:
    def test_apply_template_creates_editable_stages(self, owner_client, project, template):
        response = owner_client.post(
            f"/api/v1/projects/{project.pk}/stages/apply-template", {"template": str(template.pk)}
        )
        assert response.status_code == 200
        assert [s["name"] for s in response.json()] == ["Concept", "Preliminary", "Approvals"]
        assert all(s["state"] == "planned" for s in response.json())
        project.refresh_from_db()
        assert project.stage_plan_final is False

    def test_final_plan_requires_100_percent(self, owner_client, project):
        url = f"/api/v1/projects/{project.pk}/stages"
        stages = [
            {"seq": 1, "name": "Concept", "fee_pct": "10"},
            {"seq": 2, "name": "Working drawings", "fee_pct": "80"},
        ]
        draft = owner_client.put(url, {"stages": stages, "final": False}, format="json")
        assert draft.status_code == 200
        final = owner_client.put(url, {"stages": stages, "final": True}, format="json")
        assert final.status_code == 400
        assert final.json()["code"] == "fee_total"
        stages[1]["fee_pct"] = "90.00"
        assert (
            owner_client.put(url, {"stages": stages, "final": True}, format="json").status_code
            == 200
        )
        project.refresh_from_db()
        assert project.stage_plan_final is True

    def test_end_before_start_is_rejected(self, owner_client, project):
        stages = [
            {
                "seq": 1,
                "name": "Concept",
                "fee_pct": "100",
                "planned_start": "2026-12-01",
                "planned_end": "2026-11-01",
            }
        ]
        response = owner_client.put(
            f"/api/v1/projects/{project.pk}/stages", {"stages": stages}, format="json"
        )
        assert response.status_code == 400
        assert response.json()["code"] == "end_before_start"

    def test_reorder_and_rename_keeps_ids_and_audits(self, owner_client, project):
        url = f"/api/v1/projects/{project.pk}/stages"
        first = owner_client.put(
            url,
            {
                "stages": [
                    {"seq": 1, "name": "A", "fee_pct": "50"},
                    {"seq": 2, "name": "B", "fee_pct": "50"},
                ]
            },
            format="json",
        ).json()
        a, b = first
        swapped = owner_client.put(
            url,
            {
                "stages": [
                    {"id": a["id"], "seq": 2, "name": "A", "fee_pct": "50"},
                    {"id": b["id"], "seq": 1, "name": "B2", "fee_pct": "50"},
                ]
            },
            format="json",
        ).json()
        assert [(s["id"], s["name"]) for s in swapped] == [(b["id"], "B2"), (a["id"], "A")]
        assert AuditEvent.objects.filter(verb="stage.updated").exists()

    def test_stage_with_sheets_cannot_be_removed(self, owner_client, org, project, admin):
        sheet = make_sheet(org, admin, project)
        response = owner_client.put(
            f"/api/v1/projects/{project.pk}/stages", {"stages": [], "final": False}, format="json"
        )
        assert response.status_code == 409
        assert Stage.objects.filter(pk=sheet.stage_id).exists()

    def test_invoiced_fee_locked_unless_admin(self, owner_client, admin_client, project, org):
        stage = Stage.objects.create(
            organisation=org,
            project=project,
            seq=1,
            name="C",
            fee_pct=Decimal("100"),
            state=StageState.INVOICED,
        )
        body = {"stages": [{"id": str(stage.pk), "seq": 1, "name": "C", "fee_pct": "90"}]}
        url = f"/api/v1/projects/{project.pk}/stages"
        assert owner_client.put(url, body, format="json").json()["code"] == "fee_locked"
        assert admin_client.put(url, body, format="json").status_code == 200

    def test_manual_stage_actions(self, owner_client, project, org):
        stage = Stage.objects.create(organisation=org, project=project, seq=1, name="C")
        url = f"/api/v1/stages/{stage.pk}/transitions"
        assert owner_client.post(url, {"action": "client_approved"}).status_code == 409
        started = owner_client.post(url, {"action": "start"}).json()
        assert started["state"] == "active" and started["actual_start"]
        held = owner_client.post(url, {"action": "hold"}).json()
        assert held["state"] == "on_hold"
        assert owner_client.post(url, {"action": "resume"}).json()["state"] == "active"
        assert AuditEvent.objects.filter(verb="stage.start").exists()


class TestTeam:
    def test_add_member_notifies_via_outbox(self, owner_client, project, make_user):
        person = make_user(OrgRole.STAFF)
        response = owner_client.post(
            f"/api/v1/projects/{project.pk}/members",
            {"user_id": str(person.pk), "role": "designer"},
        )
        assert response.status_code == 201
        event = OutboxEvent.objects.get(name="project.member_added")
        assert event.payload["user_id"] == str(person.pk)
        assert (
            owner_client.post(
                f"/api/v1/projects/{project.pk}/members", {"user_id": str(person.pk), "role": "dc"}
            ).status_code
            == 409
        )

    def test_last_lead_and_open_sheets_are_protected(
        self, owner_client, project, make_user, add_member, org
    ):
        lead = make_user(OrgRole.STAFF)
        membership = add_member(lead, ProjectRole.PL)
        assert owner_client.delete(f"/api/v1/members/{membership.pk}").json()["code"] == "last_lead"
        designer = make_user(OrgRole.STAFF)
        dm = add_member(designer, ProjectRole.DESIGNER)
        make_sheet(org, designer, project)
        assert owner_client.delete(f"/api/v1/members/{dm.pk}").json()["code"] == "has_open_sheets"


class TestF49Packages:
    def test_dl_creates_package_and_sheets_inherit_its_date(
        self, make_user, add_member, client_for, project, org
    ):
        dl = make_user(OrgRole.STAFF)
        add_member(dl, ProjectRole.DL)
        client = client_for(dl)
        package = client.post(
            f"/api/v1/projects/{project.pk}/packages",
            {"name": "HVAC GFC set", "planned_date": "2026-12-15"},
        ).json()
        sheet = make_sheet(org, dl, project)
        moved = client.patch(
            f"/api/v1/sheets/{sheet.pk}", {"package": package["id"]}, format="json"
        )
        assert moved.json()["effective_planned_date"] == "2026-12-15"
        own = client.patch(
            f"/api/v1/sheets/{sheet.pk}", {"planned_issue_date": "2026-12-01"}, format="json"
        )
        assert own.json()["effective_planned_date"] == "2026-12-01"


def test_projects_are_invisible_to_non_members(make_user, client_for, project):
    outsider = client_for(make_user(OrgRole.STAFF))
    assert outsider.get("/api/v1/projects").json()["results"] == []
    assert outsider.get(f"/api/v1/projects/{project.pk}").status_code == 404
    assert outsider.get(f"/api/v1/projects/{project.pk}/sheets").status_code == 404
    assert Project.objects.count() == 1
    assert ProjectMembership.objects.count() == 0
    assert Sheet.objects.count() == 0

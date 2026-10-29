"""S6: F-44 global search and F-45 activity feed."""

from django.utils import timezone

from apps.accounts.roles import ProjectRole
from apps.contacts.models import Contact, ExternalOrg
from apps.core.models import Discipline
from apps.projects.models import Project, ProjectMembership, Stage
from apps.register.models import Sheet
from apps.search.services import search
from apps.transmittals.models import Transmittal
from apps.workflow.services import transition

from .workflow_fixtures import new_sheet


def mech(team):
    return Discipline.objects.create(organisation=team.org, code="M", name="HVAC")


class TestSearch:
    def test_number_title_prefix_and_alias(self, team):
        new_sheet(team, "A-101", title="Ground Floor Plan", aliases=["GF-PLAN"])
        sheet = Sheet.objects.create(
            organisation=team.org,
            project=team.project,
            stage=team.stage,
            discipline=mech(team),
            number="M-205",
            title="OT Ductwork L2",
        )
        assert [s.number for s in search(team.designer, "A-101")["sheets"]] == ["A-101"]
        assert [s.number for s in search(team.designer, "101")["sheets"]] == ["A-101"]
        assert [s.pk for s in search(team.designer, "OT duct")["sheets"]] == [sheet.pk]
        assert [s.number for s in search(team.designer, "gf-plan")["sheets"]] == ["A-101"]
        assert [s.number for s in search(team.designer, "ground floor")["sheets"]] == ["A-101"]

    def test_vector_follows_edits(self, team):
        sheet = new_sheet(team, "A-101", title="Ground Floor Plan")
        sheet.title = "Basement Plan"
        sheet.save()
        assert search(team.designer, "basement")["sheets"] == [sheet]
        assert search(team.designer, "ground")["sheets"] == []

    def test_results_respect_project_access(self, team, other_org, make_user):
        new_sheet(team, "A-101")
        assert search(team.outsider, "A-101")["sheets"] == []
        hidden = Project.objects.create(
            organisation=team.org, code="2026-777", name="Secret Clinic"
        )
        stage = Stage.objects.create(organisation=team.org, project=hidden, seq=1, name="Concept")
        Sheet.objects.create(
            organisation=team.org,
            project=hidden,
            stage=stage,
            discipline=team.arch,
            number="A-101",
            title="Hidden plan",
        )
        assert len(search(team.designer, "A-101")["sheets"]) == 1
        assert search(team.designer, "secret")["projects"] == []
        ProjectMembership.objects.create(
            organisation=team.org, project=hidden, user=team.designer, role=ProjectRole.VIEWER
        )
        assert len(search(team.designer, "A-101")["sheets"]) == 2
        stranger = make_user(organisation=other_org)
        assert search(stranger, "A-101")["sheets"] == []

    def test_projects_transmittals_contacts(self, team):
        Transmittal.objects.create(
            organisation=team.org,
            project=team.project,
            seq=1,
            number="2026-014-TR-0007",
            purpose="GFC",
            sent_at=timezone.now(),
            sent_by=team.dc,
        )
        client = ExternalOrg.objects.create(
            organisation=team.org, name="Apollo Hospitals", kind="client"
        )
        Contact.objects.create(
            organisation=team.org,
            full_name="Kavya Iyer",
            email="kavya@apollo.example",
            external_org=client,
        )
        result = search(team.designer, "TR-0007")
        assert [t.number for t in result["transmittals"]] == ["2026-014-TR-0007"]
        assert [p.code for p in search(team.designer, "HSR")["projects"]] == ["2026-014"]
        assert [c.full_name for c in search(team.designer, "apollo")["contacts"]] == ["Kavya Iyer"]
        assert [c.full_name for c in search(team.designer, "kavya")["contacts"]] == ["Kavya Iyer"]

    def test_short_or_symbol_queries_return_nothing(self, team):
        new_sheet(team, "A-101")
        assert search(team.designer, "a")["sheets"] == []
        assert search(team.designer, "'&|!")["sheets"] == []

    def test_api(self, team, client_for):
        new_sheet(team, "A-101")
        data = client_for(team.designer).get("/api/v1/search", {"q": "A-101"}).json()
        assert data["sheets"][0]["number"] == "A-101"
        assert data["sheets"][0]["project_code"] == "2026-014"


class TestActivity:
    def test_feed_links_filters_and_access(self, team, client_for, make_user):
        sheet = new_sheet(team, "A-101")
        transition(sheet, "start", team.designer)
        other = new_sheet(team, "M-101", discipline=mech(team))
        transition(other, "start", team.pl)
        url = f"/api/v1/projects/{team.project.pk}/activity"
        rows = client_for(team.pl).get(url).json()["results"]
        started = [r for r in rows if r["verb"] == "sheet.start"]
        assert {r["entity_label"].split()[0] for r in started} >= {"A-101", "M-101"}
        mine = next(r for r in started if r["actor"] == team.designer.short_name)
        assert mine["link"] == f"/projects/{team.project.pk}/sheets/{sheet.pk}"
        assert mine["type"] == "state" and "started" in mine["text"]
        by_person = client_for(team.pl).get(url, {"actor": team.designer.pk}).json()["results"]
        assert {r["actor"] for r in by_person} == {team.designer.short_name}
        by_disc = client_for(team.pl).get(url, {"discipline": team.arch.pk}).json()["results"]
        assert all(r["discipline"] == str(team.arch.pk) for r in by_disc)
        from apps.projects.services import add_member

        add_member(team.pl, team.project, user=team.outsider, role=ProjectRole.VIEWER)
        team_only = client_for(team.pl).get(url, {"type": "team"}).json()["results"]
        assert team_only and all(r["type"] == "team" for r in team_only)
        assert team_only[0]["link"] == f"/projects/{team.project.pk}/team"
        stranger = make_user(email="stranger@firm.example")
        assert client_for(stranger).get(url).status_code == 404

    def test_field_edits_are_not_in_the_feed(self, team, client_for):
        from apps.register.services import update_sheet

        sheet = new_sheet(team, "A-101")
        update_sheet(team.pl, sheet, title="Renamed")
        rows = (
            client_for(team.pl)
            .get(f"/api/v1/projects/{team.project.pk}/activity")
            .json()["results"]
        )
        assert all(r["verb"] != "sheet.updated" for r in rows)

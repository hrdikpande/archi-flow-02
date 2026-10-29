"""F-58: 'Searching "OT ceiling HEPA" returns past comments, RFIs and decisions across projects
the user can see, each linked to its sheet.'"""

from datetime import date

import pytest

from apps.accounts.permissions import PermissionDeniedError
from apps.accounts.roles import ProjectRole
from apps.ca import services as ca
from apps.comments import services as comments
from apps.knowledge import services
from apps.projects.models import Project, ProjectMembership

from .workflow_fixtures import new_sheet


@pytest.fixture
def history(team):
    sheet = new_sheet(team, "M-205", title="OT Ductwork L2")
    services.log_decision(
        team.pl,
        team.project,
        title="HEPA in all OT ceilings",
        text="Operating theatre ceilings get terminal HEPA filters (client meeting).",
        decided_on=date(2026, 9, 1),
        decided_by="Client meeting",
        sheets=[sheet],
    )
    comments.log_comment(
        team.pl,
        team.project,
        source="email",
        received_on=date(2026, 9, 3),
        body="Please confirm the OT ceiling HEPA filter grade.",
        sheets=[sheet],
    )
    ca.create_rfi(
        team.dc,
        team.project,
        subject="HEPA housing in OT ceiling",
        question="Access panel size for HEPA housings?",
        received_on=date(2026, 9, 5),
        due_on=date(2026, 9, 12),
        sheets=[sheet],
    )
    other = Project.objects.create(organisation=team.org, code="2026-099", name="Secret")
    services.log_decision(
        _pl_of(team, other),
        other,
        title="OT ceiling HEPA elsewhere",
        text="Not visible to the team",
        decided_on=date(2026, 9, 1),
    )
    return sheet


def _pl_of(team, project):
    ProjectMembership.objects.create(
        organisation=team.org, project=project, user=team.outsider, role=ProjectRole.PL
    )
    return team.outsider


def test_search_finds_decisions_comments_rfis_with_sheets(team, history):
    hits = services.search(team.designer, "OT ceiling HEPA")
    kinds = {h["kind"] for h in hits}
    assert kinds == {"decision", "comment", "rfi"}
    assert all(h["project_code"] == "2026-014" for h in hits)  # the other project is hidden
    assert all(h["sheets"][0]["number"] == "M-205" for h in hits)
    assert "ceilings" in next(h for h in hits if h["kind"] == "decision")["snippet"]
    assert services.search(team.outsider, "OT ceiling HEPA")[0]["project_code"] == "2026-099"
    assert services.search(team.designer, "OT ceiling HEPA", kinds=["rfi"])[0]["kind"] == "rfi"


def test_only_leads_log_decisions(team):
    with pytest.raises(PermissionDeniedError):
        services.log_decision(
            team.designer, team.project, title="x", text="y", decided_on=date(2026, 9, 1)
        )


def test_api(team, history, client_for):
    rows = client_for(team.designer).get("/api/v1/knowledge/search", {"q": "hepa"}).json()
    assert len(rows) == 3 and rows[0]["link"].startswith(f"/projects/{team.project.pk}/")
    res = client_for(team.dl).post(
        f"/api/v1/projects/{team.project.pk}/decisions",
        {"title": "Ceiling grid 600", "text": "Use 600 grid", "decided_on": "2026-09-02"},
        format="json",
    )
    assert res.status_code == 201 and res.json()["number"] == "2026-014-DEC-0002"

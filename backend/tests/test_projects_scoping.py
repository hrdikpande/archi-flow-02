"""F-38: project lists are scoped by membership; Owner and Admin see the whole firm."""

from apps.accounts.roles import OrgRole, ProjectRole
from apps.projects.models import Project, ProjectMembership
from apps.projects.selectors import scope_to_visible_projects, visible_projects


def test_membership_scoping(org, other_org, make_user, add_member, project) -> None:
    second = Project.objects.create(organisation=org, code="2026-009", name="Raipur OPD")
    Project.objects.create(organisation=other_org, code="2026-001", name="Elsewhere")
    designer = make_user(OrgRole.STAFF)
    add_member(designer, ProjectRole.DESIGNER)
    owner, admin, accounts = (
        make_user(r) for r in (OrgRole.OWNER, OrgRole.ADMIN, OrgRole.ACCOUNTS)
    )

    assert list(visible_projects(designer)) == [project]
    assert set(visible_projects(owner)) == {project, second}
    assert set(visible_projects(admin)) == {project, second}
    assert list(visible_projects(accounts)) == []

    memberships = scope_to_visible_projects(ProjectMembership.objects.all(), designer)
    assert {m.project for m in memberships} == {project}


def test_inactive_users_see_nothing(make_user, add_member, project) -> None:
    user = make_user(OrgRole.STAFF)
    add_member(user, ProjectRole.PL)
    user.is_active = False
    assert list(visible_projects(user)) == []

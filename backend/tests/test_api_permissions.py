"""Every API endpoint × every role (F-38, BUILD_PROMPT rule 4).

Roles: the four organisation roles, plus staff holding each project role on the test project.
Allowed calls must not be refused (401/403/404); denied calls must be refused with 403, or 404
when the project is not visible to that user (no information leak).
`test_matrix_covers_every_endpoint` fails when a route is added without a row here.
"""

import datetime as dt
import json
from collections.abc import Callable
from typing import Any

import pytest
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient

from apps.accounts.models import ApiToken, User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.contacts.models import Contact, ExternalOrg
from apps.core.models import Discipline, Holiday, Organisation
from apps.files.models import Upload
from apps.projects.models import Package, Project, ProjectMembership, Stage, StageTemplate
from apps.register.models import ImportJob, SavedView, Sheet

from .permission_matrix_extra import EXTRA_ENDPOINTS

ROLES = ["owner", "admin", "accounts", "staff", "pl", "dl", "designer", "sr", "dc", "viewer"]
PROJECT_ROLE = {
    "pl": ProjectRole.PL,
    "dl": ProjectRole.DL,
    "designer": ProjectRole.DESIGNER,
    "sr": ProjectRole.SENIOR_REVIEWER,
    "dc": ProjectRole.DC,
    "viewer": ProjectRole.VIEWER,
}
ORG_ROLE = {"owner": OrgRole.OWNER, "admin": OrgRole.ADMIN, "accounts": OrgRole.ACCOUNTS}

ALL = set(ROLES)
ADMIN = {"admin"}
AUDIT = {"owner", "admin"}
UPLOADERS = ALL  # UPLOAD_FILES: Owner, Staff, Accounts (DD-008) and Admin for F-54 (DD-028)
CONTACT_EDITORS = {"owner", "admin", "pl", "dl", "dc"}  # DD-007
PROJECT_VIEW = {"owner", "admin", "pl", "dl", "designer", "sr", "dc", "viewer"}
EDIT_STAGES = {"owner", "admin", "pl"}
EDIT_SHEETS = {"pl", "dl"}
CREATE_PROJECT = {"owner", "admin"}

Factory = Callable[[Organisation, User, Project], str]


def _discipline(org: Organisation, user: User, project: Project) -> str:
    return str(Discipline.objects.get_or_create(organisation=org, code="Z", name="Zoning")[0].pk)


def _holiday(org: Organisation, user: User, project: Project) -> str:
    return str(Holiday.objects.create(organisation=org, date=dt.date(2026, 11, 1), name="KR").pk)


def _user(org: Organisation, user: User, project: Project) -> str:
    return str(user.pk)


def _token(org: Organisation, user: User, project: Project) -> str:
    token = ApiToken.objects.create(
        organisation=org,
        user=user,
        name="t",
        key_id="abc123abc123",
        secret_hash="x",
        scopes=["cad_sync:write"],
        expires_at=dt.datetime(2099, 1, 1, tzinfo=dt.UTC),
    )
    return str(token.pk)


def _external_org(org: Organisation, user: User, project: Project) -> str:
    return str(ExternalOrg.objects.create(organisation=org, name="Client Co", kind="client").pk)


def _contact(org: Organisation, user: User, project: Project) -> str:
    return str(Contact.objects.create(organisation=org, full_name="Anil K").pk)


def _upload(org: Organisation, user: User, project: Project) -> str:
    upload = Upload.objects.create(
        organisation=org,
        uploaded_by=user,
        original_name="A-101.pdf",
        declared_size=10,
        content_type="application/pdf",
        staging_key=f"staging/{user.pk}.pdf",
    )
    return str(upload.pk)


def _project(org: Organisation, user: User, project: Project) -> str:
    return str(project.pk)


def _stage(org: Organisation, user: User, project: Project) -> str:
    stage, _ = Stage.objects.get_or_create(
        organisation=org, project=project, seq=1, defaults={"name": "Concept"}
    )
    return str(stage.pk)


def _package(org: Organisation, user: User, project: Project) -> str:
    return str(Package.objects.create(organisation=org, project=project, name="HVAC GFC").pk)


def _member(org: Organisation, user: User, project: Project) -> str:
    other = User.objects.create_user("x@firm.example", "pw-123456789", organisation=org)
    membership = ProjectMembership.objects.create(
        organisation=org, project=project, user=other, role=ProjectRole.VIEWER
    )
    return str(membership.pk)


def make_sheet(org: Organisation, user: User, project: Project, **extra: Any) -> Sheet:
    """Owned by the acting user when they are on the team (so 'own' rules apply)."""
    stage = Stage.objects.get(pk=_stage(org, user, project))
    discipline = Discipline.objects.get(pk=_discipline(org, user, project))
    is_member = ProjectMembership.objects.filter(project=project, user=user).exists()
    defaults: dict[str, Any] = {
        "organisation": org,
        "project": project,
        "stage": stage,
        "discipline": discipline,
        "number": "Z-101",
        "title": "Site plan",
        "owner": user if is_member else None,
    }
    defaults.update(extra)
    return Sheet.objects.create(**defaults)


def _sheet(org: Organisation, user: User, project: Project) -> str:
    return str(make_sheet(org, user, project).pk)


def _template(org: Organisation, user: User, project: Project) -> str:
    return str(StageTemplate.objects.create(organisation=org, name="T").pk)


def _saved_view(org: Organisation, user: User, project: Project) -> str:
    return str(SavedView.objects.create(organisation=org, user=user, name="Mine").pk)


def _import(org: Organisation, user: User, project: Project) -> str:
    job = ImportJob.objects.create(
        organisation=org, project=project, original_name="r.csv", headers=["Number"], rows=[]
    )
    return str(job.pk)


Endpoint = tuple[str, str, set[str], Factory | None, dict[str, Any]]

ENDPOINTS: list[Endpoint] = [
    # S1 platform
    ("GET", "/api/v1/me", ALL, None, {}),
    ("GET", "/api/v1/directory", ALL, None, {}),
    ("GET", "/api/v1/org/settings", ALL, None, {}),
    ("PATCH", "/api/v1/org/settings", ADMIN, None, {"digest_time": "09:00"}),
    ("POST", "/api/v1/org/test-email", ADMIN, None, {}),
    ("GET", "/api/v1/disciplines", ALL, None, {}),
    ("POST", "/api/v1/disciplines", ADMIN, None, {"code": "Q", "name": "Quality"}),
    ("GET", "/api/v1/disciplines/{id}", ALL, _discipline, {}),
    ("PATCH", "/api/v1/disciplines/{id}", ADMIN, _discipline, {"name": "Zones"}),
    ("DELETE", "/api/v1/disciplines/{id}", ADMIN, _discipline, {}),
    ("GET", "/api/v1/holidays", ALL, None, {}),
    ("POST", "/api/v1/holidays", ADMIN, None, {"date": "2026-12-25", "name": "Christmas"}),
    ("GET", "/api/v1/holidays/{id}", ALL, _holiday, {}),
    ("PATCH", "/api/v1/holidays/{id}", ADMIN, _holiday, {"name": "Rajyotsava"}),
    ("DELETE", "/api/v1/holidays/{id}", ADMIN, _holiday, {}),
    ("GET", "/api/v1/users", ADMIN, None, {}),
    ("GET", "/api/v1/users/{id}", ADMIN, _user, {}),
    ("PATCH", "/api/v1/users/{id}", ADMIN, _user, {"full_name": "Renamed"}),
    ("GET", "/api/v1/api-tokens", ADMIN, None, {}),
    ("POST", "/api/v1/api-tokens", ADMIN, None, {"name": "Revit", "scopes": ["cad_sync:write"]}),
    ("POST", "/api/v1/api-tokens/{id}/revoke", ADMIN, _token, {}),
    ("GET", "/api/v1/external-orgs", ALL, None, {}),
    ("POST", "/api/v1/external-orgs", CONTACT_EDITORS, None, {"name": "BBMP", "kind": "authority"}),
    ("GET", "/api/v1/external-orgs/{id}", ALL, _external_org, {}),
    ("PATCH", "/api/v1/external-orgs/{id}", CONTACT_EDITORS, _external_org, {"phone": "080"}),
    ("DELETE", "/api/v1/external-orgs/{id}", CONTACT_EDITORS, _external_org, {}),
    ("GET", "/api/v1/contacts", ALL, None, {}),
    ("POST", "/api/v1/contacts", CONTACT_EDITORS, None, {"full_name": "Ravi", "email": "r@x.in"}),
    ("GET", "/api/v1/contacts/{id}", ALL, _contact, {}),
    ("PATCH", "/api/v1/contacts/{id}", CONTACT_EDITORS, _contact, {"phone": "98450"}),
    ("DELETE", "/api/v1/contacts/{id}", CONTACT_EDITORS, _contact, {}),
    ("GET", "/api/v1/audit", AUDIT, None, {}),
    ("GET", "/api/v1/audit/export", AUDIT, None, {}),
    (
        "POST",
        "/api/v1/uploads/presign",
        UPLOADERS,
        None,
        {"filename": "A-101.pdf", "size": 1000, "content_type": "application/pdf"},
    ),
    ("GET", "/api/v1/uploads/{id}", UPLOADERS, _upload, {}),
    ("POST", "/api/v1/uploads/{id}/complete", UPLOADERS, _upload, {}),
    # S2 projects, stages, packages, team
    ("GET", "/api/v1/projects", ALL, None, {}),
    ("POST", "/api/v1/projects", CREATE_PROJECT, None, {"code": "2026-099", "name": "New"}),
    ("GET", "/api/v1/projects/{id}", PROJECT_VIEW, _project, {}),
    ("PATCH", "/api/v1/projects/{id}", EDIT_STAGES, _project, {"location": "Bengaluru"}),
    ("GET", "/api/v1/projects/{project_pk}/stages", PROJECT_VIEW, None, {}),
    (
        "PUT",
        "/api/v1/projects/{project_pk}/stages",
        EDIT_STAGES,
        None,
        {"stages": [{"seq": 1, "name": "Concept", "fee_pct": "10"}], "final": False},
    ),
    ("POST", "/api/v1/projects/{project_pk}/stages/apply-template", EDIT_STAGES, None, {}),
    ("POST", "/api/v1/stages/{id}/transitions", EDIT_STAGES, _stage, {"action": "start"}),
    ("GET", "/api/v1/projects/{project_pk}/packages", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/packages", EDIT_SHEETS, None, {"name": "Arch GFC"}),
    ("GET", "/api/v1/packages/{id}", PROJECT_VIEW, _package, {}),
    ("PATCH", "/api/v1/packages/{id}", EDIT_SHEETS, _package, {"planned_date": "2026-12-01"}),
    ("DELETE", "/api/v1/packages/{id}", EDIT_SHEETS, _package, {}),
    ("GET", "/api/v1/projects/{project_pk}/members", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/members", EDIT_STAGES, None, {"role": "viewer"}),
    ("PATCH", "/api/v1/members/{id}", EDIT_STAGES, _member, {"role": "dc"}),
    ("DELETE", "/api/v1/members/{id}", EDIT_STAGES, _member, {}),
    ("GET", "/api/v1/stage-templates", ALL, None, {}),
    (
        "POST",
        "/api/v1/stage-templates",
        ADMIN,
        None,
        {"name": "Short", "items": [{"name": "Concept", "fee_pct": "100"}]},
    ),
    ("GET", "/api/v1/stage-templates/{id}", ALL, _template, {}),
    ("PATCH", "/api/v1/stage-templates/{id}", ADMIN, _template, {"name": "Renamed"}),
    ("DELETE", "/api/v1/stage-templates/{id}", ADMIN, _template, {}),
    # S2 register and imports
    ("GET", "/api/v1/projects/{project_pk}/sheets", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/sheets", EDIT_SHEETS, None, {}),
    ("GET", "/api/v1/sheets/{id}", PROJECT_VIEW, _sheet, {}),
    ("PATCH", "/api/v1/sheets/{id}", EDIT_SHEETS | {"designer"}, _sheet, {"notes": "n"}),
    ("DELETE", "/api/v1/sheets/{id}", {"pl"}, _sheet, {}),
    ("GET", "/api/v1/saved-views", ALL, None, {}),
    ("POST", "/api/v1/saved-views", ALL, None, {"name": "Mine", "config": {}}),
    ("PATCH", "/api/v1/saved-views/{id}", ALL, _saved_view, {"name": "Renamed"}),
    ("DELETE", "/api/v1/saved-views/{id}", ALL, _saved_view, {}),
    ("POST", "/api/v1/projects/{project_pk}/imports", EDIT_SHEETS, None, {}),
    ("GET", "/api/v1/imports/template", ALL, None, {}),
    ("GET", "/api/v1/imports/{id}", EDIT_SHEETS, _import, {}),
    ("PATCH", "/api/v1/imports/{id}", EDIT_SHEETS, _import, {"skip_rows": []}),
    ("POST", "/api/v1/imports/{id}/commit", EDIT_SHEETS, _import, {}),
    ("POST", "/api/v1/imports/{id}/undo", EDIT_SHEETS, _import, {}),
    *EXTRA_ENDPOINTS,
]

PUBLIC = {("GET", "/api/v1/auth/csrf")}
AUTHENTICATED_ONLY = {("GET", "/api/v1/schema")}


@pytest.fixture
def actor(make_user: Callable[..., User], add_member: Callable[..., Any]) -> Callable[[str], User]:
    def _actor(role: str) -> User:
        user = make_user(ORG_ROLE.get(role, OrgRole.STAFF), email=f"{role}@firm.example")
        if role in PROJECT_ROLE:
            add_member(user, PROJECT_ROLE[role])
        return user

    return _actor


CASES = [
    pytest.param(method, path, role, role in allowed, factory, body, id=f"{method} {path} {role}")
    for method, path, allowed, factory, body in ENDPOINTS
    for role in ROLES
]


@pytest.mark.parametrize(("method", "path", "role", "allowed", "factory", "body"), CASES)
def test_role_access(
    method: str,
    path: str,
    role: str,
    allowed: bool,
    factory: Factory | None,
    body: dict[str, Any] | Callable[..., dict[str, Any]],
    actor: Callable[[str], User],
    client_for: Callable[[User | None], APIClient],
    org: Organisation,
    project: Project,
    fake_storage: Any,
    django_capture_on_commit_callbacks: Any,
) -> None:
    user = actor(role)
    url = path.replace("{project_pk}", str(project.pk)).replace("{code}", "A")
    if factory:
        url = url.replace("{id}", factory(org, user, project))
    if callable(body):
        body = body(org, user, project)
    data = json.dumps(body).replace('"{code}"', json.dumps(project.code)) if body else ""
    response = client_for(user).generic(method, url, data=data, content_type="application/json")
    if allowed:
        # The endpoint ran: not refused, not mis-routed, body parsed, no server error.
        refused = (401, 403, 404, 405, 415)
        assert response.status_code not in refused, (response.status_code, response.content)
        assert response.status_code < 500, (response.status_code, response.content)
    else:
        assert response.status_code in (403, 404), (response.status_code, response.content)


@pytest.mark.parametrize(("method", "path"), [(e[0], e[1]) for e in ENDPOINTS])
def test_anonymous_is_refused(method: str, path: str, org: Organisation) -> None:
    zero = "00000000-0000-0000-0000-000000000000"
    url = path.replace("{id}", zero).replace("{project_pk}", zero).replace("{code}", "A")
    response = APIClient().generic(method, url, format="json")
    assert response.status_code == 401


def test_public_endpoints() -> None:
    assert APIClient().get("/api/v1/auth/csrf").status_code == 204


def test_schema_requires_sign_in(admin_client: APIClient) -> None:
    assert APIClient().get("/api/v1/schema").status_code in (401, 403)
    assert admin_client.get("/api/v1/schema").status_code == 200


def test_matrix_covers_every_endpoint() -> None:
    schema = SchemaGenerator().get_schema(request=None, public=True)
    routes = {
        (method.upper(), path)
        for path, ops in schema["paths"].items()
        for method in ops
        if method in {"get", "post", "patch", "put", "delete"}
    }
    covered = {(m, p) for m, p, *_ in ENDPOINTS} | PUBLIC | AUTHENTICATED_ONLY
    missing = sorted(routes - covered)
    assert not missing, f"Add role tests for: {missing}"

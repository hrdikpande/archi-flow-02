"""The permission map must match docs/03 §17 cell by cell (F-38).

SPEC is transcribed from the matrix independently of apps/accounts/permissions.py, so a change
to either side without the other fails here. Columns: Owner, PL, DL, Designer, Senior Rev., DC,
Accounts, Admin. "own" means allowed only on the user's own items. External has no account in P1.
"""

from collections.abc import Callable
from typing import Any

import pytest

from apps.accounts.models import User
from apps.accounts.permissions import PERMISSIONS, Action, can, require
from apps.accounts.permissions import PermissionDeniedError as Denied
from apps.accounts.roles import OrgRole, ProjectRole
from apps.projects.models import Project

Y, N, OWN = "Y", "N", "own"
COLUMNS = ["owner", "pl", "dl", "designer", "senior", "dc", "accounts", "admin"]

SPEC: dict[Action, list[str]] = {
    Action.VIEW_PROJECT: [Y, Y, Y, Y, Y, Y, N, Y],  # Accounts: stage data only
    Action.VIEW_STAGE_DATA: [Y, Y, Y, Y, Y, Y, Y, Y],
    Action.EDIT_STAGES: [Y, Y, N, N, N, N, N, Y],
    Action.EDIT_SHEETS: [N, Y, Y, OWN, N, N, N, N],
    Action.START_SUBMIT_SHEET: [N, Y, Y, OWN, N, N, N, N],
    Action.REVIEW_SHEET: [N, Y, Y, N, Y, N, N, N],
    Action.ISSUE_SHEETS: [N, Y, N, N, N, Y, N, N],
    Action.HOLD_CANCEL_SUPERSEDE: [N, Y, N, N, N, N, N, N],
    Action.ALLOCATE_HOURS: [N, Y, Y, N, N, N, N, N],
    Action.LOG_OWN_TIMESHEET: [Y, Y, Y, Y, Y, Y, Y, N],
    Action.APPROVE_TIMESHEETS: [N, Y, Y, N, N, N, N, N],
    Action.LOG_CLIENT_COMMENTS: [N, Y, Y, N, N, Y, N, N],
    Action.RECORD_CLIENT_APPROVAL: [N, Y, N, N, N, N, N, N],
    Action.MARK_INVOICED: [N, N, N, N, N, N, Y, N],
    Action.MANAGE_ORG_SETTINGS: [N, N, N, N, N, N, N, Y],
    Action.EXPORT_AUDIT: [Y, N, N, N, N, N, N, Y],
}

PROJECT_ROLE_FOR = {
    "pl": ProjectRole.PL,
    "dl": ProjectRole.DL,
    "designer": ProjectRole.DESIGNER,
    "senior": ProjectRole.SENIOR_REVIEWER,
    "dc": ProjectRole.DC,
}
ORG_ROLE_FOR = {"owner": OrgRole.OWNER, "accounts": OrgRole.ACCOUNTS, "admin": OrgRole.ADMIN}

CASES = [
    (action, column, expected)
    for action, row in SPEC.items()
    for column, expected in zip(COLUMNS, row, strict=True)
]


@pytest.fixture
def actor_for(
    make_user: Callable[..., User], add_member: Callable[..., Any]
) -> Callable[[str], User]:
    def _actor(column: str) -> User:
        if column in ORG_ROLE_FOR:
            return make_user(ORG_ROLE_FOR[column])
        user = make_user(OrgRole.STAFF)
        add_member(user, PROJECT_ROLE_FOR[column])
        return user

    return _actor


@pytest.mark.parametrize(("action", "column", "expected"), CASES)
def test_matrix_cell(
    action: Action, column: str, expected: str, actor_for: Callable[[str], User], project: Project
) -> None:
    user = actor_for(column)
    on_project = can(user, action, project=project)
    on_own_item = can(user, action, project=project, is_own=True)
    if expected == Y:
        assert on_project, f"{column} should be allowed to {action}"
    elif expected == OWN:
        assert not on_project, f"{column} should only {action} own items"
        assert on_own_item, f"{column} should {action} own items"
    else:
        assert not on_own_item, f"{column} must not {action}"


def test_every_spec_row_is_in_the_map() -> None:
    assert set(SPEC) <= set(PERMISSIONS)


def test_staff_without_membership_sees_nothing(make_user: Callable[..., User], project: Project):
    outsider = make_user(OrgRole.STAFF)
    assert not can(outsider, Action.VIEW_PROJECT, project=project)


def test_other_org_project_is_never_allowed(make_user, other_org, project: Project) -> None:
    owner_elsewhere = make_user(OrgRole.OWNER, organisation=other_org)
    assert not can(owner_elsewhere, Action.VIEW_PROJECT, project=project)


def test_inactive_user_is_denied_everything(make_user: Callable[..., User]) -> None:
    admin = make_user(OrgRole.ADMIN)
    admin.is_active = False
    admin.save()
    assert not any(can(admin, action) for action in Action)


def test_require_raises(make_user: Callable[..., User]) -> None:
    with pytest.raises(Denied):
        require(make_user(OrgRole.STAFF), Action.MANAGE_ORG_SETTINGS)


def test_manage_contacts_via_any_project_role(
    make_user: Callable[..., User], add_member: Callable[..., Any]
) -> None:
    """DD-007: PL, DL or DC on any active project may manage org-wide contacts."""
    lead, designer, nobody = (make_user(OrgRole.STAFF) for _ in range(3))
    add_member(lead, ProjectRole.PL)
    add_member(designer, ProjectRole.DESIGNER)
    assert can(lead, Action.MANAGE_CONTACTS)
    assert not can(designer, Action.MANAGE_CONTACTS)
    assert not can(nobody, Action.MANAGE_CONTACTS)

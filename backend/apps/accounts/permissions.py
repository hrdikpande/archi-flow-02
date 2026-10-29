"""The permission map: the only place that says which roles may do what (03 §17, 02 §11).

Services call `require()` (the source of truth); DRF views declare an `Action` per endpoint and
`ActionPermission` checks it again before the service runs. List querysets are scoped separately
(core.viewsets, projects.selectors).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING

from .roles import OrgRole, ProjectRole

if TYPE_CHECKING:
    from apps.projects.models import Project

    from .models import User


class Action(StrEnum):
    # 03 §17, rows in order.
    VIEW_PROJECT = "view_project"
    VIEW_STAGE_DATA = "view_stage_data"  # Accounts: "stage data only"
    CREATE_PROJECT = "create_project"
    EDIT_STAGES = "edit_stages"
    EDIT_SHEETS = "edit_sheets"
    START_SUBMIT_SHEET = "start_submit_sheet"
    REVIEW_SHEET = "review_sheet"
    ISSUE_SHEETS = "issue_sheets"
    HOLD_CANCEL_SUPERSEDE = "hold_cancel_supersede"
    ALLOCATE_HOURS = "allocate_hours"
    LOG_OWN_TIMESHEET = "log_own_timesheet"
    APPROVE_TIMESHEETS = "approve_timesheets"
    LOG_CLIENT_COMMENTS = "log_client_comments"  # P2
    RECORD_CLIENT_APPROVAL = "record_client_approval"  # P2
    MARK_INVOICED = "mark_invoiced"  # P2
    MANAGE_ORG_SETTINGS = "manage_org_settings"
    EXPORT_AUDIT = "export_audit"
    # Added for S1, not in the 03 §17 matrix (see docs/decisions.md DD-007, DD-008).
    VIEW_ORG_REFERENCE = "view_org_reference"
    MANAGE_CONTACTS = "manage_contacts"
    UPLOAD_FILES = "upload_files"
    # Added in S2-S5 (DD-018, DD-019): rows implied by the spec but not in the matrix.
    UPLOAD_DRAFT = "upload_draft"  # R-07: draft PDFs / check prints
    REOPEN_TERMINAL = "reopen_terminal"  # 03 §3: "Admin can reopen" superseded/cancelled
    MANAGE_STAFF = "manage_staff"  # F-16: "Admin or DL can set capacity and leave"
    # Added in S6 (DD-027): who sees which dashboard and report (03 §11 "Who" column).
    VIEW_PORTFOLIO = "view_portfolio"  # D-01: Owner; PLs see their own projects (DESIGN §3)
    VIEW_BASELINE = "view_baseline"  # D-05: Owner and LatentIQ (support uses an Admin login)
    VIEW_HOURS_REPORT = "view_hours_report"  # 03 §9 reports; Accounts sees totals only
    # Added in S9 (DD-032): S-17 billing signals are the Accounts view; Owner and PLs read them.
    VIEW_BILLING = "view_billing"
    # Added in S12-S16 (DD-034): construction administration has no matrix rows; the logs follow
    # "Log client comments" (PL, DL, DC); submittal review follows "Check, return, approve";
    # change-order approval follows "Record client approval" (PL); site reports any member
    # who works on the project (F-32 "a site architect can file a report from a phone").
    MANAGE_CA = "manage_ca"  # P3: RFIs, submittals, change orders
    REVIEW_SUBMITTAL = "review_submittal"  # P3
    APPROVE_CHANGE_ORDER = "approve_change_order"  # P3
    FILE_SITE_REPORT = "file_site_report"  # P3
    MANAGE_CLASHES = "manage_clashes"  # P3: BCF/Navisworks import and status
    LOG_DECISIONS = "log_decisions"  # P3: knowledge base decision log (F-58)
    # Phase 4 (DD-035): advisory forecasts are for leads; drawing-check findings for checkers.
    VIEW_FORECASTS = "view_forecasts"
    REVIEW_FINDINGS = "review_findings"


ALL_ORG_ROLES = frozenset(OrgRole)
MEMBER_ORG_ROLES = frozenset({OrgRole.OWNER, OrgRole.STAFF, OrgRole.ACCOUNTS})


@dataclass(frozen=True)
class Rule:
    """Who may perform an action.

    org_roles     allowed everywhere by organisation role, no project needed
    project_roles allowed on a project where the user has one of these roles
    own_roles     allowed only on the user's own items on that project (e.g. own sheet)
    any_project_roles  allowed without a project if the user holds one of these roles on *any*
                  active project (used for org-wide records a PL may manage, such as contacts)
    """

    org_roles: frozenset[OrgRole] = frozenset()
    project_roles: frozenset[ProjectRole] = frozenset()
    own_roles: frozenset[ProjectRole] = frozenset()
    any_project_roles: frozenset[ProjectRole] = field(default_factory=frozenset)
    user_flags: frozenset[str] = frozenset()  # boolean User fields that grant the action
    phase: str = "P1"


PL, DL, DES, SR, DC, VIEWER = (
    ProjectRole.PL,
    ProjectRole.DL,
    ProjectRole.DESIGNER,
    ProjectRole.SENIOR_REVIEWER,
    ProjectRole.DC,
    ProjectRole.VIEWER,
)

PERMISSIONS: dict[Action, Rule] = {
    Action.VIEW_PROJECT: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN}),
        project_roles=frozenset({PL, DL, DES, SR, DC, VIEWER}),
    ),
    Action.VIEW_STAGE_DATA: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN, OrgRole.ACCOUNTS}),
        project_roles=frozenset({PL, DL, DES, SR, DC, VIEWER}),
    ),
    # "Create project: Owner, PL-eligible staff (org setting)" (03 §5, R-13).
    Action.CREATE_PROJECT: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN}),
        user_flags=frozenset({"can_lead_projects"}),
    ),
    Action.EDIT_STAGES: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN}), project_roles=frozenset({PL})
    ),
    Action.EDIT_SHEETS: Rule(project_roles=frozenset({PL, DL}), own_roles=frozenset({DES})),
    Action.START_SUBMIT_SHEET: Rule(project_roles=frozenset({PL, DL}), own_roles=frozenset({DES})),
    Action.REVIEW_SHEET: Rule(project_roles=frozenset({PL, DL, SR})),
    Action.ISSUE_SHEETS: Rule(project_roles=frozenset({PL, DC})),
    Action.HOLD_CANCEL_SUPERSEDE: Rule(project_roles=frozenset({PL})),
    Action.ALLOCATE_HOURS: Rule(project_roles=frozenset({PL, DL})),
    Action.LOG_OWN_TIMESHEET: Rule(org_roles=MEMBER_ORG_ROLES),
    Action.APPROVE_TIMESHEETS: Rule(project_roles=frozenset({PL, DL})),
    Action.LOG_CLIENT_COMMENTS: Rule(project_roles=frozenset({PL, DL, DC}), phase="P2"),
    Action.RECORD_CLIENT_APPROVAL: Rule(project_roles=frozenset({PL}), phase="P2"),
    Action.MARK_INVOICED: Rule(org_roles=frozenset({OrgRole.ACCOUNTS}), phase="P2"),
    Action.MANAGE_ORG_SETTINGS: Rule(org_roles=frozenset({OrgRole.ADMIN})),
    Action.EXPORT_AUDIT: Rule(org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN})),
    Action.VIEW_ORG_REFERENCE: Rule(org_roles=ALL_ORG_ROLES),
    Action.MANAGE_CONTACTS: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN}),
        any_project_roles=frozenset({PL, DL, DC}),
    ),
    # DD-008, widened by DD-028: F-54 onboarding needs Admin to upload the historic PDFs.
    Action.UPLOAD_FILES: Rule(org_roles=MEMBER_ORG_ROLES | {OrgRole.ADMIN}),
    Action.UPLOAD_DRAFT: Rule(project_roles=frozenset({PL, DL, DC}), own_roles=frozenset({DES})),
    Action.REOPEN_TERMINAL: Rule(org_roles=frozenset({OrgRole.ADMIN})),
    Action.MANAGE_STAFF: Rule(
        org_roles=frozenset({OrgRole.ADMIN}), any_project_roles=frozenset({DL})
    ),
    Action.VIEW_PORTFOLIO: Rule(
        org_roles=frozenset({OrgRole.OWNER}), any_project_roles=frozenset({PL})
    ),
    Action.VIEW_BASELINE: Rule(org_roles=frozenset({OrgRole.OWNER, OrgRole.ADMIN})),
    Action.MANAGE_CA: Rule(project_roles=frozenset({PL, DL, DC}), phase="P3"),
    Action.REVIEW_SUBMITTAL: Rule(project_roles=frozenset({PL, DL, SR}), phase="P3"),
    Action.APPROVE_CHANGE_ORDER: Rule(project_roles=frozenset({PL}), phase="P3"),
    Action.FILE_SITE_REPORT: Rule(project_roles=frozenset({PL, DL, DES, SR, DC}), phase="P3"),
    Action.MANAGE_CLASHES: Rule(project_roles=frozenset({PL, DL}), phase="P3"),
    Action.LOG_DECISIONS: Rule(project_roles=frozenset({PL, DL}), phase="P3"),
    Action.VIEW_FORECASTS: Rule(
        org_roles=frozenset({OrgRole.OWNER}),
        project_roles=frozenset({PL, DL}),
        any_project_roles=frozenset({PL, DL}),
        phase="P4",
    ),
    Action.REVIEW_FINDINGS: Rule(project_roles=frozenset({PL, DL, SR, DC}), phase="P4"),
    Action.VIEW_BILLING: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ACCOUNTS}), any_project_roles=frozenset({PL})
    ),
    Action.VIEW_HOURS_REPORT: Rule(
        org_roles=frozenset({OrgRole.OWNER, OrgRole.ACCOUNTS}),
        any_project_roles=frozenset({PL, DL}),
    ),
}


class PermissionDeniedError(Exception):
    """Raised by services; mapped to HTTP 403 by the API exception handler."""

    def __init__(self, action: Action, message: str = "") -> None:
        self.action = action
        super().__init__(message or f"You are not allowed to {action.value.replace('_', ' ')}.")


def can(
    user: User | None,
    action: Action,
    *,
    project: Project | None = None,
    is_own: bool = False,
) -> bool:
    if user is None or not user.is_authenticated or not user.is_active:
        return False
    if user.organisation_id is None:
        return False
    if project is not None and project.organisation_id != user.organisation_id:
        return False  # checked before any org-role grant: never cross organisations
    rule = PERMISSIONS[action]
    if user.org_role in rule.org_roles:
        return True
    if any(getattr(user, flag, False) for flag in rule.user_flags):
        return True
    if project is not None:
        role = project_role(user, project)
        if role is None:
            return False
        return role in rule.project_roles or (is_own and role in rule.own_roles)
    if rule.any_project_roles:
        from apps.projects.models import ProjectMembership

        return ProjectMembership.objects.filter(
            user=user, role__in=rule.any_project_roles, project__status="active"
        ).exists()
    return False


def require(
    user: User | None,
    action: Action,
    *,
    project: Project | None = None,
    is_own: bool = False,
) -> None:
    if not can(user, action, project=project, is_own=is_own):
        raise PermissionDeniedError(action)


def project_role(user: User, project: Project) -> ProjectRole | None:
    from apps.projects.models import ProjectMembership

    role = (
        ProjectMembership.objects.filter(user=user, project=project)
        .values_list("role", flat=True)
        .first()
    )
    return ProjectRole(role) if role else None

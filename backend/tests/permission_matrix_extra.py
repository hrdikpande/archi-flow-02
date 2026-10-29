"""Endpoint rows added by later sprints (S2 onward) are appended here to keep the main
matrix readable. Same shape as ENDPOINTS in test_api_permissions.py; a body may be a callable
(org, user, project) -> dict when it needs objects created for the acting user."""

from datetime import date as dt_date
from typing import Any

from apps.files.models import FileObject
from apps.register.models import NamingRule, Sheet, SheetState
from apps.workflow.models import Review, ReviewKind

ALL = {"owner", "admin", "accounts", "staff", "pl", "dl", "designer", "sr", "dc", "viewer"}
ADMIN = {"admin"}
PROJECT_VIEW = {"owner", "admin", "pl", "dl", "designer", "sr", "dc", "viewer"}
EDIT_STAGES = {"owner", "admin", "pl"}
EDIT_SHEETS = {"pl", "dl"}
REVIEWERS = {"pl", "dl", "sr"}
UPLOAD_DRAFT = {"pl", "dl", "dc", "designer"}  # designer on own sheet (DD-018)


def _with_letter(org: Any, user: Any, project: Any) -> str:
    """Side effect only: give the project an appointment letter."""
    project.appointment_letter = FileObject.objects.create(
        organisation=org,
        storage_key=f"files/{project.pk}.pdf",
        sha256="a" * 64,
        size=1,
        mime="application/pdf",
        original_name="letter.pdf",
    )
    project.save()
    return ""


def _sheet(org: Any, user: Any, project: Any) -> str:
    from .test_api_permissions import make_sheet

    return str(make_sheet(org, user, project).pk)


def _sheet_in_check(org: Any, user: Any, project: Any) -> Sheet:
    from .test_api_permissions import make_sheet

    return make_sheet(org, user, project, state=SheetState.IN_CHECK, review_round=1)


def _review(org: Any, user: Any, project: Any) -> str:
    sheet = _sheet_in_check(org, user, project)
    review = Review.objects.create(
        organisation=org, sheet=sheet, kind=ReviewKind.CHECK, round=1, reviewer=user
    )
    return str(review.pk)


def _revision(org: Any, user: Any, project: Any) -> str:
    from .test_api_permissions import make_sheet
    from .workflow_fixtures import ready_upload_for

    sheet = make_sheet(org, user, project)
    upload = ready_upload_for(user, "Z-101.pdf")
    revision = sheet.revisions.create(
        organisation=org, code="P01", seq=1, file=upload.file, original_name="Z-101.pdf"
    )
    return str(revision.pk)


def _org_rule(org: Any, user: Any, project: Any) -> str:
    return str(
        NamingRule.objects.create(organisation=org, target="file_name", regex=".*", example="x").pk
    )


def _draft_body(org: Any, user: Any, project: Any) -> dict[str, Any]:
    from .workflow_fixtures import ready_upload_for

    return {"upload_id": str(ready_upload_for(user, "Z-101.pdf").pk)}


def _redline_body(org: Any, user: Any, project: Any) -> dict[str, Any]:
    from .workflow_fixtures import ready_upload_for

    return {"upload_ids": [str(ready_upload_for(user, "redline.pdf", kind="document").pk)]}


def _letter_body(org: Any, user: Any, project: Any) -> dict[str, Any]:
    from .workflow_fixtures import ready_upload_for

    return {"upload_id": str(ready_upload_for(user, "letter.pdf", pages=4, kind="document").pk)}


def _bulk_body(org: Any, user: Any, project: Any) -> dict[str, Any]:
    return {
        "sheet_ids": [_sheet(org, user, project)],
        "op": "set_planned_date",
        "value": "2026-12-01",
    }


EXTRA_ENDPOINTS: list[Any] = [
    # S2
    ("GET", "/api/v1/projects/{project_pk}/appointment-letter", PROJECT_VIEW, _with_letter, {}),
    ("POST", "/api/v1/projects/{project_pk}/appointment-letter", EDIT_STAGES, None, _letter_body),
    # S3 workflow, revisions, reviews, naming rules, bulk
    ("GET", "/api/v1/sheets/{id}/detail", PROJECT_VIEW, _sheet, {}),
    ("GET", "/api/v1/sheets/{id}/timeline", PROJECT_VIEW, _sheet, {}),
    ("GET", "/api/v1/sheets/{id}/reviews", PROJECT_VIEW, _sheet, {}),
    ("POST", "/api/v1/sheets/{id}/transitions", PROJECT_VIEW, _sheet, {"action": "start"}),
    ("GET", "/api/v1/sheets/{id}/revisions", PROJECT_VIEW, _sheet, {}),
    ("POST", "/api/v1/sheets/{id}/revisions", UPLOAD_DRAFT, _sheet, _draft_body),
    ("GET", "/api/v1/revisions/{id}/download", PROJECT_VIEW, _revision, {}),
    ("GET", "/api/v1/reviews", ALL, None, {}),
    ("POST", "/api/v1/reviews/{id}/approve", REVIEWERS, _review, {}),
    ("POST", "/api/v1/reviews/{id}/return", REVIEWERS, _review, {"comment": "Fix grid C"}),
    ("POST", "/api/v1/reviews/{id}/redlines", REVIEWERS, _review, _redline_body),
    ("GET", "/api/v1/naming-rules", ALL, None, {}),
    (
        "POST",
        "/api/v1/naming-rules",
        ADMIN,
        None,
        {"target": "file_name", "regex": ".*", "example": "A-101.pdf"},
    ),
    ("GET", "/api/v1/naming-rules/{id}", ALL, _org_rule, {}),
    ("PATCH", "/api/v1/naming-rules/{id}", ADMIN, _org_rule, {"example": "A-102.pdf"}),
    ("DELETE", "/api/v1/naming-rules/{id}", ADMIN, _org_rule, {}),
    ("POST", "/api/v1/naming-rules/test", ALL, None, {"target": "file_name", "value": "x.pdf"}),
    ("POST", "/api/v1/projects/{project_pk}/sheets/bulk", EDIT_SHEETS, None, _bulk_body),
]


# --- S4: transmittals, notifications, automation ---------------------------------------------

ISSUERS = {"pl", "dc"}


def _issue_body(org: Any, user: Any, project: Any) -> dict[str, Any]:
    from apps.contacts.models import Contact

    from .test_api_permissions import make_sheet
    from .workflow_fixtures import ready_upload_for

    sheet = make_sheet(org, user, project, state=SheetState.APPROVED_FOR_ISSUE)
    upload = ready_upload_for(user, "Z-101.pdf", sha=f"issue{sheet.pk}")
    sheet.revisions.create(
        organisation=org,
        code="P01",
        seq=1,
        file=upload.file,
        original_name="Z-101.pdf",
        naming_status="ok",
    )
    contact = Contact.objects.create(organisation=org, full_name="Client", email="c@x.in")
    return {"sheet_ids": [str(sheet.pk)], "purpose": "GFC", "contact_ids": [str(contact.pk)]}


def _transmittal(org: Any, user: Any, project: Any) -> Any:
    from django.utils import timezone

    from apps.transmittals.models import Transmittal

    return Transmittal.objects.create(
        organisation=org,
        project=project,
        seq=1,
        number=f"{project.code}-TR-0001",
        purpose="GFC",
        sent_at=timezone.now(),
        sent_by=user,
    )


def _transmittal_id(org: Any, user: Any, project: Any) -> str:
    return str(_transmittal(org, user, project).pk)


def _recipient(org: Any, user: Any, project: Any) -> str:
    from apps.contacts.models import Contact
    from apps.transmittals.models import TransmittalRecipient

    contact = Contact.objects.create(organisation=org, full_name="Client", email="c@x.in")
    return str(
        TransmittalRecipient.objects.create(
            transmittal=_transmittal(org, user, project), contact=contact
        ).pk
    )


def _rule(org: Any, user: Any, project: Any) -> str:
    from apps.automation.engine import rule_config

    return str(rule_config(org, "A-01").pk)


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/projects/{project_pk}/transmittals", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/transmittals", ISSUERS, None, _issue_body),
    ("POST", "/api/v1/projects/{project_pk}/transmittals/preview", ISSUERS, None, _issue_body),
    (
        "POST",
        "/api/v1/projects/{project_pk}/transmittals/cover-preview",
        ISSUERS,
        None,
        _issue_body,
    ),
    ("GET", "/api/v1/transmittals/{id}", PROJECT_VIEW, _transmittal_id, {}),
    ("GET", "/api/v1/transmittals/{id}/cover", PROJECT_VIEW, _transmittal_id, {}),
    ("POST", "/api/v1/recipients/{id}/resend", ISSUERS, _recipient, {}),
    ("GET", "/api/v1/sheets/{id}/distribution", PROJECT_VIEW, _sheet, {}),
    ("GET", "/api/v1/notifications", ALL, None, {}),
    ("POST", "/api/v1/notifications/read", ALL, None, {"ids": None}),
    ("GET", "/api/v1/notification-preferences", ALL, None, {}),
    ("PUT", "/api/v1/notification-preferences", ALL, None, {"modes": {"sheet_approved": "digest"}}),
    ("GET", "/api/v1/automation-rules", ALL, None, {}),
    ("PATCH", "/api/v1/automation-rules/{id}", ADMIN, _rule, {"enabled": True}),
    ("POST", "/api/v1/automation-rules/{id}/run", ADMIN, _rule, {}),
    ("GET", "/api/v1/automation-runs", ADMIN, None, {}),
]


# --- S5 people -------------------------------------------------------------------------------

STAFF_MANAGERS = {"admin", "dl"}  # F-16: Admin or DL (DD-019)
ALLOCATORS = {"pl", "dl"}
LOGGERS = ALL - ADMIN  # Log own timesheet: everyone but the IT admin (03 §11)


def _colleague(org: Any, user: Any, project: Any) -> Any:
    from apps.accounts.models import User
    from apps.accounts.roles import OrgRole, ProjectRole
    from apps.projects.models import ProjectMembership

    person = User.objects.create_user(
        f"colleague-{user.pk}@firm.example",
        "a-strong-password-123",
        organisation=org,
        org_role=OrgRole.STAFF,
        full_name="Colleague",
    )
    ProjectMembership.objects.create(
        organisation=org, project=project, user=person, role=ProjectRole.DESIGNER
    )
    return person


def _colleague_id(org: Any, user: Any, project: Any) -> str:
    return str(_colleague(org, user, project).pk)


def _leave_body(org: Any, user: Any, project: Any) -> dict:
    return {
        "user": _colleague_id(org, user, project),
        "start": "2026-11-02",
        "end": "2026-11-03",
        "type": "annual",
    }


def _leave(org: Any, user: Any, project: Any) -> str:
    from apps.people.models import Leave

    leave = Leave.objects.create(
        organisation=org,
        user=_colleague(org, user, project),
        start=dt_date(2026, 11, 2),
        end=dt_date(2026, 11, 3),
    )
    return str(leave.pk)


def _stage(org: Any, project: Any) -> Any:
    from apps.projects.models import Stage

    return Stage.objects.get_or_create(
        organisation=org, project=project, seq=4, defaults={"name": "Working drawings"}
    )[0]


def _allocation_body(org: Any, user: Any, project: Any) -> dict:
    return {
        "user": str(user.pk),
        "project": str(project.pk),
        "stage": str(_stage(org, project).pk),
        "weeks": ["2026-11-02"],
        "hours": "10",
    }


def _own_sheet(org: Any, user: Any, project: Any) -> str:
    from apps.people.services import timesheet_for

    return str(timesheet_for(user, dt_date(2026, 10, 26)).pk)


def _submitted_sheet(org: Any, user: Any, project: Any) -> str:
    from apps.people.models import TimeEntry, Timesheet, TimesheetState

    person = _colleague(org, user, project)
    sheet = Timesheet.objects.create(
        organisation=org, user=person, week=dt_date(2026, 10, 26), state=TimesheetState.SUBMITTED
    )
    TimeEntry.objects.create(
        organisation=org,
        timesheet=sheet,
        project=project,
        stage=_stage(org, project),
        date=dt_date(2026, 10, 26),
        hours=8,
    )
    return str(sheet.pk)


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/staff", ALL, None, {}),
    ("PATCH", "/api/v1/staff/{id}", STAFF_MANAGERS, _colleague_id, {"team": "Studio 2"}),
    ("GET", "/api/v1/leave", ALL, None, {}),
    ("POST", "/api/v1/leave", STAFF_MANAGERS, None, _leave_body),
    ("DELETE", "/api/v1/leave/{id}", STAFF_MANAGERS, _leave, {}),
    ("GET", "/api/v1/allocations", ALL, None, {}),
    ("PUT", "/api/v1/allocations", ALLOCATORS, None, _allocation_body),
    (
        "POST",
        "/api/v1/allocations/copy-forward",
        ALLOCATORS,
        None,
        lambda org, user, project: {"user": str(user.pk), "week": "2026-11-02", "count": 1},
    ),
    ("GET", "/api/v1/workload", ALL, None, {}),
    ("GET", "/api/v1/timesheets/me", LOGGERS, None, {}),
    ("GET", "/api/v1/timesheets/approvals", ALL, None, {}),
    ("POST", "/api/v1/timesheets/import", ADMIN, None, {}),
    ("PUT", "/api/v1/timesheets/{id}/entries", LOGGERS, _own_sheet, []),
    ("POST", "/api/v1/timesheets/{id}/submit", LOGGERS, _own_sheet, {}),
    ("POST", "/api/v1/timesheets/{id}/approve", ALLOCATORS, _submitted_sheet, {}),
    ("POST", "/api/v1/timesheets/{id}/return", ALLOCATORS, _submitted_sheet, {"reason": "Fix"}),
]


# --- S6 dashboards, reports, search, activity, exports, onboarding ----------------------------

PORTFOLIO = {"owner", "pl"}  # D-01: Owner; PLs see their own projects (DD-027)
BASELINE = {"owner", "admin"}  # D-05: Owner and LatentIQ support (Admin login)
HOURS_REPORT = {"owner", "accounts", "pl", "dl"}  # 03 §9; Accounts totals only


def _discipline_a(org: Any, user: Any, project: Any) -> dict:
    """Side effect only: the matrix calls /dashboards/disciplines/A."""
    from apps.core.models import Discipline

    Discipline.objects.get_or_create(organisation=org, code="A", defaults={"name": "Arch"})
    return {}


def _export(org: Any, user: Any, project: Any) -> str:
    from apps.exports.models import ExportJob

    return str(
        ExportJob.objects.create(organisation=org, user=user, kind="workload", format="xlsx").pk
    )


def _onboarding(org: Any, user: Any, project: Any) -> str:
    from apps.register.models import OnboardingJob

    return str(
        OnboardingJob.objects.create(
            organisation=org,
            created_by=user,
            original_name="x.xlsx",
            data={
                "project": {},
                "stages": [],
                "team": [],
                "packages": [],
                "sheets": [],
                "revisions": [],
            },
        ).pk
    )


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/dashboards/portfolio", PORTFOLIO, None, {}),
    ("GET", "/api/v1/dashboards/projects/{id}", PROJECT_VIEW, lambda o, u, p: str(p.pk), {}),
    ("GET", "/api/v1/dashboards/disciplines/{code}", {"owner", "dl"}, None, _discipline_a),
    ("GET", "/api/v1/dashboards/me", ALL, None, {}),
    ("GET", "/api/v1/reports/baseline", BASELINE, None, {}),
    ("GET", "/api/v1/reports/hours", HOURS_REPORT, None, {}),
    ("GET", "/api/v1/sheets", ALL, None, {}),
    ("GET", "/api/v1/search", ALL, None, {}),
    ("GET", "/api/v1/projects/{project_pk}/activity", PROJECT_VIEW, None, {}),
    ("GET", "/api/v1/exports", ALL, None, {}),
    ("POST", "/api/v1/exports", ALL, None, {"kind": "late_at_risk", "format": "xlsx"}),
    ("GET", "/api/v1/exports/{id}", ALL, _export, {}),
    ("GET", "/api/v1/onboarding", ADMIN, None, {}),
    ("POST", "/api/v1/onboarding", ADMIN, None, {}),
    ("GET", "/api/v1/onboarding/{id}", ADMIN, _onboarding, {}),
    (
        "POST",
        "/api/v1/onboarding/{id}/files",
        ADMIN,
        _onboarding,
        {"uploads": ["00000000-0000-0000-0000-000000000001"]},
    ),
    ("POST", "/api/v1/onboarding/{id}/commit", ADMIN, _onboarding, {}),
]


# --- S7 review flow (P2) ---------------------------------------------------------------------


def _checklist(org: Any, user: Any, project: Any) -> str:
    from apps.workflow.models import Checklist, ChecklistItem

    c = Checklist.objects.create(organisation=org, name="Pre-check")
    ChecklistItem.objects.create(checklist=c, seq=1, text="Scale bar")
    return str(c.pk)


def _delegation_body(org: Any, user: Any, project: Any) -> dict:
    return {
        "delegate": _colleague_id(org, user, project),
        "start": "2026-11-02",
        "end": "2026-11-06",
    }


def _delegation(org: Any, user: Any, project: Any) -> str:
    from apps.workflow.models import Delegation

    d = Delegation.objects.create(
        organisation=org,
        user=user,
        delegate=_colleague(org, user, project),
        start=dt_date(2026, 11, 2),
        end=dt_date(2026, 11, 6),
    )
    return str(d.pk)


CHECKLIST_BODY = {"name": "Pre-check", "stage_names": [], "items": [{"text": "North point"}]}

EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/sheets/{id}/precheck", PROJECT_VIEW, _sheet, {}),
    ("GET", "/api/v1/checklists", ALL, None, {}),
    ("POST", "/api/v1/checklists", ADMIN, None, CHECKLIST_BODY),
    ("GET", "/api/v1/checklists/{id}", ALL, _checklist, {}),
    ("PUT", "/api/v1/checklists/{id}", ADMIN, _checklist, CHECKLIST_BODY),
    ("PATCH", "/api/v1/checklists/{id}", ADMIN, _checklist, {"name": "Renamed"}),
    ("DELETE", "/api/v1/checklists/{id}", ADMIN, _checklist, {}),
    ("GET", "/api/v1/delegations", ALL, None, {}),
    ("POST", "/api/v1/delegations", ALL, None, _delegation_body),
    ("DELETE", "/api/v1/delegations/{id}", ALL, _delegation, {}),
]


# --- S8 client comments, email capture, approvals (P2) ---------------------------------------

COMMENT_LOGGERS = {"pl", "dl", "dc"}  # 03 §17 "Log client comments (P2)"


def _comment(org: Any, user: Any, project: Any) -> str:
    from apps.comments.models import ClientComment

    seq = ClientComment.objects.filter(project=project).count() + 1
    return str(
        ClientComment.objects.create(
            organisation=org,
            project=project,
            seq=seq,
            number=f"CC-{seq}",
            source="call",
            received_on=dt_date(2026, 10, 20),
            body="Widen the corridor",
        ).pk
    )


def _inbound(org: Any, user: Any, project: Any) -> str:
    from django.utils import timezone

    from apps.comments.models import InboundEmail, InboundState

    return str(
        InboundEmail.objects.create(
            organisation=org,
            project=project,
            message_id=f"<{user.pk}@x>",
            to_address="p@x",
            from_address="stranger@x.example",
            received_at=timezone.now(),
            state=InboundState.REVIEW,
        ).pk
    )


def _issued_stage(org: Any, user: Any, project: Any) -> str:
    from apps.projects.models import StageState

    stage = _stage(org, project)
    stage.state = StageState.DELIVERABLES_ISSUED
    stage.save()
    return str(stage.pk)


def _approval_body(org: Any, user: Any, project: Any) -> dict:
    from .workflow_fixtures import ready_upload_for

    upload = ready_upload_for(user, "approval.pdf", sha=f"approval-{user.pk}")
    return {
        "approved_by": "Dr Rao",
        "approved_on": "2026-10-22",
        "evidence_upload_id": str(upload.pk),
    }


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/projects/{project_pk}/comments", PROJECT_VIEW, None, {}),
    (
        "POST",
        "/api/v1/projects/{project_pk}/comments",
        COMMENT_LOGGERS,
        None,
        {"source": "call", "received_on": "2026-10-21", "body": "Client wants a wider corridor"},
    ),
    ("GET", "/api/v1/comments/{id}", PROJECT_VIEW, _comment, {}),
    ("PATCH", "/api/v1/comments/{id}", COMMENT_LOGGERS, _comment, {"response": "Will do"}),
    (
        "POST",
        "/api/v1/comments/{id}/attachments",
        COMMENT_LOGGERS,
        _comment,
        lambda org, user, project: {
            "upload_ids": [_approval_body(org, user, project)["evidence_upload_id"]]
        },
    ),
    ("GET", "/api/v1/projects/{project_pk}/inbound-emails", COMMENT_LOGGERS, None, {}),
    ("POST", "/api/v1/inbound-emails/{id}/review", COMMENT_LOGGERS, _inbound, {"accept": False}),
    ("GET", "/api/v1/projects/{project_pk}/approvals", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/stages/{id}/approval", {"pl"}, _issued_stage, _approval_body),
]


# --- S9 billing signal and site view (P2) ----------------------------------------------------

BILLING_VIEWERS = {"owner", "accounts", "pl"}  # S-17: Accounts' view; Owner, PL read (DD-032)


def _signal(org: Any, user: Any, project: Any) -> str:
    from decimal import Decimal

    from django.utils import timezone

    from apps.billing.models import BillingSignal
    from apps.projects.models import StageState

    stage = _stage(org, project)
    stage.state = StageState.READY_TO_INVOICE
    stage.save()
    return str(
        BillingSignal.objects.create(
            organisation=org,
            project=project,
            stage=stage,
            fee_pct=Decimal("10"),
            ready_at=timezone.now(),
        ).pk
    )


def _site_contact(org: Any, user: Any, project: Any) -> dict:
    from apps.contacts.models import Contact

    c = Contact.objects.create(
        organisation=org, full_name="Site", email=f"site-{user.pk}@x.example"
    )
    return {"contact": str(c.pk)}


def _site_link(org: Any, user: Any, project: Any) -> str:
    from datetime import timedelta

    from django.utils import timezone

    from apps.contacts.models import Contact
    from apps.transmittals.models import SiteLink

    c = Contact.objects.create(organisation=org, full_name="Site", email="s@x.example")
    return str(
        SiteLink.objects.create(
            organisation=org,
            project=project,
            contact=c,
            token_hash=str(user.pk).replace("-", "")[:64],
            expires_at=timezone.now() + timedelta(days=5),
            created_by=user,
        ).pk
    )


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/billing/signals", BILLING_VIEWERS, None, {}),
    ("GET", "/api/v1/billing/signals/export", BILLING_VIEWERS, None, {}),
    (
        "POST",
        "/api/v1/billing/signals/{id}/invoiced",
        {"accounts"},
        _signal,
        {"invoice_ref": "INV-1"},
    ),
    ("GET", "/api/v1/projects/{project_pk}/site-links", ISSUERS, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/site-links", ISSUERS, None, _site_contact),
    ("POST", "/api/v1/site-links/{id}/revoke", ISSUERS, _site_link, {}),
]


# --- S10 CAD plugins and storage connector (P2) ----------------------------------------------


def _proposal(org: Any, user: Any, project: Any) -> str:
    from apps.cadsync.models import SyncBatch, SyncProposal

    batch = SyncBatch.objects.create(
        organisation=org, project=project, source="revit", sent_by=user
    )
    return str(
        SyncProposal.objects.create(
            organisation=org,
            batch=batch,
            project=project,
            kind="new",
            number="Z-999",
            cad_title="New",
        ).pk
    )


EXTRA_ENDPOINTS += [
    (
        "POST",
        "/api/v1/integrations/cad-sync",
        PROJECT_VIEW,
        None,
        {
            "project_code": "{code}",
            "source": "revit",
            "sheets": [{"number": "A-901", "title": "X"}],
        },
    ),
    (
        "POST",
        "/api/v1/integrations/file-events",
        PROJECT_VIEW,
        None,
        {"project_code": "{code}", "events": [{"path": "/x/A-901.dwg"}]},
    ),
    ("GET", "/api/v1/projects/{project_pk}/cad-proposals", EDIT_SHEETS, None, {}),
    ("POST", "/api/v1/cad-proposals/{id}/decide", EDIT_SHEETS, _proposal, {"accept": False}),
    ("GET", "/api/v1/sheets/{id}/cad-events", PROJECT_VIEW, _sheet, {}),
]


# --- S11 title blocks (P2) -------------------------------------------------------------------


def _tb_body(org: Any, user: Any, project: Any) -> dict:
    from .test_titleblock import vector_pdf
    from .workflow_fixtures import ready_upload_for

    upload = ready_upload_for(user, "tb.pdf", sha=f"tb-{user.pk}")
    from apps.files import storage

    storage.put_bytes(upload.file.storage_key, vector_pdf("SHEET A-101"), "application/pdf")
    return {"upload_ids": [str(upload.pk)]}


EXTRA_ENDPOINTS += [
    (
        "POST",
        "/api/v1/projects/{project_pk}/title-blocks",
        PROJECT_VIEW,  # Admin uploads too (DD-028) and sees every project
        None,
        _tb_body,
    ),
]


# --- Phase 3: construction administration, clashes, knowledge (DD-034) ------------------------

CA_MANAGERS = {"pl", "dl", "dc"}
SUBMITTAL_REVIEWERS = {"pl", "dl", "sr"}
SITE_REPORTERS = {"pl", "dl", "designer", "sr", "dc"}
LEADS = {"pl", "dl"}


def _rfi(org: Any, user: Any, project: Any) -> str:
    from apps.ca.models import Rfi

    n = Rfi.objects.filter(project=project).count() + 1
    return str(
        Rfi.objects.create(
            organisation=org,
            project=project,
            seq=n,
            number=f"RFI-{n}",
            subject="S",
            question="Q",
            received_on=dt_date(2026, 10, 1),
            due_on=dt_date(2026, 10, 9),
        ).pk
    )


def _answered_rfi(org: Any, user: Any, project: Any) -> str:
    from apps.ca.models import Rfi

    pk = _rfi(org, user, project)
    Rfi.objects.filter(pk=pk).update(status="answered", response="A")
    return pk


def _doc_upload(org: Any, user: Any, project: Any) -> str:
    from apps.files import storage
    from apps.files.models import UploadKind

    from .conftest import make_pdf
    from .workflow_fixtures import ready_upload_for

    u = ready_upload_for(user, "doc.pdf", sha=f"doc-{user.pk}", kind=UploadKind.DOCUMENT)
    storage.put_bytes(u.file.storage_key, make_pdf(1), "application/pdf")
    return str(u.pk)


def _submittal(org: Any, user: Any, project: Any, status: str = "pending") -> str:
    from apps.ca.models import Submittal

    n = Submittal.objects.filter(project=project).count() + 1
    return str(
        Submittal.objects.create(
            organisation=org,
            project=project,
            seq=n,
            number=f"SUB-{n}",
            title="T",
            kind="sample",
            received_on=dt_date(2026, 10, 1),
            status=status,
        ).pk
    )


def _report(org: Any, user: Any, project: Any) -> str:
    from apps.ca.models import SiteReport

    n = SiteReport.objects.filter(project=project).count() + 1
    return str(
        SiteReport.objects.create(
            organisation=org,
            project=project,
            seq=n,
            number=f"SVR-{n}",
            visit_date=dt_date(2026, 10, 1),
        ).pk
    )


def _observation(org: Any, user: Any, project: Any) -> str:
    from apps.ca.models import SiteObservation, SiteReport

    return str(
        SiteObservation.objects.create(
            report=SiteReport.objects.get(pk=_report(org, user, project)), seq=1, text="T"
        ).pk
    )


def _change_order(org: Any, user: Any, project: Any, status: str = "proposed") -> str:
    from apps.ca.models import ChangeOrder

    n = ChangeOrder.objects.filter(project=project).count() + 1
    return str(
        ChangeOrder.objects.create(
            organisation=org,
            project=project,
            seq=n,
            number=f"CO-{n}",
            title="T",
            description="D",
            origin="client",
            status=status,
        ).pk
    )


def _clash(org: Any, user: Any, project: Any) -> str:
    from apps.coordination.models import ClashIssue

    return str(
        ClashIssue.objects.create(
            organisation=org, project=project, source="bcf", guid=str(user.pk), title="Clash"
        ).pk
    )


def _clash_upload(org: Any, user: Any, project: Any) -> dict:
    from apps.files import storage
    from apps.files.models import UploadKind

    from .test_coordination import NAVIS
    from .workflow_fixtures import ready_upload_for

    u = ready_upload_for(user, "c.xml", sha=f"clash-{user.pk}", kind=UploadKind.DATA)
    storage.put_bytes(u.file.storage_key, NAVIS.encode(), "application/xml")
    return {"upload_id": str(u.pk)}


RFI_BODY = {"subject": "S", "question": "Q", "received_on": "2026-10-01", "due_on": "2026-10-09"}

EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/projects/{project_pk}/rfis", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/rfis", CA_MANAGERS, None, RFI_BODY),
    ("GET", "/api/v1/rfis/{id}", PROJECT_VIEW, _rfi, {}),
    ("PATCH", "/api/v1/rfis/{id}", CA_MANAGERS, _rfi, {"subject": "S2"}),
    ("POST", "/api/v1/rfis/{id}/respond", CA_MANAGERS, _rfi, {"response": "A"}),
    ("POST", "/api/v1/rfis/{id}/close", CA_MANAGERS, _answered_rfi, {}),
    ("GET", "/api/v1/projects/{project_pk}/submittals", PROJECT_VIEW, None, {}),
    (
        "POST",
        "/api/v1/projects/{project_pk}/submittals",
        CA_MANAGERS,
        None,
        lambda o, u, p: {
            "title": "T",
            "kind": "sample",
            "received_on": "2026-10-01",
            "file_upload": _doc_upload(o, u, p),
        },
    ),
    ("GET", "/api/v1/submittals/{id}", PROJECT_VIEW, _submittal, {}),
    (
        "POST",
        "/api/v1/submittals/{id}/review",
        SUBMITTAL_REVIEWERS,
        _submittal,
        {"status": "approved"},
    ),
    (
        "POST",
        "/api/v1/submittals/{id}/resubmit",
        CA_MANAGERS,
        lambda o, u, p: _submittal(o, u, p, "revise_resubmit"),
        lambda o, u, p: {"file_upload": _doc_upload(o, u, p)},
    ),
    ("GET", "/api/v1/projects/{project_pk}/site-reports", PROJECT_VIEW, None, {}),
    (
        "POST",
        "/api/v1/projects/{project_pk}/site-reports",
        SITE_REPORTERS,
        None,
        {"visit_date": "2026-10-01"},
    ),
    ("GET", "/api/v1/site-reports/{id}", PROJECT_VIEW, _report, {}),
    ("PATCH", "/api/v1/site-reports/{id}", SITE_REPORTERS, _report, {"weather": "Rain"}),
    (
        "POST",
        "/api/v1/site-reports/{id}/observations",
        SITE_REPORTERS,
        _report,
        {"text": "Crack in slab"},
    ),
    ("POST", "/api/v1/site-reports/{id}/file", SITE_REPORTERS, _report, {}),
    ("DELETE", "/api/v1/observations/{id}", SITE_REPORTERS, _observation, {}),
    ("GET", "/api/v1/projects/{project_pk}/change-orders", PROJECT_VIEW, None, {}),
    (
        "POST",
        "/api/v1/projects/{project_pk}/change-orders",
        CA_MANAGERS,
        None,
        {"title": "T", "description": "D", "origin": "client"},
    ),
    ("GET", "/api/v1/change-orders/{id}", PROJECT_VIEW, _change_order, {}),
    ("POST", "/api/v1/change-orders/{id}/decide", {"pl"}, _change_order, {"approve": True}),
    (
        "POST",
        "/api/v1/change-orders/{id}/start-revisions",
        CA_MANAGERS,
        lambda o, u, p: _change_order(o, u, p, "approved"),
        {},
    ),
    ("GET", "/api/v1/projects/{project_pk}/clashes", PROJECT_VIEW, None, {}),
    ("GET", "/api/v1/projects/{project_pk}/clash-imports", PROJECT_VIEW, None, {}),
    ("POST", "/api/v1/projects/{project_pk}/clash-imports", LEADS, None, _clash_upload),
    ("GET", "/api/v1/clashes/{id}", PROJECT_VIEW, _clash, {}),
    ("PATCH", "/api/v1/clashes/{id}", LEADS, _clash, {"status": "closed"}),
    ("GET", "/api/v1/projects/{project_pk}/decisions", PROJECT_VIEW, None, {}),
    (
        "POST",
        "/api/v1/projects/{project_pk}/decisions",
        LEADS,
        None,
        {"title": "T", "text": "X", "decided_on": "2026-10-01"},
    ),
    ("GET", "/api/v1/knowledge/search", ALL, None, {}),
]


# --- Phase 4 intelligence (DD-035) -----------------------------------------------------------

FORECAST_VIEWERS = {"owner", "pl", "dl"}
FINDING_REVIEWERS = {"pl", "dl", "sr", "dc"}


def _prediction(org: Any, user: Any, project: Any) -> str:
    from apps.intelligence.models import ModelRun, Prediction
    from apps.register.models import Sheet

    from .test_api_permissions import make_sheet

    run = ModelRun.objects.create(organisation=org, kind="late_risk", status="ok")
    sheet = make_sheet(org, user, project)
    assert isinstance(sheet, Sheet)
    return str(
        Prediction.objects.create(
            organisation=org, run=run, sheet=sheet, project=project, score=0.5
        ).pk
    )


def _finding(org: Any, user: Any, project: Any) -> str:
    from apps.intelligence.models import Finding
    from apps.register.models import SheetRevision

    from .test_api_permissions import make_sheet

    sheet = make_sheet(org, user, project)
    rev = SheetRevision.objects.create(organisation=org, sheet=sheet, code="C01", seq=1)
    return str(
        Finding.objects.create(
            organisation=org,
            revision=rev,
            sheet=sheet,
            project=project,
            rule="TB-DATE",
            message="No date",
        ).pk
    )


EXTRA_ENDPOINTS += [
    ("GET", "/api/v1/intelligence/status", ALL, None, {}),
    ("POST", "/api/v1/intelligence/run", ADMIN, None, {}),
    ("GET", "/api/v1/intelligence/workload", FORECAST_VIEWERS, None, {}),
    ("GET", "/api/v1/intelligence/findings", ALL, None, {}),
    ("GET", "/api/v1/intelligence/findings/evaluation", ADMIN, None, {}),
    ("PUT", "/api/v1/intelligence/findings/evaluation", ADMIN, None, {"mode": "evaluation"}),
    ("GET", "/api/v1/projects/{project_pk}/risk", FORECAST_VIEWERS, None, {}),
    ("POST", "/api/v1/predictions/{id}/feedback", FORECAST_VIEWERS, _prediction, {"agree": True}),
    ("GET", "/api/v1/sheets/{id}/findings", FINDING_REVIEWERS, _sheet, {}),
    ("POST", "/api/v1/findings/{id}/review", FINDING_REVIEWERS, _finding, {"accept": True}),
]

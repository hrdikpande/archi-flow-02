"""Projects, teams, fee stages, packages and stage templates (F-01, F-02, F-03, F-49).

All writes check permissions (`require`), run in a transaction, are audited, and announce
side effects through the outbox.
"""

import re
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Sum

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.services import record_change, snapshot
from apps.core.clock import org_today
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import Discipline, OrgSettings
from apps.core.records import create_record, delete_record, update_record
from apps.outbox.services import emit

from .models import (
    Package,
    Project,
    ProjectMembership,
    Stage,
    StageState,
    StageTemplate,
    StageTemplateItem,
)
from .stage_machine import PREVIOUS, STAGE_TRANSITIONS

FEE_TOLERANCE = Decimal("0.01")
PROJECT_FIELDS = (
    "code",
    "name",
    "client",
    "type",
    "location",
    "status",
    "start_date",
    "end_date",
    "cad_versions",
    "stage_plan_final",
    "appointment_letter",
)


# --- Projects -------------------------------------------------------------------------------


def code_pattern(fmt: str) -> re.Pattern[str]:
    """'YYYY-NNN' → ^\\d{4}-\\d{3}$ : Y and N are digits, anything else is literal."""
    parts = []
    for ch in fmt:
        parts.append(r"\d" if ch in "YN" else re.escape(ch))
    return re.compile("^" + "".join(parts) + "$")


def _check_code(organisation_id: Any, code: str, exclude: Any = None) -> str:
    code = code.strip()
    fmt = OrgSettings.objects.get(organisation_id=organisation_id).project_code_format
    if fmt and not code_pattern(fmt).match(code):
        raise DomainError(
            "invalid_code", f"Project code {code} does not match the format {fmt}.", field="code"
        )
    clash = Project.objects.filter(organisation_id=organisation_id, code=code).exclude(pk=exclude)
    if clash.exists():
        raise ConflictError(
            "duplicate_code",
            f"Project code {code} already exists. Use the next free number.",
            field="code",
        )
    return code


def _check_user(project: Project, user: User) -> None:
    if user.organisation_id != project.organisation_id or not user.is_active:
        raise DomainError("invalid_user", "This person is not an active member of the firm.")


@transaction.atomic
def create_project(actor: User, *, lead: User | None = None, **data: Any) -> Project:
    require(actor, Action.CREATE_PROJECT)
    data["code"] = _check_code(actor.org_pk, data["code"])
    client = data.get("client")
    if client is not None and client.organisation_id != actor.org_pk:
        raise DomainError("invalid_client", "Unknown client organisation.", field="client")
    project = create_record(
        Project, actor=actor, verb="project.created", organisation_id=actor.org_pk, **data
    )
    # The lead is whoever was named; a PL-eligible staff member creating it leads it.
    if lead is None and actor.org_role not in (OrgRole.OWNER, OrgRole.ADMIN):
        lead = actor
    if lead is not None:
        _check_user(project, lead)
        _add_member(actor, project, lead, ProjectRole.PL, None)
    emit("project.created", {"project_id": str(project.pk)}, organisation_id=actor.org_pk)
    return project


@transaction.atomic
def update_project(actor: User, project: Project, **data: Any) -> Project:
    require(actor, Action.EDIT_STAGES, project=project)
    if "code" in data and data["code"] != project.code:
        data["code"] = _check_code(project.organisation_id, data["code"], exclude=project.pk)
    return update_record(project, actor=actor, verb="project.updated", **data)


# --- Team -----------------------------------------------------------------------------------


def _add_member(
    actor: User, project: Project, user: User, role: str, discipline: Discipline | None
) -> ProjectMembership:
    if ProjectMembership.objects.filter(project=project, user=user).exists():
        raise ConflictError("already_member", f"{user} is already on this project's team.")
    membership = create_record(
        ProjectMembership,
        actor=actor,
        verb="project.member_added",
        organisation_id=project.organisation_id,
        project=project,
        user=user,
        role=role,
        discipline=discipline,
    )
    emit(
        "project.member_added",
        {"project_id": str(project.pk), "user_id": str(user.pk), "role": role},
        organisation_id=project.organisation_id,
    )
    return membership


@transaction.atomic
def add_member(
    actor: User, project: Project, *, user: User, role: str, discipline: Discipline | None = None
) -> ProjectMembership:
    require(actor, Action.EDIT_STAGES, project=project)
    _check_user(project, user)
    return _add_member(actor, project, user, role, discipline)


@transaction.atomic
def update_member(actor: User, membership: ProjectMembership, **data: Any) -> ProjectMembership:
    require(actor, Action.EDIT_STAGES, project=membership.project)
    if membership.role == ProjectRole.PL and data.get("role", ProjectRole.PL) != ProjectRole.PL:
        _ensure_other_lead(membership)
    return update_record(membership, actor=actor, verb="project.member_updated", **data)


def _ensure_other_lead(membership: ProjectMembership) -> None:
    others = ProjectMembership.objects.filter(
        project=membership.project, role=ProjectRole.PL
    ).exclude(pk=membership.pk)
    if not others.exists():
        raise ConflictError("last_lead", "A project needs a project lead. Add another lead first.")


@transaction.atomic
def remove_member(actor: User, membership: ProjectMembership) -> None:
    require(actor, Action.EDIT_STAGES, project=membership.project)
    from apps.register.models import Sheet, SheetState

    if membership.role == ProjectRole.PL:
        _ensure_other_lead(membership)
    open_sheets = Sheet.objects.filter(project=membership.project).exclude(
        state__in=[SheetState.ISSUED, SheetState.SUPERSEDED, SheetState.CANCELLED]
    )
    held = (
        open_sheets.filter(owner=membership.user).count()
        + open_sheets.filter(checker=membership.user).count()
    )
    if held:
        raise ConflictError(
            "has_open_sheets",
            f"{membership.user} owns or checks {held} open sheets. Reassign them first.",
        )
    delete_record(membership, actor=actor, verb="project.member_removed")


# --- Stages ---------------------------------------------------------------------------------


def fee_total(stages: list[dict[str, Any]] | Any) -> Decimal:
    if isinstance(stages, list):
        return sum((Decimal(str(s.get("fee_pct") or 0)) for s in stages), Decimal("0"))
    return stages.aggregate(t=Sum("fee_pct"))["t"] or Decimal("0")


STAGE_FIELDS = (
    "seq",
    "name",
    "fee_pct",
    "fee_amount",
    "planned_start",
    "planned_end",
    "requires_senior_qc",
    "required_purposes",
)
LOCKED_FEE_STATES = {StageState.INVOICED, StageState.CLOSED}


@transaction.atomic
def save_stage_plan(
    actor: User, project: Project, *, stages: list[dict[str, Any]], final: bool
) -> list[Stage]:
    """Saves the whole plan (S-11). Draft plans may total anything; final needs 100% (F-02)."""
    require(actor, Action.EDIT_STAGES, project=project)
    project = Project.objects.select_for_update().get(pk=project.pk)
    seqs = [s["seq"] for s in stages]
    if len(seqs) != len(set(seqs)):
        raise DomainError("duplicate_seq", "Two stages have the same number.")
    for s in stages:
        if (
            s.get("planned_start")
            and s.get("planned_end")
            and s["planned_end"] < s["planned_start"]
        ):
            raise DomainError(
                "end_before_start", f"Stage {s['name']}: planned end is before planned start."
            )
    total = fee_total(stages)
    if final and abs(total - Decimal("100")) > FEE_TOLERANCE:
        raise DomainError(
            "fee_total",
            f"Fee stages total {total}%. A final plan must total 100%.",
            total=str(total),
        )
    existing = {str(s.pk): s for s in project.stages.all()}
    keep: set[str] = set()
    # Move existing stages to temporary numbers so re-ordering never trips the unique constraint.
    for i, stage in enumerate(Stage.objects.filter(project=project)):
        Stage.objects.filter(pk=stage.pk).update(seq=1000 + i)
    result = []
    for item in stages:
        data = {k: item[k] for k in STAGE_FIELDS if k in item}
        sid = str(item.get("id") or "")
        if sid and sid in existing:
            stage = existing[sid]
            if (
                stage.state in LOCKED_FEE_STATES
                and Decimal(str(data.get("fee_pct", stage.fee_pct))) != stage.fee_pct
                and actor.org_role != OrgRole.ADMIN
            ):
                raise ConflictError(
                    "fee_locked", f"{stage.name} is invoiced. Only an admin can change its fee %."
                )
            stage.refresh_from_db()
            result.append(update_record(stage, actor=actor, verb="stage.updated", **data))
            keep.add(sid)
        else:
            result.append(
                create_record(
                    Stage,
                    actor=actor,
                    verb="stage.created",
                    organisation_id=project.organisation_id,
                    project=project,
                    **data,
                )
            )
    for sid, stage in existing.items():
        if sid not in keep:
            if stage.sheets.exists():
                raise ConflictError(
                    "stage_in_use", f"{stage.name} has sheets. Move them to another stage first."
                )
            delete_record(stage, actor=actor, verb="stage.deleted")
    if project.stage_plan_final != final:
        update_record(project, actor=actor, verb="project.updated", stage_plan_final=final)
    return sorted(result, key=lambda s: s.seq)


@transaction.atomic
def apply_template(actor: User, project: Project, template: StageTemplate) -> list[Stage]:
    require(actor, Action.EDIT_STAGES, project=project)
    if template.organisation_id != project.organisation_id:
        raise DomainError("invalid_template", "Unknown stage template.")
    if project.stages.filter(sheets__isnull=False).exists():
        raise ConflictError(
            "stages_in_use", "Stages already have sheets; edit them instead of applying a template."
        )
    stages = [
        {
            "seq": item.seq,
            "name": item.name,
            "fee_pct": item.fee_pct,
            "required_purposes": list(item.required_purposes),
            "requires_senior_qc": item.requires_senior_qc,
        }
        for item in template.items.all()
    ]
    return save_stage_plan(actor, project, stages=stages, final=False)


def _set_stage_state(stage: Stage, target: str, actor: Any, verb: str) -> Stage:
    before = snapshot(stage, ("state", "actual_start", "actual_end"))
    today = org_today(stage.project.organisation)
    if target == PREVIOUS:
        target = stage.state_before_hold or StageState.PLANNED
        stage.state_before_hold = ""
    elif target == StageState.ON_HOLD:
        stage.state_before_hold = stage.state
    if target == StageState.ACTIVE and stage.actual_start is None:
        stage.actual_start = today
    if target == StageState.DELIVERABLES_ISSUED:
        stage.actual_end = today
    if target == StageState.ACTIVE and stage.state == StageState.DELIVERABLES_ISSUED:
        stage.actual_end = None
    old_state = stage.state
    stage.state = target
    stage.save()
    record_change(
        stage,
        actor=actor,
        verb=verb,
        before=before,
        after=snapshot(stage, ("state", "actual_start", "actual_end")),
    )
    emit(
        "stage.state_changed",
        {
            "stage_id": str(stage.pk),
            "from": old_state,
            "to": target,
            "project_id": str(stage.project_id),
        },
        organisation_id=stage.organisation_id,
    )
    return stage


@transaction.atomic
def transition_stage(actor: User, stage: Stage, action: str) -> Stage:
    """Manual stage actions by the PL (03 §4)."""
    stage = (
        Stage.objects.select_for_update(of=("self",))
        .select_related("project__organisation")
        .get(pk=stage.pk)
    )
    require(actor, Action.EDIT_STAGES, project=stage.project)
    t = STAGE_TRANSITIONS.get(action)
    if t is None or not t.manual or stage.state not in t.sources:
        allowed = [a for a, x in STAGE_TRANSITIONS.items() if x.manual and stage.state in x.sources]
        raise ConflictError(
            "transition_not_allowed",
            f"{stage.name} is {stage.get_state_display().lower()}; that action is not possible.",
            allowed_actions=allowed,
        )
    return _set_stage_state(stage, t.target, actor, f"stage.{action}")


def system_transition_stage(stage: Stage, action: str) -> Stage | None:
    """Automatic roll-ups (F-03, A-09). Returns None when the stage is not in a source state."""
    stage = (
        Stage.objects.select_for_update(of=("self",))
        .select_related("project__organisation")
        .get(pk=stage.pk)
    )
    t = STAGE_TRANSITIONS[action]
    if stage.state not in t.sources:
        return None
    return _set_stage_state(stage, t.target, None, f"stage.{action}")


# --- Packages -------------------------------------------------------------------------------


@transaction.atomic
def create_package(actor: User, project: Project, **data: Any) -> Package:
    require(actor, Action.EDIT_SHEETS, project=project)
    return create_record(
        Package,
        actor=actor,
        verb="package.created",
        organisation_id=project.organisation_id,
        project=project,
        **data,
    )


@transaction.atomic
def update_package(actor: User, package: Package, **data: Any) -> Package:
    require(actor, Action.EDIT_SHEETS, project=package.project)
    package = update_record(package, actor=actor, verb="package.updated", **data)
    if "planned_date" in data:
        emit(
            "package.date_changed",
            {"package_id": str(package.pk)},
            organisation_id=package.organisation_id,
        )
    return package


@transaction.atomic
def delete_package(actor: User, package: Package) -> None:
    require(actor, Action.EDIT_SHEETS, project=package.project)
    delete_record(package, actor=actor, verb="package.deleted")


# --- Stage templates (F-02, F-42) ------------------------------------------------------------


def _write_items(template: StageTemplate, items: list[dict[str, Any]]) -> None:
    template.items.all().delete()
    StageTemplateItem.objects.bulk_create(
        StageTemplateItem(
            template=template,
            seq=i + 1,
            name=item["name"],
            fee_pct=item.get("fee_pct") or 0,
            required_purposes=item.get("required_purposes") or [],
            requires_senior_qc=item.get("requires_senior_qc", False),
        )
        for i, item in enumerate(items)
    )


def _template_snapshot(template: StageTemplate) -> dict[str, Any]:
    return {
        "name": template.name,
        "is_default": template.is_default,
        "items": [
            {"name": i.name, "fee_pct": str(i.fee_pct)} for i in template.items.order_by("seq")
        ],
    }


def _clear_default(template: StageTemplate) -> None:
    if template.is_default:
        StageTemplate.objects.filter(
            organisation_id=template.organisation_id, is_default=True
        ).exclude(pk=template.pk).update(is_default=False)


@transaction.atomic
def create_stage_template(
    actor: User, *, name: str, is_default: bool = False, items: list[dict[str, Any]]
) -> StageTemplate:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    template = StageTemplate(
        organisation_id=actor.org_pk, created_by=actor, name=name, is_default=is_default
    )
    _clear_default(template)
    template.save()
    _write_items(template, items)
    record_change(
        template,
        actor=actor,
        verb="stage_template.created",
        before=None,
        after=_template_snapshot(template),
    )
    return template


@transaction.atomic
def update_stage_template(
    actor: User, template: StageTemplate, *, items: list[dict[str, Any]] | None = None, **data: Any
) -> StageTemplate:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    before = _template_snapshot(template)
    for k, v in data.items():
        setattr(template, k, v)
    _clear_default(template)
    template.save()
    if items is not None:
        _write_items(template, items)
    record_change(
        template,
        actor=actor,
        verb="stage_template.updated",
        before=before,
        after=_template_snapshot(template),
    )
    return template


@transaction.atomic
def delete_stage_template(actor: User, template: StageTemplate) -> None:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    record_change(
        template,
        actor=actor,
        verb="stage_template.deleted",
        before=_template_snapshot(template),
        after=None,
    )
    template.delete()


@transaction.atomic
def set_appointment_letter(actor: User, project: Project, upload_id: Any) -> Project:
    """F-02: the appointment letter PDF can be attached to the project."""
    from apps.files.models import UploadKind
    from apps.files.services import ready_upload

    require(actor, Action.EDIT_STAGES, project=project)
    upload = ready_upload(actor, upload_id, UploadKind.DOCUMENT)
    return update_record(
        project, actor=actor, verb="project.appointment_letter", appointment_letter=upload.file
    )

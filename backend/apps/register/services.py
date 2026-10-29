"""Sheets and saved views (F-04, F-49). State changes live in apps/workflow only."""

from typing import Any

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.permissions import Action, can, require
from apps.core.exceptions import ConflictError, DomainError
from apps.core.records import create_record, delete_record, update_record
from apps.files.validators import validate_cad_link
from apps.outbox.services import emit
from apps.projects.models import Package, Project, ProjectMembership, Stage

from .models import RevisionState, SavedView, Sheet
from .naming import sheet_number_problems

EDITABLE = (
    "number",
    "title",
    "stage",
    "package",
    "discipline",
    "owner",
    "checker",
    "planned_issue_date",
    "cad_link",
    "notes",
    "aliases",
)
OWN_EDITABLE = ("notes",)  # designers on their own sheets (03 §6 permissions)


def _check_refs(project: Project, data: dict[str, Any]) -> None:
    for key in ("stage", "package"):
        obj = data.get(key)
        if obj is not None and obj.project_id != project.pk:
            raise DomainError(
                f"invalid_{key}", f"That {key} belongs to another project.", field=key
            )
    discipline = data.get("discipline")
    if discipline is not None and discipline.organisation_id != project.organisation_id:
        raise DomainError("invalid_discipline", "Unknown discipline.", field="discipline")
    members = None
    for key in ("owner", "checker"):
        user = data.get(key)
        if user is None:
            continue
        if members is None:
            members = set(
                ProjectMembership.objects.filter(project=project).values_list("user_id", flat=True)
            )
        if user.pk not in members:
            raise DomainError(
                f"invalid_{key}",
                f"{user} is not on this project's team. Add them first.",
                field=key,
            )
    if data.get("cad_link"):
        try:
            data["cad_link"] = validate_cad_link(data["cad_link"])
        except Exception as exc:
            raise DomainError("invalid_cad_link", str(exc.messages[0]), field="cad_link") from exc  # type: ignore[attr-defined]


def _check_number(project: Project, data: dict[str, Any], exclude: Any = None) -> None:
    number = data["number"].strip()
    data["number"] = number
    problems = sheet_number_problems(project, data["discipline"], number)
    if problems:
        raise DomainError("invalid_number", problems[0], field="number", problems=problems)
    if Sheet.objects.filter(project=project, number=number).exclude(pk=exclude).exists():
        raise ConflictError(
            "duplicate_number", f"Sheet {number} already exists in this project.", field="number"
        )


def _announce_assignment(sheet: Sheet, previous_owner_id: Any) -> None:
    if sheet.owner_id and sheet.owner_id != previous_owner_id:
        emit(
            "sheet.assigned",
            {
                "sheet_id": str(sheet.pk),
                "user_id": str(sheet.owner_id),
                "previous_user_id": str(previous_owner_id) if previous_owner_id else None,
            },
            organisation_id=sheet.organisation_id,
        )


@transaction.atomic
def create_sheet(actor: User, project: Project, **data: Any) -> Sheet:
    require(actor, Action.EDIT_SHEETS, project=project)
    _check_refs(project, data)
    _check_number(project, data)
    sheet = create_record(
        Sheet,
        actor=actor,
        verb="sheet.created",
        organisation_id=project.organisation_id,
        project=project,
        **data,
    )
    emit("sheet.created", {"sheet_id": str(sheet.pk)}, organisation_id=sheet.organisation_id)
    _announce_assignment(sheet, None)
    return sheet


def editable_fields(actor: User, sheet: Sheet) -> tuple[str, ...]:
    if can(actor, Action.EDIT_SHEETS, project=sheet.project):
        return EDITABLE
    if sheet.owner_id == actor.pk and can(
        actor, Action.EDIT_SHEETS, project=sheet.project, is_own=True
    ):
        return OWN_EDITABLE
    return ()


@transaction.atomic
def update_sheet(actor: User, sheet: Sheet, **data: Any) -> Sheet:
    sheet = Sheet.objects.select_for_update(of=("self",)).select_related("project").get(pk=sheet.pk)
    allowed = editable_fields(actor, sheet)
    if not allowed:
        require(actor, Action.EDIT_SHEETS, project=sheet.project)  # raises
    blocked = sorted(set(data) - set(allowed))
    if blocked:
        raise DomainError(
            "field_not_editable", f"You can only change: {', '.join(allowed)}.", fields=blocked
        )
    _check_refs(sheet.project, data)
    if "number" in data and data["number"].strip() != sheet.number:
        data.setdefault("discipline", sheet.discipline)
        _check_number(sheet.project, data, exclude=sheet.pk)
        # Renumbered: keep the old number as a searchable alias (03 §6 edge cases).
        data["aliases"] = sorted({*sheet.aliases, sheet.number} - {data["number"]})
    previous_owner = sheet.owner_id
    sheet = update_record(sheet, actor=actor, verb="sheet.updated", **data)
    _announce_assignment(sheet, previous_owner)
    if "planned_issue_date" in data or "package" in data:
        emit(
            "sheet.dates_changed",
            {"sheet_id": str(sheet.pk)},
            organisation_id=sheet.organisation_id,
        )
    return sheet


@transaction.atomic
def delete_sheet(actor: User, sheet: Sheet) -> None:
    """PL only, and only while the sheet has never been issued; otherwise cancel it (03 §6)."""
    require(actor, Action.HOLD_CANCEL_SUPERSEDE, project=sheet.project)
    if sheet.revisions.filter(state__in=[RevisionState.ISSUED, RevisionState.SUPERSEDED]).exists():
        raise ConflictError(
            "has_issued_revision", f"{sheet.number} has been issued. Cancel it instead of deleting."
        )
    delete_record(sheet, actor=actor, verb="sheet.deleted")


# --- Saved views ----------------------------------------------------------------------------


@transaction.atomic
def create_saved_view(
    actor: User, *, name: str, config: dict[str, Any], project: Project | None = None
) -> SavedView:
    if project is not None:
        require(actor, Action.VIEW_PROJECT, project=project)
    return SavedView.objects.create(
        organisation_id=actor.org_pk,
        created_by=actor,
        user=actor,
        project=project,
        name=name,
        config=config,
    )


def _own(actor: User, view: SavedView) -> None:
    if view.user_id != actor.pk:
        raise DomainError("not_found", "Saved view not found.", status_code=404)


@transaction.atomic
def update_saved_view(actor: User, view: SavedView, **data: Any) -> SavedView:
    _own(actor, view)
    for k, v in data.items():
        setattr(view, k, v)
    view.save()
    return view


@transaction.atomic
def delete_saved_view(actor: User, view: SavedView) -> None:
    _own(actor, view)
    view.delete()


def stage_for(project: Project, value: Any) -> Stage | None:
    return Stage.objects.filter(project=project, pk=value).first()


def package_for(project: Project, value: Any) -> Package | None:
    return Package.objects.filter(project=project, pk=value).first()


# --- Naming rules (F-35) --------------------------------------------------------------------


def _check_regex(regex: str) -> None:
    import re

    try:
        re.compile(regex)
    except re.error as exc:
        raise DomainError("invalid_regex", f"Not a valid pattern: {exc}.", field="regex") from exc


@transaction.atomic
def create_naming_rule(actor: User, *, project: Project | None = None, **data: Any) -> Any:
    from .models import NamingRule

    if project is None:
        require(actor, Action.MANAGE_ORG_SETTINGS)
    else:
        require(actor, Action.EDIT_STAGES, project=project)
    _check_regex(data["regex"])
    return create_record(
        NamingRule,
        actor=actor,
        verb="naming_rule.created",
        organisation_id=actor.org_pk,
        project=project,
        **data,
    )


def _rule_permission(actor: User, rule: Any) -> None:
    if rule.project_id is None:
        require(actor, Action.MANAGE_ORG_SETTINGS)
    else:
        require(actor, Action.EDIT_STAGES, project=rule.project)


@transaction.atomic
def update_naming_rule(actor: User, rule: Any, **data: Any) -> Any:
    _rule_permission(actor, rule)
    if "regex" in data:
        _check_regex(data["regex"])
    return update_record(rule, actor=actor, verb="naming_rule.updated", **data)


@transaction.atomic
def delete_naming_rule(actor: User, rule: Any) -> None:
    _rule_permission(actor, rule)
    delete_record(rule, actor=actor, verb="naming_rule.deleted")


# --- Bulk actions (F-46) ---------------------------------------------------------------------

BULK_OPS = (
    "assign_owner",
    "set_checker",
    "set_planned_date",
    "shift_dates",
    "move_package",
    "transition",
)


def bulk_update(
    actor: User,
    project: Project,
    *,
    sheet_ids: list[Any],
    op: str,
    value: Any = None,
    reason: str = "",
) -> dict[str, Any]:
    """Applies one change to many sheets. Each sheet succeeds or is skipped with the reason;
    every change writes its own audit row ("47 updated, 3 skipped", DESIGN.md §6)."""
    from apps.core.calendar import WorkingCalendar

    if op not in BULK_OPS:
        raise DomainError("invalid_op", "Unknown bulk action.")
    if op != "transition":
        require(actor, Action.EDIT_SHEETS, project=project)
    sheets = list(Sheet.objects.filter(project=project, pk__in=sheet_ids).order_by("number"))
    if len(sheets) != len(set(map(str, sheet_ids))):
        raise DomainError("unknown_sheets", "Some selected sheets are not in this project.")
    calendar = WorkingCalendar.for_org(project.organisation) if op == "shift_dates" else None
    updated: list[str] = []
    skipped: list[dict[str, str]] = []
    for sheet in sheets:
        try:
            with transaction.atomic():
                if op == "transition":
                    from apps.workflow.services import transition

                    transition(sheet, str(value), actor, reason=reason)
                elif op == "shift_dates":
                    days = int(value)
                    current = sheet.effective_planned_date
                    if current is None:
                        raise DomainError("no_date", "No planned date to shift.")
                    if calendar is None:
                        raise DomainError("no_calendar", "Working calendar unavailable.")
                    update_sheet(
                        actor, sheet, planned_issue_date=calendar.add_working_days(current, days)
                    )
                else:
                    field = {
                        "assign_owner": "owner",
                        "set_checker": "checker",
                        "set_planned_date": "planned_issue_date",
                        "move_package": "package",
                    }[op]
                    update_sheet(actor, sheet, **{field: value})
            updated.append(str(sheet.pk))
        except (DomainError, ConflictError) as exc:
            skipped.append({"id": str(sheet.pk), "number": sheet.number, "reason": exc.detail})
    return {"updated": updated, "skipped": skipped}

"""Staff, capacity, allocations, timesheets (F-16..F-19; 03 §9).

Who sees whose hours (03 §9): a person sees their own; a DL their discipline; a PL their
projects; the Owner everyone. Individual hourly productivity is never ranked anywhere.
"""

import csv
import io
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Q, QuerySet, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, PermissionDeniedError, can, require
from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.services import record, record_change, snapshot
from apps.core.calendar import WorkingCalendar
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import Organisation, OrgSettings
from apps.core.records import create_record, delete_record, update_record
from apps.outbox.services import emit
from apps.projects.models import Project, ProjectMembership, Stage

from .models import Allocation, Leave, StaffProfile, TimeEntry, Timesheet, TimesheetState


def monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def weeks_between(start: date, end: date) -> list[date]:
    first, last = monday(start), monday(end)
    return [first + timedelta(weeks=i) for i in range((last - first).days // 7 + 1)]


# --- Staff directory (F-16) ----------------------------------------------------------------


def profile_for(user: User) -> StaffProfile:
    profile = getattr(user, "staff_profile", None)
    if profile is None:
        default = OrgSettings.objects.get(organisation_id=user.org_pk).default_weekly_capacity_h
        profile, _ = StaffProfile.objects.get_or_create(
            user=user,
            defaults={"organisation_id": user.org_pk, "weekly_capacity_h": default},
        )
    return profile


def led_disciplines(user: User) -> tuple[set[Any], bool]:
    """Disciplines a DL leads. (ids, all) where all=True if a DL membership has no discipline."""
    rows = list(
        ProjectMembership.objects.filter(user=user, role=ProjectRole.DL).values_list(
            "discipline_id", flat=True
        )
    )
    return {r for r in rows if r}, any(r is None for r in rows)


def can_manage_staff(actor: User, person: User) -> bool:
    """F-16: Admin, or a DL for people in a discipline they lead."""
    if actor.org_role == OrgRole.ADMIN:
        return True
    if not can(actor, Action.MANAGE_STAFF):
        return False
    disciplines, all_disciplines = led_disciplines(actor)
    profile = profile_for(person)
    return all_disciplines or profile.discipline_id in disciplines or profile.discipline_id is None


PROFILE_FIELDS = ("discipline", "team", "weekly_capacity_h", "cost_rate")


@transaction.atomic
def update_profile(actor: User, person: User, **data: Any) -> StaffProfile:
    if not can_manage_staff(actor, person):
        require(actor, Action.MANAGE_ORG_SETTINGS)  # raises with a clear message
    if "cost_rate" in data and actor.org_role != OrgRole.ADMIN:
        raise DomainError("admin_only", "Only an admin can set cost rates.")
    profile = profile_for(person)
    before = snapshot(profile, PROFILE_FIELDS)
    for k, v in data.items():
        setattr(profile, k, v)
    profile.full_clean()
    profile.save()
    record_change(
        profile,
        actor=actor,
        verb="staff_profile.updated",
        before=before,
        after=snapshot(profile, PROFILE_FIELDS),
    )
    emit("capacity.changed", {"user_id": str(person.pk)}, organisation_id=person.org_pk)
    return profile


@transaction.atomic
def add_leave(actor: User, person: User, **data: Any) -> Leave:
    if not can_manage_staff(actor, person):
        require(actor, Action.MANAGE_ORG_SETTINGS)
    leave = create_record(
        Leave,
        actor=actor,
        verb="leave.created",
        organisation_id=person.org_pk,
        user=person,
        **data,
    )
    emit("capacity.changed", {"user_id": str(person.pk)}, organisation_id=person.org_pk)
    return leave


@transaction.atomic
def delete_leave(actor: User, leave: Leave) -> None:
    if not can_manage_staff(actor, leave.user):
        require(actor, Action.MANAGE_ORG_SETTINGS)
    delete_record(leave, actor=actor, verb="leave.deleted")
    emit("capacity.changed", {"user_id": str(leave.user_id)}, organisation_id=leave.organisation_id)


# --- Capacity -------------------------------------------------------------------------------


class Capacity:
    """Weekly capacity net of holidays and leave: capacity per working day × days available."""

    def __init__(self, organisation: Organisation, start: date, end: date) -> None:
        self.calendar = WorkingCalendar.for_org(organisation, start, end + timedelta(days=7))
        self.days_per_week = len(organisation.working_weekdays)
        self.leave: dict[Any, list[tuple[date, date]]] = {}
        for lv in Leave.objects.filter(
            organisation=organisation, end__gte=start, start__lte=end + timedelta(days=7)
        ):
            self.leave.setdefault(lv.user_id, []).append((lv.start, lv.end))

    def hours(self, profile: StaffProfile, week: date) -> Decimal:
        per_day = profile.weekly_capacity_h / Decimal(self.days_per_week)
        days = 0
        for i in range(7):
            d = week + timedelta(days=i)
            if not self.calendar.is_working_day(d):
                continue
            if any(a <= d <= b for a, b in self.leave.get(profile.user_id, [])):
                continue
            days += 1
        return (per_day * days).quantize(Decimal("0.1"))


# --- Allocations (F-17) ---------------------------------------------------------------------


def _check_stage(project: Project, stage: Stage) -> None:
    if stage.project_id != project.pk:
        raise DomainError("invalid_stage", "That stage belongs to another project.")


@transaction.atomic
def set_allocations(
    actor: User,
    *,
    user: User,
    project: Project,
    stage: Stage,
    weeks: list[date],
    hours: Decimal,
) -> list[Allocation]:
    """F-17: 'allocate 20 h on Project X Stage 4 for weeks 44–47 in one action'. 0 removes."""
    require(actor, Action.ALLOCATE_HOURS, project=project)
    _check_stage(project, stage)
    if not ProjectMembership.objects.filter(project=project, user=user).exists():
        raise DomainError("not_member", f"{user} is not on this project's team.")
    if hours < 0 or hours > 100:
        raise DomainError("invalid_hours", "Hours per week must be between 0 and 100.")
    result = []
    for week in sorted({monday(w) for w in weeks}):
        existing = Allocation.objects.filter(user=user, stage=stage, week=week).first()
        if hours == 0:
            if existing:
                delete_record(existing, actor=actor, verb="allocation.deleted")
        elif existing:
            result.append(
                update_record(existing, actor=actor, verb="allocation.updated", planned_h=hours)
            )
        else:
            result.append(
                create_record(
                    Allocation,
                    actor=actor,
                    verb="allocation.created",
                    organisation_id=project.organisation_id,
                    user=user,
                    project=project,
                    stage=stage,
                    week=week,
                    planned_h=hours,
                )
            )
        emit(
            "allocation.changed",
            {"user_id": str(user.pk), "week": week.isoformat()},
            organisation_id=project.organisation_id,
        )
    return result


@transaction.atomic
def copy_forward(
    actor: User, *, user: User, week: date, count: int, project: Project | None = None
) -> int:
    """Copy one week's allocations to the next `count` weeks ('copy to next weeks')."""
    if not ProjectMembership.objects.filter(
        user=actor, role__in=[ProjectRole.PL, ProjectRole.DL]
    ).exists():
        raise PermissionDeniedError(Action.ALLOCATE_HOURS)
    if not 1 <= count <= 26:
        raise DomainError("invalid_count", "Copy to between 1 and 26 weeks.")
    source = Allocation.objects.filter(user=user, week=monday(week)).select_related(
        "project", "stage"
    )
    if project is not None:
        source = source.filter(project=project)
    copied = 0
    for a in source:
        if not can(actor, Action.ALLOCATE_HOURS, project=a.project):
            continue
        targets = [monday(week) + timedelta(weeks=i) for i in range(1, count + 1)]
        set_allocations(
            actor, user=user, project=a.project, stage=a.stage, weeks=targets, hours=a.planned_h
        )
        copied += len(targets)
    return copied


# --- Visibility (03 §9) ---------------------------------------------------------------------


def visible_people(viewer: User) -> QuerySet[User]:
    """People whose hours and workload the viewer may see."""
    org_users = User.objects.filter(organisation_id=viewer.org_pk, is_active=True)
    if viewer.org_role == OrgRole.OWNER:
        return org_users
    q = Q(pk=viewer.pk)
    disciplines, all_disciplines = led_disciplines(viewer)
    if all_disciplines:
        dl_projects = ProjectMembership.objects.filter(
            user=viewer, role=ProjectRole.DL, discipline__isnull=True
        ).values("project_id")
        q |= Q(memberships__project_id__in=dl_projects)
    if disciplines:
        q |= Q(staff_profile__discipline_id__in=disciplines)
    pl_projects = ProjectMembership.objects.filter(user=viewer, role=ProjectRole.PL).values(
        "project_id"
    )
    q |= Q(memberships__project_id__in=pl_projects)
    return org_users.filter(q).distinct()


def workload(viewer: User, start: date, end: date, discipline_id: Any = None) -> dict[str, Any]:
    """S-09 heat map: people × weeks, % of capacity, with over/under per A-05 thresholds."""
    from apps.automation.engine import rule_config

    weeks = weeks_between(start, end)[:26]
    people = visible_people(viewer).select_related("staff_profile__discipline")
    if discipline_id:
        people = people.filter(staff_profile__discipline_id=discipline_id)
    organisation = viewer.org
    cap = Capacity(organisation, weeks[0], weeks[-1])
    params = rule_config(organisation, "A-05").params or {}
    over = Decimal(str(params.get("over_allocated_pct", 110)))
    under = Decimal(str(params.get("under_allocated_pct", 50)))
    planned = {
        (r["user_id"], r["week"]): r["total"]
        for r in Allocation.objects.filter(user__in=people, week__in=weeks)
        .values("user_id", "week")
        .annotate(total=Sum("planned_h"))
    }
    rows = []
    for person in people.order_by("full_name", "email"):
        profile = profile_for(person)
        cells = []
        for w in weeks:
            capacity = cap.hours(profile, w)
            hours = planned.get((person.pk, w), Decimal("0"))
            pct = int((hours / capacity * 100).quantize(Decimal("1"))) if capacity else None
            band = None
            if pct is not None and Decimal(pct) > over:
                band = "over"
            elif pct is not None and Decimal(pct) < under:
                band = "under"
            cells.append(
                {"week": w, "capacity_h": capacity, "planned_h": hours, "pct": pct, "band": band}
            )
        rows.append(
            {
                "user": person,
                "discipline": profile.discipline.code if profile.discipline else None,
                "cells": cells,
            }
        )
    return {"weeks": weeks, "people": rows, "over_pct": int(over), "under_pct": int(under)}


# --- Timesheets (F-18) ----------------------------------------------------------------------


def timesheet_for(user: User, week: date) -> Timesheet:
    sheet, _ = Timesheet.objects.get_or_create(
        user=user, week=monday(week), defaults={"organisation_id": user.org_pk}
    )
    return sheet


def allowed_stages(user: User, week: date) -> QuerySet[Stage]:
    """A person logs hours only on projects/stages they are allocated to or a member of."""
    allocated = Allocation.objects.filter(user=user, week=monday(week)).values("stage_id")
    member_projects = ProjectMembership.objects.filter(user=user).values("project_id")
    return (
        Stage.objects.filter(Q(pk__in=allocated) | Q(project_id__in=member_projects))
        .filter(project__status="active")
        .select_related("project")
    )


EDITABLE = (TimesheetState.DRAFT, TimesheetState.RETURNED)


@transaction.atomic
def save_entries(actor: User, sheet: Timesheet, entries: list[dict[str, Any]]) -> Timesheet:
    """Replace the week's entries (the grid saves whole)."""
    require(actor, Action.LOG_OWN_TIMESHEET)
    sheet = Timesheet.objects.select_for_update().get(pk=sheet.pk)
    if sheet.user_id != actor.pk:
        raise DomainError("not_found", "Timesheet not found.", status_code=404)
    if sheet.state not in EDITABLE:
        raise ConflictError("locked", "This week is submitted or approved and cannot be changed.")
    allowed = {s.pk: s for s in allowed_stages(actor, sheet.week)}
    discipline_id = profile_for(actor).discipline_id
    days = {sheet.week + timedelta(days=i) for i in range(7)}
    per_day: dict[date, Decimal] = {}
    clean: list[TimeEntry] = []
    for e in entries:
        stage = allowed.get(e["stage"].pk if isinstance(e["stage"], Stage) else e["stage"])
        if stage is None:
            raise DomainError(
                "stage_not_allowed",
                "You can log hours only on projects you are on or allocated to.",
            )
        if e["date"] not in days:
            raise DomainError("wrong_week", "An entry is outside this week.")
        hours = Decimal(str(e["hours"]))
        if hours <= 0:
            continue
        per_day[e["date"]] = per_day.get(e["date"], Decimal("0")) + hours
        if per_day[e["date"]] > 24:
            raise DomainError("day_over_24", f"More than 24 hours on {e['date']:%d-%b-%Y}.")
        clean.append(
            TimeEntry(
                organisation_id=sheet.organisation_id,
                timesheet=sheet,
                project=stage.project,
                stage=stage,
                discipline_id=discipline_id,
                date=e["date"],
                hours=hours,
                note=e.get("note", ""),
            )
        )
    before = {"hours": str(sheet.entries.aggregate(t=Sum("hours"))["t"] or 0)}
    sheet.entries.all().delete()
    TimeEntry.objects.bulk_create(clean)
    record_change(
        sheet,
        actor=actor,
        verb="timesheet.saved",
        before=before,
        after={"hours": str(sum((c.hours for c in clean), Decimal("0")))},
        organisation_id=sheet.organisation_id,
    )
    return sheet


@transaction.atomic
def submit(actor: User, sheet: Timesheet) -> Timesheet:
    require(actor, Action.LOG_OWN_TIMESHEET)
    sheet = Timesheet.objects.select_for_update().get(pk=sheet.pk)
    if sheet.user_id != actor.pk:
        raise DomainError("not_found", "Timesheet not found.", status_code=404)
    if sheet.state not in EDITABLE:
        raise ConflictError("already_submitted", "This week is already submitted.")
    return _set_state(
        sheet, actor, TimesheetState.SUBMITTED, "timesheet.submitted", submitted_at=timezone.now()
    )


def can_approve(actor: User, sheet: Timesheet) -> bool:
    """A DL leading the person's discipline on a shared project, or a PL of a project the
    week has hours on (DD-023). Never the person themselves."""
    if actor.pk == sheet.user_id:
        return False
    profile = profile_for(sheet.user)
    shared = ProjectMembership.objects.filter(user=sheet.user).values("project_id")
    dl = ProjectMembership.objects.filter(user=actor, role=ProjectRole.DL, project_id__in=shared)
    if dl.filter(Q(discipline__isnull=True) | Q(discipline_id=profile.discipline_id)).exists():
        return True
    logged = sheet.entries.values("project_id")
    return ProjectMembership.objects.filter(
        user=actor, role=ProjectRole.PL, project_id__in=logged
    ).exists()


@transaction.atomic
def approve(actor: User, sheet: Timesheet) -> Timesheet:
    sheet = Timesheet.objects.select_for_update().get(pk=sheet.pk)
    if not can_approve(actor, sheet):
        raise PermissionDeniedError(Action.APPROVE_TIMESHEETS, "You can't approve this timesheet.")
    if sheet.state != TimesheetState.SUBMITTED:
        raise ConflictError("not_submitted", "Only a submitted week can be approved.")
    return _set_state(
        sheet,
        actor,
        TimesheetState.APPROVED,
        "timesheet.approved",
        approved_at=timezone.now(),
        approved_by=actor,
    )


@transaction.atomic
def return_sheet(actor: User, sheet: Timesheet, reason: str) -> Timesheet:
    """Send a submitted week back for correction (DD-023: needed when a week was wrong)."""
    sheet = Timesheet.objects.select_for_update().get(pk=sheet.pk)
    if not can_approve(actor, sheet):
        raise PermissionDeniedError(Action.APPROVE_TIMESHEETS, "You can't return this timesheet.")
    if sheet.state != TimesheetState.SUBMITTED:
        raise ConflictError("not_submitted", "Only a submitted week can be returned.")
    if not reason.strip():
        raise DomainError("reason_required", "Say what to correct.")
    return _set_state(
        sheet, actor, TimesheetState.RETURNED, "timesheet.returned", return_reason=reason
    )


def _set_state(sheet: Timesheet, actor: User, state: str, verb: str, **fields: Any) -> Timesheet:
    before = {"state": sheet.state}
    sheet.state = state
    for k, v in fields.items():
        setattr(sheet, k, v)
    sheet.save()
    record_change(
        sheet,
        actor=actor,
        verb=verb,
        before=before,
        after={"state": state},
        organisation_id=sheet.organisation_id,
    )
    emit(
        verb,
        {
            "timesheet_id": str(sheet.pk),
            "user_id": str(sheet.user_id),
            "week": sheet.week.isoformat(),
        },
        organisation_id=sheet.organisation_id,
    )
    return sheet


def approvals_for(actor: User) -> list[Timesheet]:
    candidates = (
        Timesheet.objects.filter(organisation_id=actor.org_pk, state=TimesheetState.SUBMITTED)
        .exclude(user=actor)
        .select_related("user")
        .prefetch_related("entries")
    )
    return [t for t in candidates if can_approve(actor, t)]


def missing_for(actor: User, week: date) -> list[User]:
    """People the actor can see with no submitted or approved timesheet for that week."""
    done = Timesheet.objects.filter(
        week=monday(week), state__in=[TimesheetState.SUBMITTED, TimesheetState.APPROVED]
    ).values("user_id")
    return list(
        visible_people(actor)
        .filter(org_role__in=[OrgRole.STAFF, OrgRole.OWNER, OrgRole.ACCOUNTS])
        .exclude(pk__in=done)
        .exclude(pk=actor.pk)
        .order_by("full_name")
    )


# --- CSV import from an existing timesheet tool (DEC-03) -----------------------------------

CSV_COLUMNS = ["email", "date", "project", "stage", "hours", "note"]


@transaction.atomic
def import_csv(actor: User, content: bytes) -> dict[str, Any]:
    """Admin import of hours from another tool: email,date,project,stage,hours,note. Weeks are
    created as submitted; existing approved weeks are left untouched. All-or-nothing."""
    require(actor, Action.MANAGE_ORG_SETTINGS)
    from apps.register.imports import parse_date

    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    missing = [c for c in CSV_COLUMNS[:5] if c not in (reader.fieldnames or [])]
    if missing:
        raise DomainError("missing_columns", f"Missing columns: {', '.join(missing)}.")
    errors: list[str] = []
    rows: list[tuple[User, Stage, date, Decimal, str]] = []
    users = {u.email.lower(): u for u in User.objects.filter(organisation_id=actor.org_pk)}
    for n, row in enumerate(reader, start=2):
        user = users.get((row.get("email") or "").strip().lower())
        stage_key = (row.get("stage") or "").strip()
        stages = Stage.objects.filter(
            project__organisation_id=actor.org_pk, project__code=(row.get("project") or "").strip()
        )
        stage = stages.filter(name__iexact=stage_key).first()
        if stage is None and stage_key.isdigit():
            stage = stages.filter(seq=int(stage_key)).first()
        try:
            day = parse_date(row.get("date") or "")
            hours = Decimal(str(row.get("hours") or "0"))
        except Exception:
            errors.append(f"Row {n}: bad date or hours.")
            continue
        if user is None:
            errors.append(f"Row {n}: unknown person {row.get('email')}.")
        elif stage is None:
            errors.append(f"Row {n}: unknown project or stage.")
        elif day is None or not 0 < hours <= 24:
            errors.append(f"Row {n}: date and hours (0–24) are required.")
        else:
            rows.append((user, stage, day, hours, (row.get("note") or "")[:300]))
    if errors:
        raise ConflictError("import_errors", f"{len(errors)} rows have errors.", errors=errors[:50])
    weeks: dict[tuple[Any, date], Timesheet] = {}
    skipped = 0
    for user, stage, day, hours, note in rows:
        key = (user.pk, monday(day))
        if key not in weeks:
            sheet = timesheet_for(user, day)
            if sheet.state == TimesheetState.APPROVED:
                weeks[key] = sheet
            else:
                sheet.state = TimesheetState.SUBMITTED
                sheet.submitted_at = timezone.now()
                sheet.imported = True
                sheet.save()
                weeks[key] = sheet
        sheet = weeks[key]
        if sheet.state == TimesheetState.APPROVED and not sheet.imported:
            skipped += 1
            continue
        TimeEntry.objects.update_or_create(
            timesheet=sheet,
            stage=stage,
            date=day,
            defaults={
                "organisation_id": sheet.organisation_id,
                "project": stage.project,
                "discipline_id": profile_for(user).discipline_id,
                "hours": hours,
                "note": note,
            },
        )
    record(
        organisation_id=actor.org_pk,
        actor=actor,
        verb="timesheets.imported",
        entity_type="people.timesheet",
        entity_id="-",
        after={"rows": len(rows), "weeks": len(weeks), "skipped": skipped},
    )
    return {"rows": len(rows), "weeks": len(weeks), "skipped": skipped}

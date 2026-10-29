"""Dashboards and reports (03 §11: D-01..D-05; 03 §9 reports).

Counts come from the `dash_sheet_stats` materialised view (refreshed every 5 minutes, F-22);
lists that must be exact (late list, check queue, my sheets) read the live tables. Every
function scopes to what the viewer may see (F-23, F-38).
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Max, Min, Q, QuerySet, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, PermissionDeniedError, can, require
from apps.accounts.roles import OrgRole, ProjectRole
from apps.automation.models import Flag, FlagKind
from apps.core.calendar import WorkingCalendar
from apps.core.clock import org_today
from apps.core.models import Discipline, Organisation
from apps.people.models import Allocation, TimeEntry, Timesheet, TimesheetState
from apps.people.services import Capacity, monday, profile_for, timesheet_for, visible_people
from apps.projects.models import Project, ProjectMembership, ProjectStatus, Stage, StageState
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet, SheetState
from apps.register.selectors import open_flags
from apps.transmittals.models import Transmittal
from apps.workflow.models import Review, ReviewKind, ReviewState, StatusTransition
from apps.workflow.selectors import review_queue
from apps.workflow.services import allowed_actions

from .models import MetricSnapshot, SheetStats

REFRESHED_KEY = "dashboards:refreshed_at"
ACTIVE_SHEET_STATES = [
    SheetState.PLANNED,
    SheetState.IN_PROGRESS,
    SheetState.READY_FOR_CHECK,
    SheetState.IN_CHECK,
    SheetState.CHANGES_REQUESTED,
    SheetState.APPROVED_FOR_ISSUE,
]
WAITING_REVIEW = [SheetState.READY_FOR_CHECK, SheetState.IN_CHECK]


# --- Read model refresh ----------------------------------------------------------------------


def refresh(now: datetime | None = None) -> datetime:
    """Refresh the materialised view and today's metric snapshots. Idempotent."""
    with connection.cursor() as cursor:
        cursor.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dash_sheet_stats")
    at = now or timezone.now()
    cache.set(REFRESHED_KEY, at.isoformat(), timeout=None)
    for organisation in Organisation.objects.all():
        snapshot_metrics(organisation)
    return at


def refreshed_at() -> datetime | None:
    raw = cache.get(REFRESHED_KEY)
    if raw:
        return datetime.fromisoformat(raw)
    return SheetStats.objects.aggregate(t=Max("refreshed_at"))["t"]


def _org_totals(organisation: Organisation) -> dict[str, Decimal]:
    active = Project.objects.filter(organisation=organisation, status=ProjectStatus.ACTIVE)
    stats = SheetStats.objects.filter(project_id__in=active.values("pk")).aggregate(
        late=Sum("late"), at_risk=Sum("at_risk")
    )
    over = Flag.objects.filter(
        organisation=organisation,
        kind=FlagKind.OVER_ALLOCATED,
        cleared_at__isnull=True,
        week=monday(org_today(organisation)),
    ).count()
    return {
        "late": Decimal(stats["late"] or 0),
        "at_risk": Decimal(stats["at_risk"] or 0),
        "over_allocated": Decimal(over),
    }


def snapshot_metrics(organisation: Organisation) -> None:
    today = org_today(organisation)
    for key, value in _org_totals(organisation).items():
        MetricSnapshot.objects.update_or_create(
            organisation=organisation, date=today, key=key, defaults={"value": value}
        )


def _delta(organisation: Organisation, key: str, now_value: int) -> int | None:
    week_ago = org_today(organisation) - timedelta(days=7)
    row = MetricSnapshot.objects.filter(organisation=organisation, key=key, date=week_ago).first()
    return None if row is None else now_value - int(row.value)


# --- Shared helpers --------------------------------------------------------------------------


def _local_date(value: datetime | None, tz: ZoneInfo) -> date | None:
    return value.astimezone(tz).date() if value else None


def _waiting_days(sheets: QuerySet[Sheet], calendar: WorkingCalendar, today: date) -> int | None:
    oldest = sheets.filter(state__in=WAITING_REVIEW).aggregate(t=Min("state_changed_at"))["t"]
    if oldest is None:
        return None
    return calendar.working_days_between(oldest.date(), today)


def current_stage(stages: list[Stage]) -> Stage | None:
    """The active stage with the lowest seq; else the first not yet finished."""
    ordered = sorted(stages, key=lambda s: s.seq)
    for s in ordered:
        if s.state == StageState.ACTIVE:
            return s
    for s in ordered:
        if s.state in (StageState.PLANNED, StageState.ON_HOLD):
            return s
    return ordered[-1] if ordered else None


def _leads(project_ids: list[Any]) -> dict[Any, list[str]]:
    out: dict[Any, list[str]] = defaultdict(list)
    for m in ProjectMembership.objects.filter(
        project_id__in=project_ids, role=ProjectRole.PL
    ).select_related("user"):
        out[m.project_id].append(m.user.short_name)
    return out


def discipline_load(people: QuerySet[User], start: date, weeks: int) -> list[dict[str, Any]]:
    """Planned hours as % of capacity per discipline per week (S-03 heat map row)."""
    week_list = [start + timedelta(weeks=i) for i in range(weeks)]
    people = people.select_related("staff_profile__discipline")
    if not people.exists():
        return []
    organisation = people.first().org  # type: ignore[union-attr]
    cap = Capacity(organisation, week_list[0], week_list[-1])
    planned = {
        (r["user_id"], r["week"]): r["t"]
        for r in Allocation.objects.filter(user__in=people, week__in=week_list)
        .values("user_id", "week")
        .annotate(t=Sum("planned_h"))
    }
    totals: dict[Any, dict[date, list[Decimal]]] = defaultdict(
        lambda: {w: [Decimal(0), Decimal(0)] for w in week_list}
    )
    names: dict[Any, tuple[str, str]] = {}
    for person in people:
        profile = profile_for(person)
        if profile.discipline is None:
            continue
        names[profile.discipline_id] = (profile.discipline.code, profile.discipline.name)
        for w in week_list:
            totals[profile.discipline_id][w][0] += planned.get((person.pk, w), Decimal(0))
            totals[profile.discipline_id][w][1] += cap.hours(profile, w)
    rows = []
    for discipline_id, by_week in totals.items():
        code, name = names[discipline_id]
        rows.append(
            {
                "discipline": discipline_id,
                "code": code,
                "name": name,
                "cells": [
                    {
                        "week": w,
                        "planned_h": p,
                        "capacity_h": c,
                        "pct": int((p / c * 100).quantize(Decimal(1))) if c else None,
                    }
                    for w, (p, c) in by_week.items()
                ],
            }
        )
    return sorted(rows, key=lambda r: r["code"])


# --- D-01 Portfolio ---------------------------------------------------------------------------


def portfolio_projects(user: User) -> QuerySet[Project]:
    qs = Project.objects.filter(organisation_id=user.org_pk, status=ProjectStatus.ACTIVE)
    if user.org_role == OrgRole.OWNER:
        return qs
    led = ProjectMembership.objects.filter(user=user, role=ProjectRole.PL).values("project_id")
    return qs.filter(pk__in=led)


def portfolio(user: User) -> dict[str, Any]:
    """D-01 (F-22): every active project with counts; metric cards with week-on-week deltas."""
    require(user, Action.VIEW_PORTFOLIO)
    organisation = user.org
    today = org_today(organisation)
    calendar = WorkingCalendar.for_org(organisation)
    projects = list(portfolio_projects(user).prefetch_related("stages").order_by("code"))
    ids = [p.pk for p in projects]
    stats: dict[Any, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in SheetStats.objects.filter(project_id__in=ids).values(
        "project_id", "planned", "issued", "late", "at_risk", "in_check"
    ):
        for k in ("planned", "issued", "late", "at_risk", "in_check"):
            stats[row["project_id"]][k] += row[k]
    leads = _leads(ids)
    rows: list[dict[str, Any]] = []
    for p in projects:
        stages = list(p.stages.all())
        cur = current_stage(stages)
        nxt = next(
            (s for s in sorted(stages, key=lambda s: s.seq) if cur and s.seq > cur.seq), None
        )
        s = stats[p.pk]
        rows.append(
            {
                "project": p,
                "stage": {"seq": cur.seq, "name": cur.name, "state": cur.state} if cur else None,
                "planned": s["planned"],
                "issued": s["issued"],
                "late": s["late"],
                "at_risk": s["at_risk"],
                "leads": leads.get(p.pk, []),
                "next_stage_date": (
                    nxt.planned_start if nxt else (cur.planned_end if cur else None)
                ),
            }
        )
    rows.sort(key=lambda r: (-r["late"], -r["at_risk"], r["project"].code))
    sheets = Sheet.objects.filter(project_id__in=ids)
    people = (
        User.objects.filter(organisation=organisation, is_active=True)
        if user.org_role == OrgRole.OWNER
        else User.objects.filter(memberships__project_id__in=ids, is_active=True).distinct()
    )
    over = (
        Flag.objects.filter(
            organisation=organisation,
            kind=FlagKind.OVER_ALLOCATED,
            cleared_at__isnull=True,
            week=monday(today),
            user__in=people,
        )
        .values("user_id")
        .distinct()
        .count()
    )
    late = sum(r["late"] for r in rows)
    at_risk = sum(r["at_risk"] for r in rows)
    org_wide = user.org_role == OrgRole.OWNER
    return {
        "updated_at": refreshed_at(),
        "active_projects": len(rows),
        "late": late,
        "late_delta": _delta(organisation, "late", late) if org_wide else None,
        "at_risk": at_risk,
        "at_risk_delta": _delta(organisation, "at_risk", at_risk) if org_wide else None,
        "oldest_review_days": _waiting_days(sheets, calendar, today),
        "over_allocated_people": over,
        "projects": rows,
        "discipline_load": discipline_load(people, monday(today), 4),
        "ready_to_invoice": _ready_to_invoice(ids),
    }


def _ready_to_invoice(project_ids: list[Any]) -> dict[str, Any]:
    """D-01 (P2): stages ready to invoice, their fee amount and the oldest wait (F-27)."""
    from apps.billing.models import BillingSignal
    from apps.billing.services import totals

    return totals(BillingSignal.objects.filter(project_id__in=project_ids))


# --- D-02 Project dashboard -------------------------------------------------------------------


def burn_up(project: Project, tz: ZoneInfo, today: date) -> dict[str, Any]:
    """Planned vs issued sheets over time per discipline (cumulative, weekly)."""
    sheets = list(
        Sheet.objects.filter(project=project)
        .exclude(state=SheetState.CANCELLED)
        .annotate(first_issued=Min("revisions__issued_at"))
        .values("discipline__code", "planned_issue_date", "first_issued")
    )
    dates = [s["planned_issue_date"] for s in sheets if s["planned_issue_date"]] + [
        d for s in sheets if (d := _local_date(s["first_issued"], tz))
    ]
    if not dates:
        return {"weeks": [], "series": []}
    start = monday(min(dates))
    end = monday(max([*dates, today]))
    weeks = [start + timedelta(weeks=i) for i in range((end - start).days // 7 + 1)][-104:]
    by_disc: dict[str, list[tuple[date | None, date | None]]] = defaultdict(list)
    for s in sheets:
        pair = (s["planned_issue_date"], _local_date(s["first_issued"], tz))
        by_disc[s["discipline__code"]].append(pair)
        by_disc["All"].append(pair)
    series = []
    for code in sorted(by_disc, key=lambda c: (c != "All", c)):
        pairs = by_disc[code]
        ends = [w + timedelta(days=6) for w in weeks]
        series.append(
            {
                "discipline": code,
                "planned": [sum(1 for p, _ in pairs if p and p <= e) for e in ends],
                "issued": [
                    sum(1 for _, i in pairs if i and i <= e) if w <= today else None
                    for w, e in zip(weeks, ends, strict=True)
                ],
                "total": len(pairs),
            }
        )
    return {"weeks": weeks, "series": series}


def project_dashboard(user: User, project: Project) -> dict[str, Any]:
    """D-02 (F-23)."""
    require(user, Action.VIEW_PROJECT, project=project)
    organisation = project.organisation
    tz = ZoneInfo(organisation.timezone)
    today = org_today(organisation)
    disciplines = {d.pk: d for d in Discipline.objects.filter(organisation=organisation)}
    by_discipline = [
        {
            "discipline": row.discipline_id,
            "code": disciplines[row.discipline_id].code
            if row.discipline_id in disciplines
            else "?",
            "planned": row.planned,
            "issued": row.issued,
            "late": row.late,
            "at_risk": row.at_risk,
            "in_check": row.in_check,
        }
        for row in SheetStats.objects.filter(project_id=project.pk)
    ]
    late = (
        Flag.objects.filter(sheet__project=project, kind=FlagKind.LATE, cleared_at__isnull=True)
        .select_related("sheet__owner", "sheet__discipline", "sheet__project")
        .order_by("sheet__planned_issue_date")[:10]
    )
    week = monday(today)
    allocations = (
        Allocation.objects.filter(project=project, week=week)
        .values("user_id", "user__full_name")
        .annotate(planned=Sum("planned_h"))
        .order_by("user__full_name")
    )
    loads = {
        r["user_id"]: r["t"]
        for r in Allocation.objects.filter(
            week=week, user_id__in=[a["user_id"] for a in allocations]
        )
        .values("user_id")
        .annotate(t=Sum("planned_h"))
    }
    cap = Capacity(organisation, week, week)
    team = []
    for a in allocations:
        person = User.objects.get(pk=a["user_id"])
        capacity = cap.hours(profile_for(person), week)
        total = loads.get(a["user_id"], Decimal(0))
        team.append(
            {
                "user": person,
                "planned_h": a["planned"],
                "total_h": total,
                "capacity_h": capacity,
                "pct": int((total / capacity * 100).quantize(Decimal(1))) if capacity else None,
            }
        )
    transmittals = (
        Transmittal.objects.filter(project=project)
        .annotate(
            n_sheets=Count("items", distinct=True), n_recipients=Count("recipients", distinct=True)
        )
        .order_by("-sent_at")[:5]
    )
    return {
        "updated_at": refreshed_at(),
        "unacknowledged": unacknowledged(project),
        "construction": construction_summary(project),
        "by_discipline": by_discipline,
        "burn_up": burn_up(project, tz, today),
        "late": [
            {
                "sheet": f.sheet,
                "days": f.data.get("days", 0),
                "owner": f.sheet.owner.short_name if f.sheet and f.sheet.owner else None,
            }
            for f in late
        ],
        "stages": list(project.stages.order_by("seq")),
        "team_this_week": team,
        "transmittals": [
            {
                "id": t.pk,
                "number": t.number,
                "purpose": t.purpose,
                "sent_at": t.sent_at,
                "sheets": t.n_sheets,
                "recipients": t.n_recipients,
            }
            for t in transmittals
        ],
    }


def construction_summary(project: Project) -> dict[str, Any]:
    """D-02 additions: open client comments (P2), and RFIs and change orders (P3, F-33)."""
    from apps.ca.models import ChangeOrder, ChangeStatus, Rfi, RfiStatus
    from apps.comments.models import OPEN_STATUSES, ClientComment

    open_rfis = Rfi.objects.filter(project=project, status=RfiStatus.OPEN)
    today = org_today(project.organisation)
    orders = ChangeOrder.objects.filter(project=project).exclude(status=ChangeStatus.REJECTED)
    return {
        "open_comments": ClientComment.objects.filter(
            project=project, status__in=OPEN_STATUSES
        ).count(),
        "open_rfis": open_rfis.count(),
        "overdue_rfis": open_rfis.filter(due_on__lt=today).count(),
        "change_orders": [
            {
                "id": c.pk,
                "number": c.number,
                "title": c.title,
                "status": c.status,
                "cost_impact": c.cost_impact,
                "schedule_impact_days": c.schedule_impact_days,
            }
            for c in orders.order_by("-seq")[:10]
        ],
    }


def unacknowledged(project: Project) -> list[dict[str, Any]]:
    """F-15: emailed recipients who have not acknowledged after N days (OrgSettings)."""
    from apps.core.models import OrgSettings
    from apps.transmittals.models import Delivery, TransmittalRecipient

    days = OrgSettings.objects.get(organisation_id=project.organisation_id).acknowledge_within_days
    cutoff = timezone.now() - timedelta(days=days)
    rows = (
        TransmittalRecipient.objects.filter(
            transmittal__project=project,
            delivery=Delivery.EMAIL,
            delivered_at__lte=cutoff,
            acknowledged_at__isnull=True,
            bounced_at__isnull=True,
        )
        .select_related("transmittal", "contact")
        .order_by("delivered_at")[:20]
    )
    now = timezone.now()
    return [
        {
            "transmittal": r.transmittal_id,
            "number": r.transmittal.number,
            "contact": r.contact.full_name,
            "days": (now - r.delivered_at).days if r.delivered_at else 0,
        }
        for r in rows
    ]


# --- D-03 Discipline dashboard ----------------------------------------------------------------


def discipline_projects(user: User, discipline: Discipline) -> QuerySet[Project]:
    active = Project.objects.filter(organisation_id=user.org_pk, status=ProjectStatus.ACTIVE)
    if user.org_role == OrgRole.OWNER:
        return active
    led = ProjectMembership.objects.filter(user=user, role=ProjectRole.DL).filter(
        Q(discipline__isnull=True) | Q(discipline=discipline)
    )
    return active.filter(pk__in=led.values("project_id"))


def discipline_dashboard(user: User, discipline: Discipline) -> dict[str, Any]:
    """D-03 (F-23): assignments, check queue, capacity this week and next."""
    projects = discipline_projects(user, discipline)
    if user.org_role != OrgRole.OWNER and not projects.exists():
        raise PermissionDeniedError(Action.ALLOCATE_HOURS, "You don't lead this discipline.")
    organisation = user.org
    today = org_today(organisation)
    calendar = WorkingCalendar.for_org(organisation)
    sheets = Sheet.objects.filter(project__in=projects, discipline=discipline)
    open_flags = Flag.objects.filter(sheet__in=sheets, cleared_at__isnull=True)
    late_ids = set(open_flags.filter(kind=FlagKind.LATE).values_list("sheet_id", flat=True))
    risk_ids = set(open_flags.filter(kind=FlagKind.AT_RISK).values_list("sheet_id", flat=True))
    assignments: dict[Any, dict[str, Any]] = {}
    for s in sheets.filter(state__in=ACTIVE_SHEET_STATES).select_related("owner"):
        key = s.owner_id
        row = assignments.setdefault(
            key,
            {
                "owner": s.owner,
                "total": 0,
                "by_state": defaultdict(int),
                "late": 0,
                "at_risk": 0,
                "next_due": None,
            },
        )
        row["total"] += 1
        row["by_state"][s.state] += 1
        row["late"] += s.pk in late_ids
        row["at_risk"] += s.pk in risk_ids
        if s.planned_issue_date and (
            row["next_due"] is None or s.planned_issue_date < row["next_due"]
        ):
            row["next_due"] = s.planned_issue_date
    queue: list[dict[str, Any]] = []
    for s in sheets.filter(state__in=WAITING_REVIEW).select_related("project", "owner", "checker"):
        since = (s.state_changed_at or s.updated_at).date()
        queue.append(
            {
                "sheet": s,
                "project_code": s.project.code,
                "checker": s.checker.short_name if s.checker else None,
                "owner": s.owner.short_name if s.owner else None,
                "working_days": calendar.working_days_between(since, today),
            }
        )
    queue.sort(key=lambda r: -r["working_days"])
    people = visible_people(user).filter(staff_profile__discipline=discipline)
    capacity = discipline_people_load(people, monday(today))
    return {
        "discipline": discipline,
        "projects": projects.count(),
        "assignments": sorted(
            (dict(r, by_state=dict(r["by_state"])) for r in assignments.values()),
            key=lambda r: (-int(r["late"]), -int(r["total"])),
        ),
        "check_queue": queue,
        "capacity": capacity,
    }


def discipline_people_load(people: QuerySet[User], week: date) -> list[dict[str, Any]]:
    weeks = [week, week + timedelta(weeks=1)]
    people = people.select_related("staff_profile")
    if not people.exists():
        return []
    cap = Capacity(people.first().org, weeks[0], weeks[1])  # type: ignore[union-attr]
    planned = {
        (r["user_id"], r["week"]): r["t"]
        for r in Allocation.objects.filter(user__in=people, week__in=weeks)
        .values("user_id", "week")
        .annotate(t=Sum("planned_h"))
    }
    rows = []
    for person in people.order_by("full_name"):
        profile = profile_for(person)
        cells = []
        for w in weeks:
            c = cap.hours(profile, w)
            p = planned.get((person.pk, w), Decimal(0))
            cells.append(
                {
                    "week": w,
                    "planned_h": p,
                    "capacity_h": c,
                    "pct": int((p / c * 100).quantize(Decimal(1))) if c else None,
                }
            )
        rows.append({"user": person, "cells": cells})
    return rows


# --- D-04 My work -----------------------------------------------------------------------------


def my_work(user: User) -> dict[str, Any]:
    """D-04 (F-23): my sheets by due date, returned sheets, my reviews, timesheet status."""
    organisation = user.org
    today = org_today(organisation)
    mine = (
        Sheet.objects.filter(
            owner=user, state__in=ACTIVE_SHEET_STATES, project__in=visible_projects(user)
        )
        .select_related("project", "discipline", "stage", "current_revision")
        .prefetch_related(open_flags())
        .order_by("planned_issue_date", "number")
    )
    due = []
    for s in mine[:50]:
        actions = [a for a in allowed_actions(s, user) if not a.blocked_reason]
        due.append({"sheet": s, "next_action": actions[0] if actions else None})
    returned = []
    for s in mine.filter(state=SheetState.CHANGES_REQUESTED):
        t = (
            StatusTransition.objects.filter(sheet=s, to_state=SheetState.CHANGES_REQUESTED)
            .select_related("actor")
            .order_by("-created_at")
            .first()
        )
        returned.append(
            {
                "sheet": s,
                "by": t.actor.short_name if t and t.actor else None,
                "at": t.created_at if t else s.state_changed_at,
                "reason": t.reason if t else "",
            }
        )
    queue = review_queue(user)
    week = monday(today)
    sheet = timesheet_for(user, week)
    last = Timesheet.objects.filter(user=user, week=week - timedelta(weeks=1)).first()
    capacity = Capacity(organisation, week, week).hours(profile_for(user), week)
    return {
        "week": week,
        "due": due,
        "returned": returned,
        "reviews_waiting": len(queue),
        "oldest_review_days": max((q.working_days_waiting for q in queue), default=None),
        "timesheet": {
            "id": sheet.pk,
            "state": sheet.state,
            "logged_h": sheet.entries.aggregate(t=Sum("hours"))["t"] or Decimal(0),
            "capacity_h": capacity,
            "planned_h": Allocation.objects.filter(user=user, week=week).aggregate(
                t=Sum("planned_h")
            )["t"]
            or Decimal(0),
            "last_week_state": last.state if last else TimesheetState.DRAFT,
        },
        "logs_hours": can(user, Action.LOG_OWN_TIMESHEET),
        "led_disciplines": led_disciplines(user),
    }


def led_disciplines(user: User) -> list[Discipline]:
    """Disciplines whose dashboard (D-03) this person can open."""
    rows = ProjectMembership.objects.filter(
        user=user, role=ProjectRole.DL, project__status=ProjectStatus.ACTIVE
    ).values_list("discipline_id", flat=True)
    ids = set(rows)
    qs = Discipline.objects.filter(organisation_id=user.org_pk)
    if None not in ids:
        qs = qs.filter(pk__in=ids)
    return list(qs.order_by("code")) if ids else []


# --- D-05 Baseline metrics (F-53) ------------------------------------------------------------

DEFINITIONS = {
    "issued_late": (
        "Share of sheets first issued in the period whose first issue date was after their "
        "planned issue date. Sheets without a planned date are not counted. Includes historic "
        "revisions loaded at onboarding (F-54), so the report covers the time before DrawingOps."
    ),
    "days_in_check": (
        "Average working days (firm calendar, holidays excluded) from a check starting to its "
        "decision (approve or return), for checks decided in the period."
    ),
    "hours_vs_planned": (
        "Per project: hours on timesheets dated in the period against hours allocated for the "
        "weeks starting in the period."
    ),
    "invoice_lag": (
        "Average days from a stage's deliverables being issued to the stage being marked "
        "invoiced, for stages invoiced in the period (needs Phase 2 billing)."
    ),
}


@dataclass
class Period:
    start: date
    end: date


def baseline(user: User, start: date, end: date) -> dict[str, Any]:
    require(user, Action.VIEW_BASELINE)
    if end < start:
        start, end = end, start
    organisation = user.org
    tz = ZoneInfo(organisation.timezone)
    calendar = WorkingCalendar.for_org(organisation, start - timedelta(days=60), end)
    projects = Project.objects.filter(organisation=organisation)

    firsts = (
        Sheet.objects.filter(project__in=projects, planned_issue_date__isnull=False)
        .annotate(first=Min("revisions__issued_at"))
        .filter(first__isnull=False)
        .values("planned_issue_date", "first")
    )
    in_period = [
        (r["planned_issue_date"], r["first"].astimezone(tz).date())
        for r in firsts
        if start <= r["first"].astimezone(tz).date() <= end
    ]
    late = sum(1 for planned, first in in_period if first > planned)

    reviews = Review.objects.filter(
        organisation=organisation,
        kind=ReviewKind.CHECK,
        state__in=[ReviewState.APPROVED, ReviewState.RETURNED],
        closed_at__date__gte=start,
        closed_at__date__lte=end,
    )
    durations = [
        calendar.working_days_between(
            r.opened_at.astimezone(tz).date(), r.closed_at.astimezone(tz).date()
        )
        for r in reviews
        if r.closed_at
    ]

    logged = dict(
        TimeEntry.objects.filter(project__in=projects, date__gte=start, date__lte=end)
        .values_list("project_id")
        .annotate(t=Sum("hours"))
    )
    planned = dict(
        Allocation.objects.filter(project__in=projects, week__gte=monday(start), week__lte=end)
        .values_list("project_id")
        .annotate(t=Sum("planned_h"))
    )
    hours = [
        {
            "project": p,
            "planned_h": planned.get(p.pk, Decimal(0)),
            "logged_h": logged.get(p.pk, Decimal(0)),
            "pct": int((logged.get(p.pk, 0) / planned[p.pk] * 100).quantize(Decimal(1)))
            if planned.get(p.pk)
            else None,
        }
        for p in projects.filter(pk__in=set(logged) | set(planned)).order_by("code")
    ]
    lag = invoice_lag(organisation, start, end)
    return {
        "start": start,
        "end": end,
        "issued_late": {
            "sheets": len(in_period),
            "late": late,
            "pct": round(late / len(in_period) * 100, 1) if in_period else None,
        },
        "days_in_check": {
            "checks": len(durations),
            "average": round(sum(durations) / len(durations), 1) if durations else None,
        },
        "hours_vs_planned": hours,
        "invoice_lag": lag,
        "definitions": DEFINITIONS,
    }


def invoice_lag(organisation: Organisation, start: date, end: date) -> dict[str, Any]:
    """Days from deliverables_issued to invoiced, from the audit trail of stage transitions."""
    from apps.audit.models import AuditEvent

    events = (
        AuditEvent.objects.filter(
            organisation=organisation,
            entity_type="projects.stage",
            after__state__in=[StageState.DELIVERABLES_ISSUED, StageState.INVOICED],
        )
        .values("entity_id", "after", "at")
        .order_by("at")
    )
    issued: dict[str, datetime] = {}
    lags = []
    for e in events:
        state = (e["after"] or {}).get("state")
        if state == StageState.DELIVERABLES_ISSUED:
            issued.setdefault(e["entity_id"], e["at"])
        elif (
            state == StageState.INVOICED
            and e["entity_id"] in issued
            and start <= e["at"].date() <= end
        ):
            tz = ZoneInfo(organisation.timezone)
            lags.append(
                (e["at"].astimezone(tz).date() - issued[e["entity_id"]].astimezone(tz).date()).days
            )
    return {"stages": len(lags), "average_days": round(sum(lags) / len(lags), 1) if lags else None}


# --- 03 §9 hours reports ----------------------------------------------------------------------


def hours_report(user: User, start: date, end: date, group: str) -> dict[str, Any]:
    """Hours by project/stage (planned vs actual) and utilisation by person/discipline.
    Accounts see totals only (03 §17 "See others' hours: totals")."""
    require(user, Action.VIEW_HOURS_REPORT)
    if group in ("person", "discipline") and user.org_role == OrgRole.ACCOUNTS:
        raise PermissionDeniedError(Action.VIEW_HOURS_REPORT, "Accounts see project totals only.")
    organisation = user.org
    projects: QuerySet[Project]
    if user.org_role in (OrgRole.OWNER, OrgRole.ACCOUNTS):
        projects = Project.objects.filter(organisation=organisation)
        people = User.objects.filter(organisation=organisation)
    else:
        projects = visible_projects(user).filter(
            memberships__user=user, memberships__role__in=[ProjectRole.PL, ProjectRole.DL]
        )
        people = visible_people(user)
    entries = TimeEntry.objects.filter(date__gte=start, date__lte=end, project__in=projects)
    allocs = Allocation.objects.filter(week__gte=monday(start), week__lte=end, project__in=projects)
    rows: list[dict[str, Any]] = []
    if group in ("project", "stage"):
        key = ["project_id", "project__code"] + (
            ["stage_id", "stage__name"] if group == "stage" else []
        )
        actual = {
            tuple(r[k] for k in key): r["t"] for r in entries.values(*key).annotate(t=Sum("hours"))
        }
        plan = {
            tuple(r[k] for k in key): r["t"]
            for r in allocs.values(*key).annotate(t=Sum("planned_h"))
        }
        for k in sorted(set(actual) | set(plan), key=lambda k: tuple(str(x) for x in k[1::2])):
            rows.append(
                {
                    "label": " · ".join(str(x) for x in k[1::2]),
                    "planned_h": plan.get(k, Decimal(0)),
                    "logged_h": actual.get(k, Decimal(0)),
                    "available_h": None,
                }
            )
    else:
        entries = entries.filter(timesheet__user__in=people)
        cap = Capacity(organisation, monday(start), end)
        weeks = [
            monday(start) + timedelta(weeks=i)
            for i in range((monday(end) - monday(start)).days // 7 + 1)
        ]
        logged = dict(entries.values_list("timesheet__user_id").annotate(t=Sum("hours")))
        by_disc: dict[str, list[Decimal]] = defaultdict(lambda: [Decimal(0), Decimal(0)])
        for person in people.select_related("staff_profile__discipline").order_by("full_name"):
            profile = profile_for(person)
            available = sum((cap.hours(profile, w) for w in weeks), Decimal(0))
            hrs = logged.get(person.pk, Decimal(0))
            if group == "person":
                rows.append(
                    {
                        "label": person.full_name,
                        "planned_h": None,
                        "logged_h": hrs,
                        "available_h": available,
                    }
                )
            else:
                code = profile.discipline.code if profile.discipline else "—"
                by_disc[code][0] += hrs
                by_disc[code][1] += available
        if group == "discipline":
            for code, (hrs, available) in sorted(by_disc.items()):
                rows.append(
                    {"label": code, "planned_h": None, "logged_h": hrs, "available_h": available}
                )
    for r in rows:
        base = r["available_h"] if r["available_h"] is not None else r["planned_h"]
        r["pct"] = int((r["logged_h"] / base * 100).quantize(Decimal(1))) if base else None
    return {"start": start, "end": end, "group": group, "rows": rows}

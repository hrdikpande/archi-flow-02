"""T-09 feature store and gate G3. Features are rebuilt for any past date from the transition
history, so training rows only ever see what was known on that date (no leakage)."""

from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Min, Sum

from apps.core.calendar import WorkingCalendar
from apps.core.clock import org_today
from apps.core.models import Organisation
from apps.people.models import Allocation
from apps.register.models import Sheet, SheetRevision, SheetState
from apps.workflow.models import Review, StatusTransition

from .models import FeatureSnapshot

OPEN_STATES = {
    SheetState.PLANNED,
    SheetState.IN_PROGRESS,
    SheetState.READY_FOR_CHECK,
    SheetState.IN_CHECK,
    SheetState.CHANGES_REQUESTED,
    SheetState.APPROVED_FOR_ISSUE,
}
WAITING = {SheetState.READY_FOR_CHECK, SheetState.IN_CHECK}
G3_MONTHS = 6
G3_CYCLES = 2000
HORIZON_DAYS = 42  # predict sheets due within six weeks


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def gate(org: Organisation) -> dict[str, Any]:
    """G3: ≥ 6 months of clean history and ≥ 2,000 completed sheet cycles (01 §9)."""
    first = StatusTransition.objects.filter(organisation=org).aggregate(t=Min("created_at"))["t"]
    first_issue = SheetRevision.objects.filter(organisation=org, issued_at__isnull=False).aggregate(
        t=Min("issued_at")
    )["t"]
    start = min([d for d in (first, first_issue) if d], default=None)
    months = round((datetime.now(start.tzinfo) - start).days / 30.44, 1) if start else 0.0
    cycles = SheetRevision.objects.filter(organisation=org, issued_at__isnull=False).count()
    return {
        "months": months,
        "cycles": cycles,
        "needs_months": G3_MONTHS,
        "needs_cycles": G3_CYCLES,
        "met": months >= G3_MONTHS and cycles >= G3_CYCLES,
    }


@dataclass
class SheetHistory:
    sheet: Sheet
    created: datetime
    planned: date | None
    times: list[datetime]
    states: list[str]
    first_issue: date | None
    revisions: list[datetime]
    reviews: list[datetime]
    returns: list[datetime]

    def state_at(self, t: datetime) -> str | None:
        if t < self.created:
            return None
        i = bisect_right(self.times, t)
        return self.states[i - 1] if i else SheetState.PLANNED

    def entered_at(self, t: datetime) -> datetime:
        i = bisect_right(self.times, t)
        return self.times[i - 1] if i else self.created


class History:
    """All sheets of an organisation with their timelines, loaded once."""

    def __init__(self, org: Organisation) -> None:
        self.org = org
        self.tz = ZoneInfo(org.timezone)
        sheets = list(
            Sheet.objects.filter(organisation=org, project__status="active").select_related(
                "discipline", "stage", "package"
            )
        )
        trans: dict[Any, list[tuple[datetime, str, str]]] = defaultdict(list)
        for sid, at, to, action in (
            StatusTransition.objects.filter(organisation=org)
            .order_by("created_at")
            .values_list("sheet_id", "created_at", "to_state", "action")
        ):
            trans[sid].append((at, to, action))
        revs: dict[Any, list[datetime]] = defaultdict(list)
        issues: dict[Any, date] = {}
        for sid, created, issued in SheetRevision.objects.filter(organisation=org).values_list(
            "sheet_id", "created_at", "issued_at"
        ):
            revs[sid].append(created)
            if issued and (sid not in issues or issued.astimezone(self.tz).date() < issues[sid]):
                issues[sid] = issued.astimezone(self.tz).date()
        reviews: dict[Any, list[datetime]] = defaultdict(list)
        for sid, at in Review.objects.filter(organisation=org).values_list("sheet_id", "opened_at"):
            reviews[sid].append(at)
        self.sheets: list[SheetHistory] = []
        for s in sheets:
            t = trans.get(s.pk, [])
            self.sheets.append(
                SheetHistory(
                    sheet=s,
                    created=s.created_at,
                    planned=s.effective_planned_date,
                    times=[x[0] for x in t],
                    states=[x[1] for x in t],
                    first_issue=issues.get(s.pk),
                    revisions=sorted(revs.get(s.pk, [])),
                    reviews=sorted(reviews.get(s.pk, [])),
                    returns=[x[0] for x in t if x[2] == "return"],
                )
            )
        self.calendar = WorkingCalendar.for_org(org)

    def end_of(self, d: date) -> datetime:
        return datetime.combine(d, time(23, 59), tzinfo=self.tz)

    def label(self, h: SheetHistory, today: date) -> bool | None:
        """Late = not first issued by the planned date. Unknown until the date has passed."""
        if h.planned is None:
            return None
        if h.first_issue is not None:
            return h.first_issue > h.planned
        return True if h.planned < today else None

    def rows(self, as_of: date) -> list[tuple[SheetHistory, dict[str, Any]]]:
        """Features of every sheet open on `as_of` and due within the horizon."""
        t = self.end_of(as_of)
        state_at = {h.sheet.pk: h.state_at(t) for h in self.sheets}
        queue: dict[Any, int] = defaultdict(int)
        owner_open: dict[Any, int] = defaultdict(int)
        for h in self.sheets:
            st = state_at[h.sheet.pk]
            if st in WAITING and h.sheet.checker_id:
                queue[h.sheet.checker_id] += 1
            if st in OPEN_STATES and h.sheet.owner_id:
                owner_open[h.sheet.owner_id] += 1
        week = monday(as_of)
        alloc = dict(
            Allocation.objects.filter(organisation=self.org, week=week)
            .values_list("user_id")
            .annotate(t=Sum("planned_h"))
        )
        out = []
        for h in self.sheets:
            st = state_at[h.sheet.pk]
            if st not in OPEN_STATES or h.planned is None:
                continue
            if not (as_of < h.planned <= as_of + timedelta(days=HORIZON_DAYS)):
                continue
            s = h.sheet
            out.append(
                (
                    h,
                    {
                        "discipline": s.discipline.code,
                        "state": st,
                        "stage_seq": s.stage.seq,
                        "days_to_due": self.calendar.working_days_between(as_of, h.planned),
                        "planned_lead_days": (
                            h.planned - h.created.astimezone(self.tz).date()
                        ).days,
                        "age_days": (as_of - h.created.astimezone(self.tz).date()).days,
                        "days_in_state": (t - h.entered_at(t)).days,
                        "revisions": bisect_right(h.revisions, t),
                        "review_rounds": bisect_right(h.reviews, t),
                        "returns": bisect_right(h.returns, t),
                        "checker_queue": queue.get(s.checker_id, 0) if s.checker_id else 0,
                        "owner_open_sheets": owner_open.get(s.owner_id, 0) if s.owner_id else 0,
                        "owner_planned_h": float(alloc.get(s.owner_id, 0) or 0),
                        "has_checker": int(bool(s.checker_id)),
                    },
                )
            )
        return out


def snapshot_now(org: Organisation) -> int:
    """Weekly: store this Monday's features (point-in-time truth for future training) and fill
    in labels of earlier snapshots whose planned date has passed."""
    today = org_today(org)
    history = History(org)
    as_of = monday(today)
    n = 0
    for h, feats in history.rows(as_of):
        if h.planned is None:
            continue
        _, created = FeatureSnapshot.objects.get_or_create(
            sheet=h.sheet,
            as_of=as_of,
            defaults={"organisation": org, "features": feats, "planned_date": h.planned},
        )
        n += created
    by_sheet = {h.sheet.pk: h for h in history.sheets}
    for snap in FeatureSnapshot.objects.filter(
        organisation=org, late__isnull=True, planned_date__lt=today
    ):
        found = by_sheet.get(snap.sheet_id)
        if found is not None and (label := history.label(found, today)) is not None:
            snap.late = label
            snap.save(update_fields=["late", "updated_at"])
    return n


def training_rows(
    history: History, today: date, weeks: int = 104
) -> list[tuple[date, Any, dict[str, Any], bool]]:
    """(as_of, sheet, features, late) for each past Monday, labels known by today."""
    out = []
    start = monday(today) - timedelta(weeks=weeks)
    as_of = start
    while as_of < today:
        for h, feats in history.rows(as_of):
            label = history.label(h, today)
            if label is not None:
                out.append((as_of, h.sheet, feats, label))
        as_of += timedelta(weeks=1)
    return out

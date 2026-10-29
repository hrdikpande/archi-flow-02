"""F-56 workload forecast: hours per discipline for the next 8 weeks (02 §17).

Regression on history: hours a discipline logged in a week against the sheets it had due in the
following four weeks, its allocations, and the mean of the previous four weeks (the seasonal
baseline). Error is MAPE per discipline-week. Discipline level only, never per person."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.core.clock import org_today
from apps.core.models import Discipline, Organisation
from apps.people.models import Allocation, StaffProfile, TimeEntry
from apps.register.models import Sheet, SheetState

from .features import monday
from .models import ModelKind, ModelRun, RunStatus, WorkloadForecast

HORIZON = 8
MIN_WEEKS = 12


def _weekly_hours(org: Organisation) -> dict[tuple[Any, date], float]:
    """Logged hours per (discipline, week): the discipline at the time of entry (03 §9)."""
    profile_disc = dict(
        StaffProfile.objects.filter(organisation=org).values_list("user_id", "discipline_id")
    )
    out: dict[tuple[Any, date], float] = defaultdict(float)
    for disc, user, day, hours in TimeEntry.objects.filter(organisation=org).values_list(
        "discipline_id", "timesheet__user_id", "date", "hours"
    ):
        d = disc or profile_disc.get(user)
        if d:
            out[(d, monday(day))] += float(hours)
    return out


def _planned_hours(org: Organisation, weeks: list[date]) -> dict[tuple[Any, date], float]:
    profile_disc = dict(
        StaffProfile.objects.filter(organisation=org).values_list("user_id", "discipline_id")
    )
    out: dict[tuple[Any, date], float] = defaultdict(float)
    rows = (
        Allocation.objects.filter(organisation=org, week__in=weeks)
        .values("user_id", "week")
        .annotate(t=Sum("planned_h"))
    )
    for r in rows:
        if d := profile_disc.get(r["user_id"]):
            out[(d, r["week"])] += float(r["t"])
    return out


def _due_counts(org: Organisation) -> list[Any]:
    return list(
        Sheet.objects.filter(organisation=org, planned_issue_date__isnull=False)
        .exclude(state=SheetState.CANCELLED)
        .values_list("discipline_id", "planned_issue_date", "created_at")
    )


def _features(
    disc: Any,
    week: date,
    hours: dict[tuple[Any, date], float],
    due: list[Any],
    planned: dict[tuple[Any, date], float],
) -> dict[str, Any]:
    window_end = week + timedelta(weeks=4)
    sheets_due = sum(
        1
        for d, p, created in due
        if d == disc and week <= p < window_end and created.date() <= week
    )
    prev = [hours.get((disc, week - timedelta(weeks=i)), 0.0) for i in range(1, 5)]
    return {
        "discipline": str(disc),
        "sheets_due_4w": sheets_due,
        "baseline": sum(prev) / 4,
        "planned_h": planned.get((disc, week), 0.0),
    }


def mape(pairs: list[tuple[float, float]]) -> float | None:
    usable = [(a, p) for a, p in pairs if a > 0]
    if not usable:
        return None
    return round(100 * sum(abs(a - p) / a for a, p in usable) / len(usable), 1)


def train_and_forecast(
    org: Organisation, *, force: bool = False, gate_info: dict[str, Any]
) -> ModelRun:
    from sklearn.feature_extraction import DictVectorizer
    from sklearn.linear_model import Ridge
    from sklearn.pipeline import make_pipeline

    today = org_today(org)
    this_week = monday(today)
    hours = _weekly_hours(org)
    disciplines = list(Discipline.objects.filter(organisation=org))
    weeks = sorted({w for _, w in hours if w < this_week})
    run = ModelRun(organisation=org, kind=ModelKind.WORKLOAD, gate=gate_info, forced=force)
    if len(weeks) < MIN_WEEKS:
        run.status, run.note = RunStatus.SKIPPED, f"Only {len(weeks)} weeks of logged hours."
        run.save()
        return run
    future = [this_week + timedelta(weeks=i) for i in range(HORIZON)]
    due = _due_counts(org)
    planned = _planned_hours(org, weeks + future)
    rows = [
        (d.pk, w, _features(d.pk, w, hours, due, planned), hours.get((d.pk, w), 0.0))
        for d in disciplines
        for w in weeks[4:]
    ]
    run.training_rows = len(rows)

    def fit(train: list[Any]) -> Any:
        return make_pipeline(DictVectorizer(sparse=False), Ridge(alpha=1.0)).fit(
            [r[2] for r in train], [r[3] for r in train]
        )

    # Back-test: the last 8 weeks, each predicted by a model trained only on earlier weeks.
    per_disc: dict[str, list[tuple[float, float]]] = defaultdict(list)
    base_pairs: list[tuple[float, float]] = []
    model_pairs: list[tuple[float, float]] = []
    codes = {d.pk: d.code for d in disciplines}
    for w in weeks[-8:]:
        train = [r for r in rows if r[1] < w]
        test = [r for r in rows if r[1] == w]
        if len(train) < 10 or not test:
            continue
        preds = fit(train).predict([r[2] for r in test])
        for r, p in zip(test, preds, strict=True):
            per_disc[codes[r[0]]].append((r[3], float(max(p, 0))))
            model_pairs.append((r[3], float(max(p, 0))))
            base_pairs.append((r[3], r[2]["baseline"]))
    run.metrics = {
        "mape_model": mape(model_pairs),
        "mape_baseline": mape(base_pairs),
        "mape_by_discipline": {k: mape(v) for k, v in sorted(per_disc.items())},
    }
    model = fit(rows)
    run.status = RunStatus.OK
    run.save()
    forecasts = []
    for d in disciplines:
        for w in future:
            f = _features(d.pk, w, hours, due, planned)
            f["baseline"] = (
                sum(hours.get((d.pk, this_week - timedelta(weeks=i)), 0.0) for i in range(1, 5)) / 4
            )
            value = max(float(model.predict([f])[0]), 0.0)
            forecasts.append(
                WorkloadForecast(
                    organisation=org,
                    run=run,
                    discipline=d,
                    week=w,
                    hours=Decimal(f"{value:.1f}"),
                    baseline_hours=Decimal(f"{f['baseline']:.1f}"),
                )
            )
    WorkloadForecast.objects.bulk_create(forecasts)
    return run

"""F-55 late-risk prediction and T-10 back-testing (02 §17).

Gradient-boosted trees over the feature store. The back-test trains on everything before a month
and ranks that month's sheets; it reports precision in the top 20% for the model and for the
A-01 rule alone ("due within 7 working days, not yet in check"). Advisory only."""

from datetime import date, timedelta
from typing import Any

from apps.core.clock import org_today
from apps.core.models import Organisation

from .features import OPEN_STATES, History, training_rows
from .models import ModelKind, ModelRun, Prediction, RunStatus

MIN_ROWS = 200
MIN_POSITIVES = 10
REASON_TEXT = {
    "days_to_due": lambda v: f"due in {int(v)} working day{'s' if int(v) != 1 else ''}",
    "checker_queue": lambda v: (
        f"{int(v)} sheet{'s' if int(v) != 1 else ''} waiting with the checker"
    ),
    "returns": lambda v: f"returned {int(v)} time{'s' if int(v) != 1 else ''} already",
    "days_in_state": lambda v: f"{int(v)} days in its current state",
    "owner_open_sheets": lambda v: f"the designer has {int(v)} open sheets",
    "owner_planned_h": lambda v: f"the designer is allocated {v:.0f} h this week",
    "revisions": lambda v: f"{int(v)} revision{'s' if int(v) != 1 else ''} so far",
    "review_rounds": lambda v: f"{int(v)} review round{'s' if int(v) != 1 else ''} so far",
    "has_checker": lambda v: "no checker assigned" if not v else "checker assigned",
    "planned_lead_days": lambda v: f"planned only {int(v)} days after it was created",
    "age_days": lambda v: f"open for {int(v)} days",
    "stage_seq": lambda v: f"stage {int(v)}",
}


def _model() -> Any:
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.feature_extraction import DictVectorizer
    from sklearn.pipeline import make_pipeline

    return make_pipeline(
        DictVectorizer(sparse=False),
        HistGradientBoostingClassifier(max_iter=150, learning_rate=0.08, random_state=7),
    )


def a01_score(f: dict[str, Any]) -> float:
    """The rule-only ranking the model must beat: A-01 flags first, then nearest due date."""
    flagged = f["state"] in ("planned", "in_progress") and f["days_to_due"] <= 7
    return (1.0 if flagged else 0.0) + 1.0 / (1 + max(f["days_to_due"], 0))


def precision_top(scores: list[float], labels: list[bool], share: float = 0.2) -> float | None:
    if not labels:
        return None
    k = max(1, round(len(labels) * share))
    top = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
    return round(sum(labels[i] for i in top) / k, 3)


def backtest(
    rows: list[tuple[date, Any, dict[str, Any], bool]], today: date, months: int = 6
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for m in range(months, 0, -1):
        start = (today.replace(day=1) - timedelta(days=31 * (m - 1))).replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        # Train only on rows whose outcome was known before the month began.
        train = [
            r
            for r in rows
            if r[0] < start
            and r[2]["days_to_due"] is not None
            and r[0] + timedelta(days=60) < start
        ]
        test = [r for r in rows if start <= r[0] < end]
        labels_train = [r[3] for r in train]
        if len(train) < MIN_ROWS or sum(labels_train) < MIN_POSITIVES or len(test) < 20:
            continue
        model = _model().fit([r[2] for r in train], labels_train)
        probs = model.predict_proba([r[2] for r in test])[:, 1].tolist()
        labels = [r[3] for r in test]
        p_model = precision_top(probs, labels)
        p_rule = precision_top([a01_score(r[2]) for r in test], labels)
        results.append(
            {
                "month": start.isoformat(),
                "test_rows": len(test),
                "late_share": round(sum(labels) / len(labels), 3),
                "precision_top20_model": p_model,
                "precision_top20_a01": p_rule,
                "lift": round(p_model / p_rule, 2) if p_model is not None and p_rule else None,
            }
        )
    lifts: list[float] = [float(r["lift"]) for r in results if r["lift"] is not None]
    return {
        "months": results,
        "mean_lift": round(sum(lifts) / len(lifts), 2) if lifts else None,
        "target_lift": 2.0,
    }


def reasons(
    model: Any, feats: dict[str, Any], medians: dict[str, float], base: float
) -> list[dict[str, Any]]:
    """Which features push this sheet's score up most: replace each with the typical value
    and see how far the score falls. Top three, in words a lead understands."""
    effects = []
    for name, typical in medians.items():
        if feats.get(name) == typical:
            continue
        changed = model.predict_proba([{**feats, name: typical}])[0, 1]
        effects.append((base - changed, name))
    effects.sort(reverse=True)
    out = []
    for effect, name in effects[:3]:
        if effect <= 0.01:
            break
        out.append(
            {
                "feature": name,
                "text": REASON_TEXT[name](feats[name]) if name in REASON_TEXT else name,
                "effect": round(float(effect), 3),
            }
        )
    return out


def train_and_predict(
    org: Organisation, *, force: bool = False, gate_info: dict[str, Any]
) -> ModelRun:
    today = org_today(org)
    history = History(org)
    rows = training_rows(history, today)
    run = ModelRun(
        organisation=org,
        kind=ModelKind.LATE_RISK,
        gate=gate_info,
        forced=force,
        training_rows=len(rows),
    )
    positives = sum(r[3] for r in rows)
    if len(rows) < MIN_ROWS or positives < MIN_POSITIVES or positives == len(rows):
        run.status, run.note = (
            RunStatus.SKIPPED,
            f"Too little history: {len(rows)} rows, {positives} late.",
        )
        run.save()
        return run
    run.metrics = backtest(rows, today)
    model = _model().fit([r[2] for r in rows], [r[3] for r in rows])
    numeric = [k for k, v in rows[0][2].items() if isinstance(v, int | float)]
    medians = {k: sorted(r[2][k] for r in rows)[len(rows) // 2] for k in numeric}
    run.status = RunStatus.OK
    run.save()
    current = history.rows(today)
    if current:
        probs = model.predict_proba([f for _, f in current])[:, 1]
        Prediction.objects.bulk_create(
            [
                Prediction(
                    organisation=org,
                    run=run,
                    sheet=h.sheet,
                    project_id=h.sheet.project_id,
                    score=round(float(p), 3),
                    reasons=reasons(model, f, medians, float(p)),
                )
                for (h, f), p in zip(current, probs, strict=True)
                if h.sheet.state in OPEN_STATES
            ]
        )
    return run

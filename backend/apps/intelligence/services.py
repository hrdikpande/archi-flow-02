"""Weekly intelligence job and read access (P4). Training runs only once gate G3 is met;
`force` exists for evaluating on test data and refuses to run in production."""

from typing import Any

from django.conf import settings
from django.db.models import QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.core.exceptions import DomainError
from apps.core.models import Organisation
from apps.projects.models import Project

from . import features, late_risk, workload
from .models import ModelKind, ModelRun, Prediction, PredictionFeedback, RunStatus, WorkloadForecast


def weekly(org: Organisation, *, force: bool = False) -> dict[str, Any]:
    if force and settings.ENVIRONMENT == "production":
        raise DomainError(
            "forbidden", "Training before gate G3 is for evaluation only, never production."
        )
    snapshots = features.snapshot_now(org)  # the feature store fills from day one (T-09)
    gate = features.gate(org)
    out: dict[str, Any] = {"snapshots": snapshots, "gate": gate}
    if not gate["met"] and not force:
        for kind in ModelKind.values:
            ModelRun.objects.create(
                organisation=org,
                kind=kind,
                status=RunStatus.SKIPPED,
                gate=gate,
                note="Gate G3 not met: no model is trained yet.",
            )
        return out
    out["late_risk"] = late_risk.train_and_predict(org, force=force, gate_info=gate).status
    out["workload"] = workload.train_and_forecast(org, force=force, gate_info=gate).status
    return out


def due_this_week(org: Organisation) -> bool:
    from datetime import datetime, time
    from zoneinfo import ZoneInfo

    from apps.core.clock import org_today

    today = org_today(org)
    week_start = datetime.combine(features.monday(today), time(0, 0), tzinfo=ZoneInfo(org.timezone))
    return not ModelRun.objects.filter(organisation=org, created_at__gte=week_start).exists()


def latest_run(org_id: Any, kind: str) -> ModelRun | None:
    return ModelRun.objects.filter(organisation_id=org_id, kind=kind, status=RunStatus.OK).first()


def status(user: User) -> dict[str, Any]:
    org = user.org
    runs = {k: ModelRun.objects.filter(organisation=org, kind=k).first() for k in ModelKind.values}
    return {"gate": features.gate(org), "runs": {k: r for k, r in runs.items() if r is not None}}


def project_predictions(user: User, project: Project) -> QuerySet[Prediction]:
    require(user, Action.VIEW_FORECASTS, project=project)
    run = latest_run(project.organisation_id, ModelKind.LATE_RISK)
    if run is None:
        return Prediction.objects.none()
    return Prediction.objects.filter(run=run, project=project).select_related("sheet")


def feedback(user: User, prediction: Prediction, agree: bool, note: str = "") -> PredictionFeedback:
    require(user, Action.VIEW_FORECASTS, project=prediction.project)
    return PredictionFeedback.objects.create(
        organisation_id=prediction.organisation_id,
        prediction=prediction,
        user=user,
        agree=agree,
        note=note[:500],
    )


def workload_forecast(user: User) -> QuerySet[WorkloadForecast]:
    require(user, Action.VIEW_FORECASTS)
    run = latest_run(user.org_pk, ModelKind.WORKLOAD)
    if run is None:
        return WorkloadForecast.objects.none()
    return WorkloadForecast.objects.filter(run=run).select_related("discipline")

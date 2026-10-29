"""Automation engine (02 §8).

Each rule computes the flags that *should* be open; `apply()` raises the missing ones, refreshes
data on existing ones and clears the rest. Raising an open flag is a no-op (partial unique
index) and notifications are deduplicated, so running a sweep twice changes nothing.
"""

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, ClassVar
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.core.calendar import WorkingCalendar
from apps.core.models import Organisation

from .defaults import DEFAULT_RULES, MISSING_RUN_ALERT_AT, SCHEDULES
from .models import AutomationRule, AutomationRun, Flag

logger = logging.getLogger(__name__)

FlagKey = tuple[str, str, str]  # (entity_type, entity_id, kind)


@dataclass
class Wanted:
    """A flag that should be open."""

    kind: str
    entity_type: str
    entity_id: str
    project_id: Any = None
    sheet_id: Any = None
    user_id: Any = None
    week: date | None = None
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> FlagKey:
        return (self.entity_type, self.entity_id, self.kind)


@dataclass
class Context:
    organisation: Organisation
    today: date
    now: datetime
    params: dict[str, Any]
    calendar: WorkingCalendar


class Rule:
    key: ClassVar[str]
    kinds: ClassVar[tuple[str, ...]]

    def evaluate(self, ctx: Context, only: Iterable[Any] | None = None) -> list[Wanted]:
        raise NotImplementedError

    def scope(self, flags: Any, only: Iterable[Any] | None) -> Any:
        """Restrict existing open flags to the entities an event recompute touches."""
        return flags if only is None else flags.filter(entity_id__in=[str(o) for o in only])

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        return 0

    def after_apply(self, ctx: Context, open_flags: list[Flag]) -> int:
        """Escalations and similar; returns notifications sent."""
        return 0


RULES: dict[str, Rule] = {}


def register(rule: Rule) -> Rule:
    RULES[rule.key] = rule
    return rule


def rule_config(organisation: Organisation, key: str) -> AutomationRule:
    rule, _ = AutomationRule.objects.get_or_create(
        organisation=organisation, key=key, defaults={"params": DEFAULT_RULES.get(key, {})}
    )
    return rule


def org_now(organisation: Organisation, now: datetime | None = None) -> datetime:
    return (now or timezone.now()).astimezone(ZoneInfo(organisation.timezone))


def context(organisation: Organisation, key: str, now: datetime | None = None) -> Context | None:
    config = rule_config(organisation, key)
    if not config.enabled:
        return None
    local = org_now(organisation, now)
    params = {**DEFAULT_RULES.get(key, {}), **config.params}
    return Context(
        organisation,
        local.date(),
        now or timezone.now(),
        params,
        WorkingCalendar.for_org(organisation),
    )


@transaction.atomic
def apply(
    rule: Rule, ctx: Context, *, only: Iterable[Any] | None = None, raise_new: bool = True
) -> tuple[int, int, int]:
    """Make open flags match the rule. Returns (raised, cleared, notified)."""
    wanted = {w.key: w for w in rule.evaluate(ctx, only)}
    existing_qs = Flag.objects.select_for_update().filter(
        organisation=ctx.organisation, rule=rule.key, cleared_at__isnull=True
    )
    existing = {(f.entity_type, f.entity_id, f.kind): f for f in rule.scope(existing_qs, only)}
    raised = cleared = notified = 0
    for key, flag in existing.items():
        if key not in wanted:
            flag.cleared_at = ctx.now
            flag.save(update_fields=["cleared_at", "updated_at"])
            cleared += 1
        else:
            merged = {**flag.data, **wanted[key].data}
            if merged != flag.data:
                flag.data = merged
                flag.save(update_fields=["data", "updated_at"])
    if raise_new:
        for key, w in wanted.items():
            if key in existing:
                continue
            flag = Flag.objects.create(
                organisation=ctx.organisation,
                entity_type=w.entity_type,
                entity_id=w.entity_id,
                kind=w.kind,
                rule=rule.key,
                project_id=w.project_id,
                sheet_id=w.sheet_id,
                user_id=w.user_id,
                week=w.week,
                raised_at=ctx.now,
                data=w.data,
            )
            raised += 1
            notified += rule.on_raised(ctx, flag)
        open_flags = list(
            Flag.objects.filter(
                organisation=ctx.organisation, rule=rule.key, cleared_at__isnull=True
            )
        )
        notified += rule.after_apply(ctx, open_flags)
    return raised, cleared, notified


def run_rule(
    organisation: Organisation, key: str, now: datetime | None = None
) -> AutomationRun | None:
    """One sweep. Always logged in automation_run, including failures (N-05)."""
    ctx = context(organisation, key, now)
    if ctx is None:
        return None
    run = AutomationRun.objects.create(
        organisation=organisation, rule=key, run_date=ctx.today, started_at=timezone.now()
    )
    try:
        raised, cleared, notified = apply(RULES[key], ctx)
        run.raised, run.cleared, run.notified = raised, cleared, notified
    except Exception as exc:
        logger.exception("automation run failed", extra={"rule": key})
        run.error = repr(exc)[:4000]
    run.finished_at = timezone.now()
    run.save()
    if run.raised or run.cleared:
        from apps.outbox.services import emit

        emit(
            "automation.flags_changed",
            {"rule": key, "raised": run.raised, "cleared": run.cleared},
            organisation_id=organisation.pk,
        )
    return run


def refresh_flags(
    organisation: Organisation, keys: Iterable[str], entity_ids: Iterable[Any]
) -> None:
    """After an event: clear or refresh flags for these entities. New flags wait for the
    scheduled sweep, which owns notifications (03 §10)."""
    ids = list(entity_ids)
    for key in keys:
        ctx = context(organisation, key)
        if ctx is not None and key in RULES:
            apply(RULES[key], ctx, only=ids, raise_new=False)


def _due(spec: dict[str, Any], local: datetime) -> bool:
    if "daily" in spec:
        return local.time() >= time.fromisoformat(spec["daily"])
    weekday, at = spec["weekly"]
    return local.weekday() == weekday and local.time() >= time.fromisoformat(at)


def run_due_sweeps(now: datetime | None = None) -> list[AutomationRun]:
    """Called every 15 minutes by beat: runs each rule once per local day when its time has
    come, then raises an alert for any daily rule still missing after 09:00."""
    runs: list[AutomationRun] = []
    for organisation in Organisation.objects.all():
        local = org_now(organisation, now)
        for key, spec in SCHEDULES.items():
            if key not in RULES or not _due(spec, local):
                continue
            done = AutomationRun.objects.filter(
                organisation=organisation, rule=key, run_date=local.date(), error=""
            ).exclude(finished_at__isnull=True)
            if not done.exists():
                run = run_rule(organisation, key, now)
                if run is not None:
                    runs.append(run)
        alert_missing_runs(organisation, now)
    return runs


def missing_daily_runs(organisation: Organisation, now: datetime | None = None) -> list[str]:
    local = org_now(organisation, now)
    if local.time() < time.fromisoformat(MISSING_RUN_ALERT_AT):
        return []
    missing = []
    for key, spec in SCHEDULES.items():
        if "daily" not in spec or key not in RULES:
            continue
        if not AutomationRule.objects.filter(
            organisation=organisation, key=key, enabled=False
        ).exists():
            ok = AutomationRun.objects.filter(
                organisation=organisation,
                rule=key,
                run_date=local.date(),
                error="",
                finished_at__isnull=False,
            ).exists()
            if not ok:
                missing.append(key)
    return missing


def alert_missing_runs(organisation: Organisation, now: datetime | None = None) -> int:
    """N-05: tell Admins when a scheduled sweep did not run by 09:00."""
    from apps.accounts.models import User
    from apps.accounts.roles import OrgRole
    from apps.notifications.services import notify_many

    missing = missing_daily_runs(organisation, now)
    if not missing:
        return 0
    local = org_now(organisation, now)
    logger.error("automation sweep missing", extra={"rules": missing})
    admins = User.objects.filter(organisation=organisation, org_role=OrgRole.ADMIN, is_active=True)
    return notify_many(
        admins,
        "sweep_missing",
        title=f"Automation did not run today: {', '.join(missing)}",
        body="Check the worker and scheduler (healthz shows their status).",
        link="/admin/automation",
        dedupe_key=f"sweep-missing:{local.date().isoformat()}:{','.join(missing)}",
    )


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())

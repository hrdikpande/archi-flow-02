"""Rules A-01 and A-02 (S4). A-05/A-06 are in rules_people.py; P2/P3 rules in their apps."""

from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Q

from apps.accounts.roles import ProjectRole
from apps.notifications.services import notify, notify_many
from apps.projects.people import members_with_role
from apps.register.models import Sheet, SheetState

from .engine import Context, Rule, Wanted, register
from .models import Flag, FlagKind

NOT_LATE_STATES = (SheetState.ISSUED, SheetState.SUPERSEDED, SheetState.CANCELLED)


def _sheets(ctx: Context, only: Any) -> Any:
    qs = (
        Sheet.objects.filter(organisation=ctx.organisation, project__status="active")
        .filter(Q(planned_issue_date__isnull=False) | Q(package__planned_date__isnull=False))
        .select_related("package", "project", "owner")
    )
    if only is not None:
        qs = qs.filter(pk__in=list(only))
    return qs


def _sheet_link(sheet: Sheet) -> str:
    return f"/projects/{sheet.project_id}/sheets/{sheet.pk}"


def _days(n: int) -> str:
    return f"{n} working day{'' if n == 1 else 's'}"


class AtRisk(Rule):
    """A-01: planned date (own or package) within N working days, not yet in check."""

    key = "A-01"
    kinds = (FlagKind.AT_RISK,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        window = int(ctx.params["at_risk_working_days"])
        states = ctx.params.get("states", ["planned", "in_progress"])
        out = []
        for sheet in _sheets(ctx, only).filter(state__in=states):
            due = sheet.effective_planned_date
            days = ctx.calendar.working_days_between(ctx.today, due)
            if due >= ctx.today and days <= window:
                out.append(
                    Wanted(
                        FlagKind.AT_RISK,
                        "sheet",
                        str(sheet.pk),
                        sheet.project_id,
                        sheet.pk,
                        data={"days": days, "due": due.isoformat()},
                    )
                )
        return out

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        sheet = Sheet.objects.select_related("project").get(pk=flag.entity_id)
        days = flag.data["days"]
        title = (
            f"{sheet.number} is at risk: {'due today' if days == 0 else f'due in {_days(days)}'}"
        )
        audience = [
            sheet.owner,
            *members_with_role(sheet.project_id, ProjectRole.DL, discipline_id=sheet.discipline_id),
            *members_with_role(sheet.project_id, ProjectRole.PL),
        ]
        return notify_many(
            audience,
            "sheet_at_risk",
            title=title,
            body=sheet.title,
            link=_sheet_link(sheet),
            project=sheet.project,
            entity=sheet,
            dedupe_key=f"flag:{flag.pk}",
        )


class Late(Rule):
    """A-02: planned date passed with no issue in the current cycle; escalate after N days."""

    key = "A-02"
    kinds = (FlagKind.LATE,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        out = []
        for sheet in _sheets(ctx, only).exclude(state__in=NOT_LATE_STATES):
            due = sheet.effective_planned_date
            if due < ctx.today:
                days = ctx.calendar.working_days_between(due, ctx.today)
                out.append(
                    Wanted(
                        FlagKind.LATE,
                        "sheet",
                        str(sheet.pk),
                        sheet.project_id,
                        sheet.pk,
                        data={"days": days, "due": due.isoformat()},
                    )
                )
        return out

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        sheet = Sheet.objects.select_related("project").get(pk=flag.entity_id)
        audience = [
            *members_with_role(sheet.project_id, ProjectRole.DL, discipline_id=sheet.discipline_id),
            *members_with_role(sheet.project_id, ProjectRole.PL),
        ]
        return notify_many(
            audience,
            "sheet_late",
            title=f"{sheet.number} is late by {_days(flag.data['days'])}",
            body=sheet.title,
            link=_sheet_link(sheet),
            project=sheet.project,
            entity=sheet,
            dedupe_key=f"flag:{flag.pk}",
        )

    def after_apply(self, ctx: Context, open_flags: list[Flag]) -> int:
        """Still late N working days after the flag was raised → tell the PL once."""
        threshold = int(ctx.params["escalate_after_working_days"])
        sent = 0
        for flag in open_flags:
            if flag.data.get("escalated_at"):
                continue
            raised_on = flag.raised_at.astimezone(ZoneInfo(ctx.organisation.timezone)).date()
            if ctx.calendar.working_days_between(raised_on, ctx.today) < threshold:
                continue
            sheet = Sheet.objects.select_related("project").get(pk=flag.entity_id)
            for pl in members_with_role(sheet.project_id, ProjectRole.PL):
                if notify(
                    pl,
                    "sheet_late",
                    title=f"Escalation: {sheet.number} still late ({_days(flag.data['days'])})",
                    body=sheet.title,
                    link=_sheet_link(sheet),
                    project=sheet.project,
                    entity=sheet,
                    dedupe_key=f"escalation:{flag.pk}",
                ):
                    sent += 1
            flag.data = {**flag.data, "escalated_at": ctx.now.isoformat()}
            flag.save(update_fields=["data", "updated_at"])
        return sent


register(AtRisk())
register(Late())

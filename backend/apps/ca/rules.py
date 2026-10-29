"""A-10 (P3): an RFI whose response is due within N working days (default 2), or overdue,
reminds its assignee (and the PL when nobody is assigned)."""

from typing import Any

from apps.accounts.roles import ProjectRole
from apps.automation.engine import Context, Rule, Wanted, register
from apps.automation.models import Flag, FlagKind
from apps.notifications.services import notify_many
from apps.projects.people import members_with_role

from .models import Rfi, RfiStatus


class RfiDue(Rule):
    key = "A-10"
    kinds = (FlagKind.RFI_DUE,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        window = int(ctx.params["rfi_due_working_days"])
        qs = Rfi.objects.filter(
            organisation=ctx.organisation, status=RfiStatus.OPEN, project__status="active"
        )
        if only is not None:
            qs = qs.filter(pk__in=list(only))
        out = []
        for rfi in qs:
            if rfi.due_on < ctx.today:
                days = -ctx.calendar.working_days_between(rfi.due_on, ctx.today)
            else:
                days = ctx.calendar.working_days_between(ctx.today, rfi.due_on)
            if days <= window:
                out.append(
                    Wanted(
                        FlagKind.RFI_DUE,
                        "rfi",
                        str(rfi.pk),
                        rfi.project_id,
                        user_id=rfi.assignee_id,
                        data={"days": days, "number": rfi.number, "due": rfi.due_on.isoformat()},
                    )
                )
        return out

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        rfi = Rfi.objects.select_related("assignee").get(pk=flag.entity_id)
        days = flag.data["days"]
        when = (
            "overdue"
            if days < 0
            else "due today"
            if days == 0
            else f"due in {days} working day{'s' if days != 1 else ''}"
        )
        audience = (
            [rfi.assignee] if rfi.assignee else members_with_role(rfi.project_id, ProjectRole.PL)
        )
        return notify_many(
            audience,
            "rfi_due",
            title=f"{rfi.number} response {when}: {rfi.subject}"[:200],
            link=f"/projects/{rfi.project_id}/construction/rfis?open={rfi.pk}",
            dedupe_key=f"flag:{flag.pk}",
        )


register(RfiDue())

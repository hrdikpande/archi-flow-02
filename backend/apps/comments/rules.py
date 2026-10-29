"""A-08 (P2): a client comment open with no response for more than N days (default 5) →
reminder to the assignee and the PL (03 §10, H6)."""

from typing import Any

from apps.accounts.roles import ProjectRole
from apps.automation.engine import Context, Rule, Wanted, register
from apps.automation.models import Flag, FlagKind
from apps.notifications.services import notify_many
from apps.projects.people import members_with_role

from .models import OPEN_STATUSES, ClientComment


class CommentOverdue(Rule):
    key = "A-08"
    kinds = (FlagKind.COMMENT_OVERDUE,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        limit = int(ctx.params["comment_unanswered_days"])
        qs = ClientComment.objects.filter(
            organisation=ctx.organisation, status__in=OPEN_STATUSES, project__status="active"
        )
        if only is not None:
            qs = qs.filter(pk__in=list(only))
        out = []
        for c in qs:
            days = (ctx.today - c.received_on).days
            if days > limit:
                out.append(
                    Wanted(
                        FlagKind.COMMENT_OVERDUE,
                        "comment",
                        str(c.pk),
                        c.project_id,
                        user_id=c.assignee_id,
                        data={"days": days, "number": c.number},
                    )
                )
        return out

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        c = ClientComment.objects.select_related("assignee", "project").get(pk=flag.entity_id)
        return notify_many(
            [c.assignee, *members_with_role(c.project_id, ProjectRole.PL)],
            "comment_assigned",
            title=f"{c.number} has had no response for {flag.data['days']} days",
            body=(c.subject or c.body)[:200],
            link=f"/projects/{c.project_id}/comments?open={c.pk}",
            dedupe_key=f"flag:{flag.pk}",
        )


register(CommentOverdue())

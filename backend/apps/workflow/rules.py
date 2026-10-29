"""A-07 (P2): a review open more than N working days (default 3) escalates to the reviewer's
delegate if one is set, else to the DL of the discipline (03 §10, H5)."""

from typing import Any
from zoneinfo import ZoneInfo

from apps.accounts.roles import ProjectRole
from apps.automation.engine import Context, Rule, Wanted, register
from apps.automation.models import Flag, FlagKind
from apps.notifications.services import notify_many
from apps.projects.people import members_with_role
from apps.register.models import Sheet, SheetState

from .delegation import active_delegate
from .models import Review, ReviewState


def _waiting(ctx: Context, only: Any) -> list[tuple[Sheet, Any, Any]]:
    """(sheet, reviewer_id, waiting since) for sheets waiting for a check or a decision."""
    sheets = Sheet.objects.filter(
        organisation=ctx.organisation,
        project__status="active",
        state__in=[SheetState.READY_FOR_CHECK, SheetState.IN_CHECK],
    ).select_related("project")
    if only is not None:
        sheets = sheets.filter(pk__in=list(only))
    open_reviews = {
        r.sheet_id: r
        for r in Review.objects.filter(sheet__in=sheets, state=ReviewState.OPEN).order_by(
            "opened_at"
        )
    }
    out = []
    for s in sheets:
        review = open_reviews.get(s.pk)
        if s.state == SheetState.IN_CHECK and review is not None:
            out.append((s, review.reviewer_id, review.opened_at))
        elif s.state == SheetState.READY_FOR_CHECK:
            out.append((s, s.checker_id, s.state_changed_at or s.updated_at))
    return out


class ReviewOverdue(Rule):
    key = "A-07"
    kinds = (FlagKind.REVIEW_OVERDUE,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        limit = int(ctx.params["review_open_working_days"])
        tz = ZoneInfo(ctx.organisation.timezone)
        out = []
        for sheet, reviewer_id, since in _waiting(ctx, only):
            days = ctx.calendar.working_days_between(since.astimezone(tz).date(), ctx.today)
            if days > limit:
                out.append(
                    Wanted(
                        FlagKind.REVIEW_OVERDUE,
                        "sheet",
                        str(sheet.pk),
                        sheet.project_id,
                        sheet.pk,
                        user_id=reviewer_id,
                        data={
                            "days": days,
                            "reviewer_id": str(reviewer_id) if reviewer_id else None,
                        },
                    )
                )
        return out

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        sheet = Sheet.objects.select_related("project", "checker").get(pk=flag.entity_id)
        days = flag.data["days"]
        reviewer_id = flag.data.get("reviewer_id")
        delegate = active_delegate(reviewer_id, ctx.today) if reviewer_id else None
        escalate_to = (
            [delegate]
            if delegate is not None
            else members_with_role(
                sheet.project_id, ProjectRole.DL, discipline_id=sheet.discipline_id
            )
        )
        from apps.accounts.models import User

        reviewer = User.objects.filter(pk=reviewer_id).first() if reviewer_id else None
        title = f"{sheet.number} has waited {days} working days for review"
        sent = notify_many(
            [u for u in [reviewer] if u],
            "review_overdue",
            title=title,
            body=sheet.title,
            link=f"/projects/{sheet.project_id}/sheets/{sheet.pk}",
            dedupe_key=f"flag:{flag.pk}:reviewer",
        )
        who = f" (reviewer {reviewer.short_name})" if reviewer else ""
        sent += notify_many(
            [u for u in escalate_to if u and u != reviewer],
            "review_overdue",
            title=f"Escalated: {title}{who}",
            body="You are the delegate."
            if delegate
            else "Escalated to the discipline lead (A-07).",
            link=f"/projects/{sheet.project_id}/sheets/{sheet.pk}",
            dedupe_key=f"flag:{flag.pk}:escalation",
        )
        return sent


register(ReviewOverdue())

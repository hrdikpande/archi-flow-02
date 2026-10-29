"""Weekly owner summary (03 §18): Monday 08:30 local time, email to every Owner."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import OrgRole
from apps.core.models import Organisation
from apps.notifications.services import notify

from . import services

SEND_AT = time(8, 30)


def _fmt_delta(value: int | None) -> str:
    if value is None:
        return ""
    return f" ({'+' if value >= 0 else ''}{value} on last week)"


def send_owner_summaries(now: datetime | None = None) -> int:
    """Idempotent: one summary per owner per week (dedupe key holds the week)."""
    sent = 0
    for organisation in Organisation.objects.all():
        local = (now or timezone.now()).astimezone(ZoneInfo(organisation.timezone))
        if local.weekday() != 0 or local.time() < SEND_AT:
            continue
        week = (local.date() - timedelta(days=local.weekday())).isoformat()
        for owner in User.objects.filter(
            organisation=organisation, org_role=OrgRole.OWNER, is_active=True
        ):
            data = services.portfolio(owner)
            worst = [
                f"{r['project'].code} {r['project'].name}: {r['late']} late, {r['at_risk']} at risk"
                for r in data["projects"][:5]
                if r["late"] or r["at_risk"]
            ]
            lines = [
                f"Active projects: {data['active_projects']}",
                f"Late sheets: {data['late']}{_fmt_delta(data['late_delta'])}",
                f"At risk: {data['at_risk']}{_fmt_delta(data['at_risk_delta'])}",
                f"Oldest waiting review: {data['oldest_review_days'] or 0} working days",
                f"Over-allocated people this week: {data['over_allocated_people']}",
                "",
                *(
                    ["Projects needing attention:", *worst]
                    if worst
                    else ["No late or at-risk sheets."]
                ),
            ]
            if notify(
                owner,
                "weekly_owner_summary",
                title=f"Week of {local.date():%d-%b-%Y}: "
                f"{data['late']} late, {data['at_risk']} at risk",
                body="\n".join(lines),
                link="/portfolio",
                dedupe_key=f"owner-summary:{week}",
            ):
                sent += 1
    return sent

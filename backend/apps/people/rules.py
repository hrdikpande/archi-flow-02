"""A-05 (weekly allocation check) and A-06 (timesheet missing reminder)."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.automation.engine import Context, Rule, Wanted, register
from apps.automation.models import Flag, FlagKind
from apps.notifications.services import notify, notify_many
from apps.projects.models import ProjectMembership

from .models import Allocation, Timesheet, TimesheetState
from .services import Capacity, monday, profile_for


def _people(ctx: Context, only: Any) -> list[User]:
    qs = User.objects.filter(organisation=ctx.organisation, is_active=True, org_role=OrgRole.STAFF)
    if only is not None:
        qs = qs.filter(pk__in=[str(o).split(":")[0] for o in only])
    return list(qs.select_related("staff_profile"))


def _leads_of(user: User) -> list[User]:
    """DLs of the person's discipline and PLs on their projects."""
    profile = profile_for(user)
    projects = ProjectMembership.objects.filter(user=user).values("project_id")
    leads = User.objects.filter(
        memberships__project_id__in=projects,
        memberships__role__in=[ProjectRole.DL, ProjectRole.PL],
        is_active=True,
    ).distinct()
    out = []
    for lead in leads:
        dl = lead.memberships.filter(project_id__in=projects, role=ProjectRole.DL)
        pl = lead.memberships.filter(project_id__in=projects, role=ProjectRole.PL).exists()
        if (
            pl
            or dl.filter(discipline__isnull=True).exists()
            or (
                profile.discipline_id is not None
                and dl.filter(discipline_id=profile.discipline_id).exists()
            )
        ):
            out.append(lead)
    return out


class AllocationCheck(Rule):
    """A-05: this week's allocations above 110% or below 50% of capacity."""

    key = "A-05"
    kinds = (FlagKind.OVER_ALLOCATED, FlagKind.UNDER_ALLOCATED)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        week = monday(ctx.today)
        over = Decimal(str(ctx.params["over_allocated_pct"]))
        under = Decimal(str(ctx.params["under_allocated_pct"]))
        cap = Capacity(ctx.organisation, week, week)
        people = _people(ctx, only)
        totals = dict(
            Allocation.objects.filter(user__in=people, week=week)
            .values_list("user_id")
            .annotate(t=Sum("planned_h"))
        )
        out = []
        for person in people:
            capacity = cap.hours(profile_for(person), week)
            if capacity <= 0:
                continue  # on leave all week
            pct = (totals.get(person.pk, Decimal("0")) / capacity * 100).quantize(Decimal("1"))
            kind = (
                FlagKind.OVER_ALLOCATED
                if pct > over
                else FlagKind.UNDER_ALLOCATED
                if pct < under
                else None
            )
            if kind:
                out.append(
                    Wanted(
                        kind,
                        "person_week",
                        f"{person.pk}:{week.isoformat()}",
                        user_id=person.pk,
                        week=week,
                        data={"pct": int(pct)},
                    )
                )
        return out

    def scope(self, flags: Any, only: Any) -> Any:
        """Event recompute touches only those people's flags."""
        return (
            flags
            if only is None
            else flags.filter(user_id__in=[str(o).split(":")[0] for o in only])
        )

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        person = User.objects.get(pk=str(flag.user_id))
        word = "over" if flag.kind == FlagKind.OVER_ALLOCATED else "under"
        return notify_many(
            _leads_of(person),
            "allocation_flag",
            title=f"{person.short_name} is {word}-allocated this week ({flag.data['pct']}%)",
            link="/workload",
            dedupe_key=f"flag:{flag.pk}",
        )


class TimesheetMissing(Rule):
    """A-06: no submitted timesheet for the previous week → remind the person, list to DLs."""

    key = "A-06"
    kinds = (FlagKind.TIMESHEET_MISSING,)

    def evaluate(self, ctx: Context, only: Any = None) -> list[Wanted]:
        week = monday(ctx.today) - timedelta(weeks=1)
        done = set(
            Timesheet.objects.filter(
                organisation=ctx.organisation,
                week=week,
                state__in=[TimesheetState.SUBMITTED, TimesheetState.APPROVED],
            ).values_list("user_id", flat=True)
        )
        return [
            Wanted(
                FlagKind.TIMESHEET_MISSING,
                "person_week",
                f"{p.pk}:{week.isoformat()}",
                user_id=p.pk,
                week=week,
                data={"week": week.isoformat()},
            )
            for p in _people(ctx, only)
            if p.pk not in done
        ]

    def scope(self, flags: Any, only: Any) -> Any:
        return (
            flags
            if only is None
            else flags.filter(user_id__in=[str(o).split(":")[0] for o in only])
        )

    def on_raised(self, ctx: Context, flag: Flag) -> int:
        person = User.objects.get(pk=str(flag.user_id))
        week = flag.data["week"]
        shown = date.fromisoformat(week).strftime("%d-%b-%Y")  # N-08 display format
        return (
            1
            if notify(
                person,
                "timesheet_missing",
                title=f"Your timesheet for the week of {shown} is missing",
                body="Submit it today.",
                link=f"/timesheets?week={week}",
                dedupe_key=f"flag:{flag.pk}",
            )
            else 0
        )

    def after_apply(self, ctx: Context, open_flags: list[Flag]) -> int:
        """One list per DL of who has not submitted (03 §10: 'list to DL')."""
        week = (monday(ctx.today) - timedelta(weeks=1)).isoformat()
        missing = [f for f in open_flags if f.data.get("week") == week]
        by_lead: dict[Any, list[str]] = {}
        leads: dict[Any, User] = {}
        for f in missing:
            person = User.objects.get(pk=str(f.user_id))
            for lead in _leads_of(person):
                by_lead.setdefault(lead.pk, []).append(person.short_name)
                leads[lead.pk] = lead
        sent = 0
        for pk, names in by_lead.items():
            plural = "s" if len(names) != 1 else ""
            if notify(
                leads[pk],
                "timesheet_missing",
                title=f"{len(names)} timesheet{plural} missing for the week of "
                f"{date.fromisoformat(week):%d-%b-%Y}",
                body=", ".join(sorted(names)),
                link=f"/timesheets/approvals?week={week}",
                dedupe_key=f"a06-list:{week}:{len(names)}",
            ):
                sent += 1
        return sent


register(AllocationCheck())
register(TimesheetMissing())

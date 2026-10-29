"""What each export contains (F-52). Each builder applies the same filters and visibility as
the list view it exports, so an export never shows more than the screen did (F-38)."""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from django.db.models import Count, QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.automation.models import Flag
from apps.core.exceptions import DomainError
from apps.people import services as people
from apps.people.models import TimeEntry
from apps.projects.models import Project
from apps.register.models import Sheet, SheetState
from apps.register.selectors import open_flags, register_sheets, visible_sheets
from apps.transmittals.models import Transmittal
from apps.transmittals.services import display_date

STATE_LABEL = dict(SheetState.choices)
FLAG_LABEL = {"late": "Late", "at_risk": "At risk"}


@dataclass
class Table:
    title: str
    columns: list[str]
    rows: Iterable[list[Any]]
    subtitle: str = ""
    widths: list[int] = field(default_factory=list)


def _flags(sheet: Sheet) -> str:
    parts = []
    for f in getattr(sheet, "open_flags", []):
        days = f.data.get("days")
        label = FLAG_LABEL.get(f.kind, f.kind)
        parts.append(f"{label} {days} d" if days is not None else label)
    return ", ".join(parts)


def _date(d: date | None) -> str:
    return d.strftime("%d-%b-%Y") if d else ""


def _flag_filter(qs: QuerySet[Sheet], filters: dict[str, Any]) -> QuerySet[Sheet]:
    kinds = [k for k, on in (("late", filters.get("late")), ("at_risk", filters.get("risk"))) if on]
    kinds += [k for k in filters.get("flag", []) if k in FLAG_LABEL]
    if kinds:
        qs = qs.filter(
            pk__in=Flag.objects.filter(kind__in=kinds, cleared_at__isnull=True).values("sheet_id")
        )
    return qs


def _list(filters: dict[str, Any], key: str) -> list[str]:
    value = filters.get(key) or []
    return [value] if isinstance(value, str) else [str(v) for v in value if v]


class Builder:
    title = ""

    def __init__(self, user: User, project: Project | None, filters: dict[str, Any]) -> None:
        self.user, self.project, self.filters = user, project, filters
        self.check()

    def check(self) -> None:
        """Raise if the user may not export this (mirrors the list view's permission)."""

    def count(self) -> int:
        raise NotImplementedError

    def table(self) -> Table:
        raise NotImplementedError

    def require_project(self) -> Project:
        if self.project is None:
            raise DomainError("project_required", "Choose a project to export.")
        require(self.user, Action.VIEW_PROJECT, project=self.project)
        return self.project


class RegisterBuilder(Builder):
    def check(self) -> None:
        self.require_project()

    def queryset(self) -> QuerySet[Sheet]:
        f = self.filters
        filters = {
            k: _list(f, k) for k in ("discipline", "stage", "package", "owner", "checker", "state")
        }
        filters["q"] = f.get("q", "")
        return _flag_filter(register_sheets(self.require_project(), filters), f)

    def count(self) -> int:
        return self.queryset().count()

    def table(self) -> Table:
        p = self.require_project()
        rows = (
            [
                s.number,
                s.title,
                s.discipline.code,
                s.stage.name,
                s.package.name if s.package else "",
                s.owner.full_name if s.owner else "",
                s.checker.full_name if s.checker else "",
                _date(s.planned_issue_date),
                STATE_LABEL[s.state],
                s.current_revision.code if s.current_revision else "",
                _flags(s),
            ]
            for s in self.queryset().iterator(chunk_size=2000)
        )
        return Table(
            f"{p.code} {p.name} · Register",
            [
                "Sheet",
                "Title",
                "Disc",
                "Stage",
                "Package",
                "Owner",
                "Checker",
                "Planned",
                "State",
                "Rev",
                "Flags",
            ],
            rows,
            widths=[12, 40, 6, 22, 18, 18, 18, 12, 18, 6, 16],
        )


class TransmittalLogBuilder(Builder):
    def check(self) -> None:
        self.require_project()

    def queryset(self) -> QuerySet[Transmittal]:
        return (
            Transmittal.objects.filter(project=self.require_project())
            .select_related("sent_by", "project__organisation")
            .annotate(
                n_sheets=Count("items", distinct=True),
                n_recipients=Count("recipients", distinct=True),
            )
            .order_by("seq")
        )

    def count(self) -> int:
        return self.queryset().count()

    def table(self) -> Table:
        p = self.require_project()
        rows = (
            [
                t.number,
                display_date(t.sent_at, p.organisation.timezone) if t.sent_at else "",
                t.purpose,
                t.n_sheets,  # type: ignore[attr-defined]
                t.n_recipients,  # type: ignore[attr-defined]
                t.sent_by.full_name if t.sent_by else "",
            ]
            for t in self.queryset()
        )
        return Table(
            f"{p.code} {p.name} · Transmittal log",
            ["Number", "Date", "Purpose", "Sheets", "Recipients", "Sent by"],
            rows,
            widths=[24, 14, 10, 8, 10, 22],
        )


class LateAtRiskBuilder(Builder):
    def queryset(self) -> QuerySet[Sheet]:
        f = dict(self.filters)
        if not f.get("flag") and not f.get("late") and not f.get("risk"):
            f["flag"] = ["late", "at_risk"]
        qs = visible_sheets(self.user).select_related(
            "project", "discipline", "owner", "current_revision"
        )
        if projects := _list(f, "project"):
            qs = qs.filter(project_id__in=projects)
        if disciplines := _list(f, "discipline"):
            qs = qs.filter(discipline_id__in=disciplines)
        return (
            _flag_filter(qs, f).prefetch_related(open_flags()).order_by("project__code", "number")
        )

    def count(self) -> int:
        return self.queryset().count()

    def table(self) -> Table:
        rows = (
            [
                s.project.code,
                s.number,
                s.title,
                s.discipline.code,
                s.owner.full_name if s.owner else "",
                _date(s.planned_issue_date),
                STATE_LABEL[s.state],
                _flags(s),
            ]
            for s in self.queryset().iterator(chunk_size=2000)
        )
        return Table(
            "Late and at-risk sheets",
            ["Project", "Sheet", "Title", "Disc", "Owner", "Planned", "State", "Flags"],
            rows,
            widths=[12, 12, 40, 6, 20, 12, 18, 16],
        )


def _period(filters: dict[str, Any], default_weeks: int) -> tuple[date, date]:
    try:
        start = date.fromisoformat(filters.get("from") or date.today().isoformat())
        to = filters.get("to")
        end = date.fromisoformat(to) if to else start + timedelta(weeks=default_weeks)
    except ValueError as exc:
        raise DomainError("invalid_period", "Use YYYY-MM-DD dates.") from exc
    return (start, end) if start <= end else (end, start)


class WorkloadBuilder(Builder):
    def count(self) -> int:
        return people.visible_people(self.user).count()

    def table(self) -> Table:
        start, end = _period(self.filters, 7)
        data = people.workload(self.user, start, end, self.filters.get("discipline") or None)
        weeks = data["weeks"]
        rows = (
            [
                r["user"].full_name,
                r["discipline"] or "",
                *[f"{c['pct']}%" if c["pct"] is not None else "Leave" for c in r["cells"]],
            ]
            for r in data["people"]
        )
        return Table(
            "Workload",
            ["Person", "Disc", *[f"W{w.isocalendar().week} {_date(w)[:6]}" for w in weeks]],
            rows,
            subtitle=f"{_date(weeks[0])} to {_date(weeks[-1] + timedelta(days=6))} · % of capacity",
            widths=[22, 6, *[10] * len(weeks)],
        )


class TimesheetBuilder(Builder):
    def queryset(self) -> QuerySet[TimeEntry]:
        start, end = _period(self.filters, 4)
        return (
            TimeEntry.objects.filter(
                timesheet__user__in=people.visible_people(self.user), date__gte=start, date__lte=end
            )
            .select_related("timesheet__user", "project", "stage")
            .order_by("timesheet__user__full_name", "date")
        )

    def count(self) -> int:
        return self.queryset().count()

    def table(self) -> Table:
        start, end = _period(self.filters, 4)
        rows = (
            [
                e.timesheet.user.full_name,
                _date(e.timesheet.week),
                e.project.code,
                e.stage.name,
                _date(e.date),
                e.hours,
                e.timesheet.get_state_display(),
                e.note,
            ]
            for e in self.queryset().iterator(chunk_size=2000)
        )
        return Table(
            "Timesheets",
            ["Person", "Week of", "Project", "Stage", "Date", "Hours", "Status", "Note"],
            rows,
            subtitle=f"{_date(start)} to {_date(end)}",
            widths=[22, 12, 12, 22, 12, 7, 12, 30],
        )


BUILDERS: dict[str, type[Builder]] = {
    "register": RegisterBuilder,
    "transmittal_log": TransmittalLogBuilder,
    "late_at_risk": LateAtRiskBuilder,
    "workload": WorkloadBuilder,
    "timesheets": TimesheetBuilder,
}

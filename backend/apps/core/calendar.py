"""Working-day calendar (F-42). Drives "working days" in every automation (A-01, A-02, A-05)."""

from dataclasses import dataclass
from datetime import date, timedelta

from .models import Holiday, Organisation


@dataclass(frozen=True)
class WorkingCalendar:
    weekdays: frozenset[int]
    holidays: frozenset[date]

    @classmethod
    def for_org(
        cls, organisation: Organisation, start: date | None = None, end: date | None = None
    ) -> "WorkingCalendar":
        holidays = Holiday.objects.filter(organisation=organisation)
        if start is not None:
            holidays = holidays.filter(date__gte=start)
        if end is not None:
            holidays = holidays.filter(date__lte=end)
        return cls(
            weekdays=organisation.working_weekdays,
            holidays=frozenset(holidays.values_list("date", flat=True)),
        )

    def is_working_day(self, day: date) -> bool:
        return day.weekday() in self.weekdays and day not in self.holidays

    def add_working_days(self, start: date, days: int) -> date:
        """Date `days` working days after (or before, if negative) `start`.

        `start` itself is never counted; adding 0 returns `start` unchanged.
        """
        step = 1 if days >= 0 else -1
        remaining = abs(days)
        current = start
        while remaining:
            current += timedelta(days=step)
            if self.is_working_day(current):
                remaining -= 1
        return current

    def working_days_between(self, start: date, end: date) -> int:
        """Signed count of working days from `start` to `end`.

        Used for "Due in 4 days" (start=today, end=planned date, positive) and
        "Late 3 days" (negative when end < start). See DESIGN.md §2.3 and 03 §10.

        Exclusive of `start`, inclusive of `end`, so it mirrors add_working_days:
        add_working_days(a, n) == b  ⇒  working_days_between(a, b) == n. A deadline on a
        weekend or holiday counts only the working days before it (DD-017).
        """
        if end == start:
            return 0
        sign = 1 if end > start else -1
        low, high = (start, end) if sign == 1 else (end, start)
        count = 0
        day = low + timedelta(days=1)
        while day <= high:
            if self.is_working_day(day):
                count += 1
            day += timedelta(days=1)
        return sign * count

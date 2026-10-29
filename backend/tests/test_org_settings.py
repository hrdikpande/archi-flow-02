"""F-42 organisation settings, disciplines, holidays and the working calendar; N-08 defaults."""

import datetime as dt

import pytest

from apps.audit.models import AuditEvent
from apps.core.calendar import WorkingCalendar
from apps.core.models import Holiday, WorkWeek

SETTINGS = "/api/v1/org/settings"


def test_defaults_are_indian_and_spec_placeholders(admin_client) -> None:
    data = admin_client.get(SETTINGS).json()
    assert data["organisation"]["timezone"] == "Asia/Kolkata"
    assert data["organisation"]["currency"] == "INR"
    assert data["organisation"]["work_week"] == "mon_fri"
    assert data["transmittal_link_days"] == 30
    assert data["default_weekly_capacity_h"] == "45.0"
    assert {p["code"] for p in data["purpose_codes"]} >= {"GFC", "FA", "FI"}
    assert "thresholds" not in data  # thresholds live on automation rules (DD-022)


def test_admin_switches_to_six_day_week_and_it_is_audited(admin_client, org) -> None:
    response = admin_client.patch(SETTINGS, {"organisation": {"work_week": "mon_sat"}})
    assert response.status_code == 200
    assert response.json()["organisation"]["work_week"] == "mon_sat"
    event = AuditEvent.objects.get(verb="org.updated")
    assert event.before == {"work_week": "mon_fri"}
    assert event.after == {"work_week": "mon_sat"}


@pytest.mark.parametrize(
    "body",
    [
        {"purpose_codes": [{"code": "IFC", "label": "Issued for construction"}]},
        {"purpose_codes": [{"code": "FA", "label": "a"}, {"code": "FA", "label": "b"}]},
        {"organisation": {"timezone": "Mars/Olympus"}},
        {"revision_scheme": {"digits": 2, "series": []}},
        {"transmittal_link_days": 0},
    ],
)
def test_invalid_settings_are_rejected(admin_client, body) -> None:
    response = admin_client.patch(SETTINGS, body, format="json")
    assert response.status_code == 400, response.content
    assert not AuditEvent.objects.filter(verb__startswith="org").exists()


def test_discipline_codes_are_unique_and_uppercased(admin_client) -> None:
    assert (
        admin_client.post("/api/v1/disciplines", {"code": "a", "name": "Arch"}).status_code == 201
    )
    duplicate = admin_client.post("/api/v1/disciplines", {"code": "A", "name": "Again"})
    assert duplicate.status_code == 400


def test_holiday_dates_are_unique_and_filtered_by_year(admin_client) -> None:
    body = {"date": "2026-11-01", "name": "Kannada Rajyotsava"}
    assert admin_client.post("/api/v1/holidays", body).status_code == 201
    assert admin_client.post("/api/v1/holidays", body).status_code == 400
    admin_client.post("/api/v1/holidays", {"date": "2027-01-26", "name": "Republic Day"})
    names = [h["name"] for h in admin_client.get("/api/v1/holidays", {"year": 2027}).json()]
    assert names == ["Republic Day"]


class TestWorkingCalendar:
    FRI = dt.date(2026, 10, 23)

    def test_skips_weekend_on_five_day_week(self, org) -> None:
        cal = WorkingCalendar.for_org(org)
        assert cal.add_working_days(self.FRI, 1) == dt.date(2026, 10, 26)  # Monday

    def test_saturday_counts_on_six_day_week(self, org) -> None:
        org.work_week = WorkWeek.MON_SAT
        org.save()
        assert WorkingCalendar.for_org(org).add_working_days(self.FRI, 1) == dt.date(2026, 10, 24)

    def test_skips_holidays(self, org) -> None:
        Holiday.objects.create(organisation=org, date=dt.date(2026, 10, 26), name="Holiday")
        cal = WorkingCalendar.for_org(org)
        assert cal.add_working_days(self.FRI, 1) == dt.date(2026, 10, 27)
        assert not cal.is_working_day(dt.date(2026, 10, 26))

    def test_backwards_and_zero(self, org) -> None:
        cal = WorkingCalendar.for_org(org)
        assert cal.add_working_days(dt.date(2026, 10, 26), -1) == self.FRI
        assert cal.add_working_days(self.FRI, 0) == self.FRI


class TestWorkingDaysBetween:
    MON = dt.date(2026, 10, 26)

    def test_mirrors_add_working_days(self, org) -> None:
        cal = WorkingCalendar.for_org(org)
        for n in range(-12, 13):
            assert cal.working_days_between(self.MON, cal.add_working_days(self.MON, n)) == n

    def test_same_day_and_weekend_deadline(self, org) -> None:
        cal = WorkingCalendar.for_org(org)
        fri, sun = dt.date(2026, 10, 30), dt.date(2026, 11, 1)
        assert cal.working_days_between(fri, fri) == 0
        assert cal.working_days_between(fri, sun) == 0  # due "today": no working day before it
        assert cal.working_days_between(sun, fri) == -0

    def test_holidays_are_skipped(self, org) -> None:
        Holiday.objects.create(organisation=org, date=dt.date(2026, 10, 27), name="Holiday")
        cal = WorkingCalendar.for_org(org)
        assert cal.working_days_between(self.MON, dt.date(2026, 10, 29)) == 2

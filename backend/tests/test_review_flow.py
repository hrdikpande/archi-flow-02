"""S7 (P2): review delegation F-12, pre-check lists F-13, acknowledgement F-15, A-07."""

import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import time_machine
from django.core import mail
from django.test import Client
from django.utils import timezone

from apps.accounts.roles import ProjectRole
from apps.automation.engine import run_rule
from apps.automation.models import Flag
from apps.core.exceptions import DomainError
from apps.dashboards.services import unacknowledged
from apps.notifications.models import Notification
from apps.projects.models import ProjectMembership
from apps.register.models import SheetState as S
from apps.transmittals.models import TransmittalRecipient
from apps.transmittals.services import issue
from apps.workflow import checklists, delegation
from apps.workflow.models import Checklist, ChecklistItem, ChecklistResponse
from apps.workflow.selectors import review_queue
from apps.workflow.services import TransitionNotAllowedError, allowed_actions, transition

from .test_transmittals import approved, run_side_effects
from .workflow_fixtures import draft_with_pdf, new_sheet

IST = ZoneInfo("Asia/Kolkata")


def submitted(team, number="A-101"):
    sheet = new_sheet(team, number, state=S.IN_PROGRESS)
    draft_with_pdf(team, sheet)
    return transition(sheet, "submit", team.designer)


class TestDelegation:
    def test_delegate_sees_and_checks_while_reviewer_is_away(self, team):
        sheet = submitted(team)
        today = timezone.localdate()
        delegation.set_delegation(
            team.checker,
            user=team.checker,
            delegate=team.dl,
            start=today,
            end=today + timedelta(days=5),
        )
        queue = review_queue(team.dl)
        assert [q.sheet.pk for q in queue] == [sheet.pk]
        assert queue[0].delegated_from == team.checker
        assert "start_check" in [a.action for a in allowed_actions(sheet, team.dl)]
        transition(sheet, "start_check", team.dl)
        transition(sheet, "approve", team.dl, comment="Checked for Anil")

    def test_no_routing_where_the_delegate_cannot_review(self, team, make_user):
        sheet = submitted(team)
        today = timezone.localdate()
        helper = make_user(email="helper@firm.example")
        ProjectMembership.objects.create(
            organisation=team.org, project=team.project, user=helper, role=ProjectRole.VIEWER
        )
        delegation.set_delegation(
            team.checker, user=team.checker, delegate=helper, start=today, end=today
        )
        assert review_queue(helper) == []
        assert "start_check" not in [a.action for a in allowed_actions(sheet, helper)]
        assert [q.sheet.pk for q in review_queue(team.checker)] == [sheet.pk]  # stays with them

    def test_dates_bound_the_routing(self, team):
        sheet = submitted(team)
        today = timezone.localdate()
        delegation.set_delegation(
            team.checker,
            user=team.checker,
            delegate=team.dl,
            start=today + timedelta(days=3),
            end=today + timedelta(days=5),
        )
        assert review_queue(team.dl) == []
        with time_machine.travel(today + timedelta(days=4)):
            assert [q.sheet.pk for q in review_queue(team.dl)] == [sheet.pk]

    def test_rules(self, team, make_user):
        today = timezone.localdate()
        with pytest.raises(DomainError):
            delegation.set_delegation(
                team.checker, user=team.checker, delegate=team.checker, start=today, end=today
            )
        with pytest.raises(DomainError):
            delegation.set_delegation(
                team.designer, user=team.checker, delegate=team.dl, start=today, end=today
            )  # not your own
        delegation.set_delegation(
            team.checker,
            user=team.checker,
            delegate=team.dl,
            start=today,
            end=today + timedelta(days=2),
        )
        with pytest.raises(DomainError, match="already"):
            delegation.set_delegation(
                team.checker,
                user=team.checker,
                delegate=team.pl,
                start=today + timedelta(days=1),
                end=today + timedelta(days=4),
            )
        with pytest.raises(DomainError, match="delegated their own"):
            delegation.set_delegation(
                team.senior, user=team.senior, delegate=team.checker, start=today, end=today
            )

    def test_api(self, team, client_for):
        today = timezone.localdate().isoformat()
        res = client_for(team.checker).post(
            "/api/v1/delegations",
            {"delegate": str(team.dl.pk), "start": today, "end": today},
            format="json",
        )
        assert res.status_code == 201 and res.json()["user"] == str(team.checker.pk)
        listed = client_for(team.dl).get("/api/v1/delegations").json()
        assert [d["id"] for d in listed] == [res.json()["id"]]  # the delegate sees it too
        assert (
            client_for(team.designer).delete(f"/api/v1/delegations/{res.json()['id']}").status_code
            == 404
        )


@pytest.fixture
def precheck(team):
    c = Checklist.objects.create(
        organisation=team.org,
        name="Arch pre-check",
        discipline=team.arch,
        stage_names=["Working drawings"],
    )
    ChecklistItem.objects.create(checklist=c, seq=1, text="North point and scale", mandatory=True)
    ChecklistItem.objects.create(checklist=c, seq=2, text="Title block complete", mandatory=True)
    ChecklistItem.objects.create(checklist=c, seq=3, text="Room data checked", mandatory=False)
    return c


class TestChecklists:
    def test_submit_blocked_until_mandatory_ticked_and_ticks_stored(self, team, precheck):
        sheet = new_sheet(team, state=S.IN_PROGRESS)
        draft_with_pdf(team, sheet)
        items = list(precheck.items.order_by("seq"))
        with pytest.raises(TransitionNotAllowedError, match="Title block complete"):
            transition(sheet, "submit", team.designer, checklist=[items[0].pk])
        transition(sheet, "submit", team.designer, checklist=[items[0].pk, items[1].pk])
        response = ChecklistResponse.objects.get(sheet=sheet, round=1)
        assert [i["ticked"] for i in response.items] == [True, True, False]

    def test_applies_by_discipline_and_stage(self, team, precheck):
        sheet = new_sheet(team)
        assert len(checklists.items_for(sheet)) == 3
        precheck.stage_names = ["Concept"]
        precheck.save()
        assert checklists.items_for(sheet) == []

    def test_precheck_api_before_and_after_submit(self, team, precheck, client_for):
        sheet = new_sheet(team, state=S.IN_PROGRESS)
        draft_with_pdf(team, sheet)
        url = f"/api/v1/sheets/{sheet.pk}/precheck"
        before = client_for(team.designer).get(url).json()
        assert before["round"] == 1 and [i["ticked"] for i in before["items"]] == [False] * 3
        ids = [i["id"] for i in before["items"][:2]]
        res = client_for(team.designer).post(
            f"/api/v1/sheets/{sheet.pk}/transitions",
            {"action": "submit", "checklist": ids},
            format="json",
        )
        assert res.status_code == 200
        after = client_for(team.checker).get(url).json()
        assert after["round"] == 1 and after["submitted_at"]
        assert [i["ticked"] for i in after["items"]] == [True, True, False]

    def test_builder_admin_only(self, team, admin, client_for):
        body = {"name": "MEP pre-check", "stage_names": [], "items": [{"text": "Riser checked"}]}
        assert (
            client_for(team.dl).post("/api/v1/checklists", body, format="json").status_code == 403
        )
        res = client_for(admin).post("/api/v1/checklists", body, format="json")
        assert res.status_code == 201 and res.json()["items"][0]["mandatory"] is True


class TestA07:
    def test_escalates_to_dl_then_to_delegate(self, team):
        with time_machine.travel(datetime(2026, 10, 19, 10, tzinfo=IST)):  # Monday
            sheet = submitted(team)
        with time_machine.travel(datetime(2026, 10, 23, 8, 5, tzinfo=IST)):  # Friday: 4 wd
            run_rule(team.org, "A-07")
            run_rule(team.org, "A-07")
            flag = Flag.objects.get(rule="A-07", cleared_at__isnull=True)
            assert flag.sheet_id == sheet.pk and flag.data["days"] == 4
            notes = Notification.objects.filter(event="review_overdue")
            assert notes.filter(user=team.checker).count() == 1
            assert notes.filter(user=team.dl, title__startswith="Escalated").exists()

    def test_escalation_goes_to_the_delegate_when_set(self, team):
        with time_machine.travel(datetime(2026, 10, 19, 10, tzinfo=IST)):
            submitted(team)
        delegation.set_delegation(
            team.checker,
            user=team.checker,
            delegate=team.senior,
            start=date(2026, 10, 20),
            end=date(2026, 10, 30),
        )
        with time_machine.travel(datetime(2026, 10, 23, 8, 5, tzinfo=IST)):
            run_rule(team.org, "A-07")
        escalated = Notification.objects.filter(
            event="review_overdue", title__startswith="Escalated"
        )
        assert [n.user for n in escalated] == [team.senior]

    def test_cleared_when_the_review_moves_on(self, team):
        from apps.outbox.services import dispatch_pending

        with time_machine.travel(datetime(2026, 10, 19, 10, tzinfo=IST)):
            sheet = submitted(team)
        with time_machine.travel(datetime(2026, 10, 23, 8, 5, tzinfo=IST)):
            run_rule(team.org, "A-07")
            transition(sheet, "start_check", team.checker)
            dispatch_pending()  # opening the review restarts its clock: 0 working days
            assert not Flag.objects.filter(rule="A-07", cleared_at__isnull=True).exists()


@pytest.fixture
def contacts(team):
    from apps.contacts.models import Contact

    return [
        Contact.objects.create(
            organisation=team.org, full_name=f"Recipient {i}", email=f"r{i}@client.example"
        )
        for i in range(2)
    ]


class TestAcknowledgement:
    def test_recipient_acknowledges_and_dashboard_lists_the_rest(
        self,
        team,
        contacts,
        fake_storage,
        django_capture_on_commit_callbacks,
    ):
        sheet = approved(team, "A-101")
        issue(
            team.dc,
            team.project,
            sheet_ids=[sheet.pk],
            purpose="GFC",
            contact_ids=[contacts[0].pk, contacts[1].pk],
        )
        run_side_effects(django_capture_on_commit_callbacks)
        tokens = {m.to[0]: re.search(r"/t/([\w-]+)", m.body).group(1) for m in mail.outbox}
        assert "?ack=1" in mail.outbox[-1].body
        browser = Client(enforce_csrf_checks=True)
        token = tokens[contacts[0].email]
        page = browser.get(f"/t/{token}/?ack=1")
        assert "Acknowledge receipt" in page.content.decode()
        assert browser.get(f"/t/{token}/ack").status_code == 405  # never by GET (mail scanners)
        # The token is the credential; browsers send "Origin: null" under no-referrer.
        assert browser.post(f"/t/{token}/ack", headers={"Origin": "null"}).status_code == 302
        assert browser.post("/t/not-a-token/ack").status_code == 404
        r0 = TransmittalRecipient.objects.get(contact=contacts[0])
        assert r0.acknowledged_at is not None
        assert "Receipt acknowledged" in browser.get(f"/t/{token}/").content.decode()
        TransmittalRecipient.objects.update(delivered_at=timezone.now() - timedelta(days=6))
        assert [u["contact"] for u in unacknowledged(team.project)] == [contacts[1].full_name]

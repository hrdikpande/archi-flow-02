"""S9 (P2): A-09 and the billing signal F-27/F-28/I-08; site view F-51."""

import csv
import hashlib
import hmac
import io
import json
import re
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.core import mail
from django.utils import timezone

from apps.accounts.permissions import PermissionDeniedError
from apps.accounts.roles import OrgRole
from apps.accounts.services import create_api_token
from apps.billing import services
from apps.billing.models import BillingSignal
from apps.comments.services import record_approval
from apps.contacts.models import Contact
from apps.core.exceptions import ConflictError
from apps.core.formatting import inr
from apps.core.models import OrgSettings
from apps.notifications.models import Notification
from apps.outbox.services import dispatch_pending
from apps.projects.models import StageState
from apps.register.models import RevisionState, SheetRevision
from apps.register.models import SheetState as S
from apps.transmittals import site
from apps.transmittals.models import SiteDownload, SiteLink

from .workflow_fixtures import new_sheet, ready_upload_for


@pytest.fixture
def accounts(make_user):
    return make_user(OrgRole.ACCOUNTS, email="accounts@firm.example", name="Meera Thomas")


def ready_stage(team, amount="3840000.00"):
    """Deliverables issued, then the PL records the client's approval → A-09."""
    team.stage.state, team.stage.fee_pct, team.stage.fee_amount = (
        StageState.DELIVERABLES_ISSUED,
        Decimal("40"),
        Decimal(amount),
    )
    team.stage.save()
    upload = ready_upload_for(team.pl, "approval.pdf", sha=f"approval-{team.stage.pk}")
    record_approval(
        team.pl,
        team.stage,
        approved_by="Dr Rao",
        approved_on=date(2026, 10, 22),
        evidence_upload=upload.pk,
    )
    dispatch_pending()
    team.stage.refresh_from_db()
    return BillingSignal.objects.get(stage=team.stage)


class TestA09:
    def test_approval_moves_stage_to_ready_and_tells_accounts(self, team, accounts, make_user):
        owner = make_user(OrgRole.OWNER)
        signal = ready_stage(team)
        assert team.stage.state == StageState.READY_TO_INVOICE
        assert signal.fee_pct == Decimal("40") and signal.fee_amount == Decimal("3840000.00")
        notes = Notification.objects.filter(event="ready_to_invoice")
        assert {n.user for n in notes} == {accounts, owner, team.pl}
        assert "₹38,40,000" in notes.first().title and "40.00% of fee" in notes.first().title

    def test_mark_invoiced(self, team, accounts):
        signal = ready_stage(team)
        with pytest.raises(PermissionDeniedError):
            services.mark_invoiced(team.pl, signal)
        services.mark_invoiced(accounts, signal, "INV-2026-117")
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.INVOICED
        with pytest.raises(ConflictError):
            services.mark_invoiced(accounts, signal)

    def test_visibility(self, team, accounts, make_user):
        ready_stage(team)
        assert services.visible_signals(accounts).count() == 1
        assert services.visible_signals(team.pl).count() == 1
        with pytest.raises(PermissionDeniedError):
            services.visible_signals(team.designer)


class TestCsvAndWebhook:
    def test_csv_in_the_agreed_layout(self, team, accounts):
        ready_stage(team)
        settings_ = OrgSettings.objects.get(organisation=team.org)
        settings_.billing_csv_columns = [
            {"field": "project_code", "header": "Job"},
            {"field": "fee_amount", "header": "Amount"},
            {"field": "days_waiting", "header": "Age"},
        ]
        settings_.save()
        rows = list(csv.reader(io.StringIO(services.export_csv(accounts).decode("utf-8-sig"))))
        assert rows == [["Job", "Amount", "Age"], ["2026-014", "3840000.00", "0"]]
        assert BillingSignal.objects.get().exported_at is not None

    def test_webhook_is_signed(self, team, accounts):
        settings_ = OrgSettings.objects.get(organisation=team.org)
        settings_.billing_webhook_url, settings_.billing_webhook_secret = (
            "https://accounts.example/hook",
            "s3cret",
        )
        settings_.save()
        sent = {}

        def fake(url, body, headers, timeout=10):
            sent["body"], sent["sig"] = body, headers["X-DrawingOps-Signature"]
            return 200

        with mock.patch("apps.core.net.post", fake):
            signal = ready_stage(team)
        expected = hmac.new(b"s3cret", sent["body"], hashlib.sha256).hexdigest()
        assert sent["sig"] == f"sha256={expected}"
        assert json.loads(sent["body"])["stage"]["name"] == "Working drawings"
        signal.refresh_from_db()
        assert signal.webhook_delivered_at is not None

    def test_api_token_can_list_and_mark_invoiced(self, team, accounts, admin, client):
        signal = ready_stage(team)
        _, read = create_api_token(admin, user=accounts, name="tally", scopes=["accounting:read"])
        _, write = create_api_token(
            admin, user=accounts, name="tally-w", scopes=["accounting:read", "accounting:write"]
        )
        listed = client.get(
            "/api/v1/billing/signals?state=ready", HTTP_AUTHORIZATION=f"Bearer {read}"
        )
        assert listed.status_code == 200 and listed.json()[0]["stage_name"] == "Working drawings"
        url = f"/api/v1/billing/signals/{signal.pk}/invoiced"
        assert (
            client.post(
                url,
                {"invoice_ref": "INV-1"},
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {read}",
                HTTP_IDEMPOTENCY_KEY="k",
            ).status_code
            == 403
        )
        done = client.post(
            url,
            {"invoice_ref": "INV-1"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {write}",
            HTTP_IDEMPOTENCY_KEY="k",
        )
        assert done.status_code == 200 and done.json()["invoice_ref"] == "INV-1"


def test_inr_grouping():
    assert inr(Decimal("3840000")) == "₹38,40,000"
    assert inr(100000) == "₹1,00,000"
    assert inr("1234567.5") == "₹12,34,567.50"


class TestSiteView:
    def issued(self, team, number, code, state=RevisionState.ISSUED):
        sheet = new_sheet(team, number, state=S.ISSUED)
        upload = ready_upload_for(team.dc, f"{number}-{code}.pdf", sha=f"{number}{code}")
        return SheetRevision.objects.create(
            organisation=team.org,
            sheet=sheet,
            code=code,
            seq=1,
            state=state,
            stage=team.stage,
            purpose="GFC",
            file=upload.file,
            issued_at=timezone.now(),
        )

    def test_magic_link_shows_current_set_only(
        self, team, client, fake_storage, django_capture_on_commit_callbacks
    ):
        current = self.issued(team, "A-101", "C02")
        old = self.issued(team, "A-102", "C01", state=RevisionState.SUPERSEDED)
        contact = Contact.objects.create(
            organisation=team.org, full_name="Site Engineer", email="site@contractor.example"
        )
        with django_capture_on_commit_callbacks(execute=True):
            site.create_link(team.dc, team.project, contact, "http://app.test")
        token = re.search(r"/site/([\w-]+)/", mail.outbox[-1].body).group(1)
        page = client.get(f"/site/{token}/")
        html = page.content.decode()
        assert page.status_code == 200 and page["Referrer-Policy"] == "no-referrer"
        assert "A-101" in html and "C02" in html and "A-102" not in html
        assert "A-101" not in client.get(f"/site/{token}/?q=A-9").content.decode()
        assert client.get(f"/site/{token}/r/{current.pk}").status_code == 302
        assert SiteDownload.objects.filter(revision=current).count() == 1
        assert client.get(f"/site/{token}/r/{old.pk}").status_code == 404  # superseded: hidden

    def test_revoked_and_expired_links(self, team, client, fake_storage):
        contact = Contact.objects.create(organisation=team.org, full_name="S", email="s@x.example")
        link, token = site.create_link(team.pl, team.project, contact, "http://app.test")
        site.revoke(team.pl, link)
        assert client.get(f"/site/{token}/").status_code == 404
        link2, token2 = site.create_link(team.pl, team.project, contact, "http://app.test")
        SiteLink.objects.filter(pk=link2.pk).update(expires_at=timezone.now() - timedelta(days=1))
        assert client.get(f"/site/{token2}/").status_code == 410

    def test_only_pl_and_dc_create_links(self, team):
        contact = Contact.objects.create(organisation=team.org, full_name="S", email="s@x.example")
        with pytest.raises(PermissionDeniedError):
            site.create_link(team.designer, team.project, contact, "http://app.test")

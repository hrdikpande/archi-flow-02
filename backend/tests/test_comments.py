"""S8 (P2): client comment log F-24, email capture F-25/I-09, stage approval F-26, A-08."""

from datetime import date, datetime
from email.message import EmailMessage
from zoneinfo import ZoneInfo

import pytest
import time_machine
from django.db import IntegrityError, transaction

from apps.accounts.permissions import PermissionDeniedError
from apps.automation.engine import run_rule
from apps.automation.models import Flag
from apps.comments import inbound, services
from apps.comments.models import ClientComment, CommentStatus, InboundEmail, InboundState
from apps.contacts.models import Contact
from apps.core.exceptions import ConflictError, DomainError
from apps.notifications.models import Notification
from apps.outbox.services import dispatch_pending
from apps.projects.models import StageState

from .conftest import make_pdf
from .workflow_fixtures import new_sheet, ready_upload_for

IST = ZoneInfo("Asia/Kolkata")


def log(team, actor=None, **extra):
    data = {
        "source": "meeting",
        "received_on": date(2026, 10, 20),
        "body": "Move the OT door 600 mm",
    }
    data.update(extra)
    return services.log_comment(actor or team.pl, team.project, **data)


class TestCommentLog:
    def test_log_assign_respond_close(self, team):
        sheet = new_sheet(team)
        c = log(team, sheets=[sheet], stage=team.stage)
        assert c.number == "2026-014-CC-0001" and c.status == CommentStatus.NEW
        services.update_comment(team.pl, c, assignee=team.designer)
        dispatch_pending()
        c.refresh_from_db()
        assert c.status == CommentStatus.ASSIGNED
        assert Notification.objects.filter(user=team.designer, event="comment_assigned").exists()
        with pytest.raises(DomainError, match="only with a response"):
            services.update_comment(team.designer, c, action="close")
        services.update_comment(team.designer, c, response="Door moved on P02", action="respond")
        services.update_comment(team.pl, c, action="close")
        c.refresh_from_db()
        assert c.status == CommentStatus.CLOSED and c.responded_by == team.designer and c.closed_at

    def test_reject_needs_reason_and_reopen(self, team):
        c = log(team)
        with pytest.raises(DomainError):
            services.update_comment(team.pl, c, action="reject", reject_reason=" ")
        services.update_comment(
            team.pl, c, action="reject", reject_reason="Out of scope (variation)"
        )
        services.update_comment(team.pl, c, action="reopen")
        c.refresh_from_db()
        assert c.status == CommentStatus.NEW

    def test_database_refuses_closed_without_response(self, team):
        c = log(team)
        with pytest.raises(IntegrityError), transaction.atomic():
            ClientComment.objects.filter(pk=c.pk).update(status=CommentStatus.CLOSED)

    def test_permissions(self, team):
        with pytest.raises(PermissionDeniedError):
            log(team, actor=team.designer)  # designers do not log client comments (03 §17)
        c = log(team, actor=team.dc)
        with pytest.raises(PermissionDeniedError):
            services.update_comment(team.designer, c, response="x")  # not assigned to them
        with pytest.raises(DomainError, match="not on this project"):
            log(team, assignee=team.outsider)

    def test_api_create_under_30s_shape(self, team, client_for):
        sheet = new_sheet(team)
        res = client_for(team.pl).post(
            f"/api/v1/projects/{team.project.pk}/comments",
            {
                "source": "call",
                "received_on": "2026-10-21",
                "body": "Client wants a wider corridor",
                "sheets": [str(sheet.pk)],
                "assignee": str(team.designer.pk),
            },
            format="json",
        )
        assert res.status_code == 201
        assert (
            res.json()["status"] == "assigned" and res.json()["sheet_refs"][0]["number"] == "A-101"
        )
        listed = (
            client_for(team.designer)
            .get(f"/api/v1/projects/{team.project.pk}/comments", {"sheet": str(sheet.pk)})
            .json()
        )
        assert [c["number"] for c in listed] == ["2026-014-CC-0001"]
        assert (
            client_for(team.outsider).get(f"/api/v1/comments/{res.json()['id']}").status_code == 404
        )


class TestA08:
    def test_reminds_after_five_days_and_clears_on_response(self, team):
        c = log(team, assignee=team.designer, received_on=date(2026, 10, 15))
        with time_machine.travel(datetime(2026, 10, 20, 8, 5, tzinfo=IST), tick=False):
            run_rule(team.org, "A-08")
            assert not Flag.objects.filter(rule="A-08").exists()  # exactly 5 days: not yet
        with time_machine.travel(datetime(2026, 10, 21, 8, 5, tzinfo=IST), tick=False):
            run_rule(team.org, "A-08")
            run_rule(team.org, "A-08")
            flag = Flag.objects.get(rule="A-08", cleared_at__isnull=True)
            assert flag.data["days"] == 6
            notes = Notification.objects.filter(
                event="comment_assigned", title__contains="no response"
            )
            assert {n.user for n in notes} == {team.designer, team.pl}
            services.update_comment(team.designer, c, response="Done", action="respond")
            dispatch_pending()
            flag.refresh_from_db()
            assert flag.cleared_at is not None


def mime(
    *,
    to,
    sender,
    subject="Comments on GF plan",
    body="Please move the OT door.",
    attach=True,
    message_id="<m1@client.example>",
):
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"], msg["Message-ID"] = sender, to, subject, message_id
    msg["Date"] = "Wed, 21 Oct 2026 10:15:00 +0530"
    msg.set_content(body)
    if attach:
        msg.add_attachment(
            make_pdf(1), maintype="application", subtype="pdf", filename="markup.pdf"
        )
        msg.add_attachment(
            b"MZ\x90\x00", maintype="application", subtype="octet-stream", filename="virus.exe"
        )
    return msg.as_bytes()


ADDRESS = "p-2026-014@inbound.test"


class TestEmailCapture:
    def test_known_sender_creates_new_comment_with_pdf_attachment(self, team, fake_storage):
        Contact.objects.create(
            organisation=team.org, full_name="Kavya Iyer", email="kavya@client.example"
        )
        email = inbound.ingest(mime(to=ADDRESS, sender="Kavya Iyer <Kavya@client.example>"))
        assert email.state == InboundState.PROCESSED and email.project == team.project
        c = email.comment
        assert (
            c.source == "email"
            and c.status == CommentStatus.NEW
            and c.received_on == date(2026, 10, 21)
        )
        assert c.from_contact.full_name == "Kavya Iyer" and "OT door" in c.body
        assert [f.original_name for f in c.attachments.all()] == ["markup.pdf"]  # .exe dropped
        assert (
            inbound.ingest(mime(to=ADDRESS, sender="kavya@client.example")) is None
        )  # same Message-ID

    def test_forwarded_by_staff_keeps_original_sender(self, team, fake_storage):
        body = (
            "FYI\n\n---------- Forwarded message ---------\n"
            "From: Dr Rao <rao@hospital.example>\nPlease add a scrub sink."
        )
        email = inbound.ingest(
            mime(
                to=ADDRESS,
                sender=team.pl.email,
                body=body,
                attach=False,
                message_id="<fwd@firm.example>",
            )
        )
        assert email.comment.from_name.startswith("Dr Rao <rao@hospital.example> (forwarded by")

    def test_unknown_sender_waits_for_review(self, team, fake_storage):
        email = inbound.ingest(mime(to=ADDRESS, sender="stranger@spam.example", message_id="<s@x>"))
        assert email.state == InboundState.REVIEW and email.comment is None
        with pytest.raises(PermissionDeniedError):
            inbound.review(team.designer, email, True)
        email = inbound.review(team.dc, email, True)
        assert email.state == InboundState.PROCESSED and email.comment.number.endswith("CC-0001")
        with pytest.raises(ConflictError):
            inbound.review(team.dc, email, False)

    def test_unrouted_address_is_ignored(self, team, fake_storage):
        assert inbound.ingest(mime(to="p-9999-999@inbound.test", sender="a@b.example")) is None
        assert not InboundEmail.objects.exists()

    def test_webhook_needs_the_secret(self, team, fake_storage, client):
        raw = mime(to=ADDRESS, sender="nobody@x.example", message_id="<w@x>")
        bad = client.post("/integrations/inbound-email", raw, content_type="message/rfc822")
        assert bad.status_code == 403
        ok = client.post(
            "/integrations/inbound-email",
            raw,
            content_type="message/rfc822",
            headers={"X-Inbound-Secret": "test-inbound-secret"},
        )
        assert ok.status_code == 201 and ok.json()["status"] == "review"

    def test_project_payload_shows_the_address(self, team, client_for):
        data = client_for(team.pl).get(f"/api/v1/projects/{team.project.pk}").json()
        assert data["inbound_address"] == ADDRESS
        assert data["my_permissions"]["log_comments"] is True


class TestClientApproval:
    def evidence(self, team):
        return ready_upload_for(team.pl, "approval.pdf", sha="approval").pk

    def test_issued_stage_moves_to_client_approved(self, team):
        team.stage.state = StageState.DELIVERABLES_ISSUED
        team.stage.save()
        services.record_approval(
            team.pl,
            team.stage,
            approved_by="Dr Rao (Medical Superintendent)",
            approved_on=date(2026, 10, 22),
            evidence_upload=self.evidence(team),
        )
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.CLIENT_APPROVED

    def test_approval_on_active_stage_waits_for_deliverables(self, team):
        from apps.projects.services import system_transition_stage

        team.stage.state = StageState.ACTIVE
        team.stage.save()
        services.record_approval(
            team.pl,
            team.stage,
            approved_by="Dr Rao",
            approved_on=date(2026, 10, 22),
            evidence_upload=self.evidence(team),
        )
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.ACTIVE
        system_transition_stage(team.stage, "deliverables_issued")
        dispatch_pending()
        team.stage.refresh_from_db()
        # client_approved, then A-09 (S9) moves it straight on to ready_to_invoice
        assert team.stage.state == StageState.READY_TO_INVOICE

    def test_only_pl_with_evidence(self, team):
        team.stage.state = StageState.DELIVERABLES_ISSUED
        team.stage.save()
        with pytest.raises(PermissionDeniedError):
            services.record_approval(
                team.dl,
                team.stage,
                approved_by="X",
                approved_on=date(2026, 10, 1),
                evidence_upload=self.evidence(team),
            )
        with pytest.raises(DomainError):
            services.record_approval(
                team.pl,
                team.stage,
                approved_by="X",
                approved_on=date(2026, 10, 1),
                evidence_upload="00000000-0000-0000-0000-000000000000",
            )

    def test_manual_stage_action_is_gone(self, team, client_for):
        team.stage.state = StageState.DELIVERABLES_ISSUED
        team.stage.save()
        res = client_for(team.pl).post(
            f"/api/v1/stages/{team.stage.pk}/transitions",
            {"action": "client_approved"},
            format="json",
        )
        assert res.status_code == 409

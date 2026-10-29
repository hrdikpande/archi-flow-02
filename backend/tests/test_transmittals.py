"""M04 issue and transmittals (F-14, F-07, F-48, A-03, S-15) and stage roll-up (F-03)."""

import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.contacts.models import Contact, ExternalOrg
from apps.outbox.services import dispatch_pending
from apps.projects.models import StageState
from apps.register.models import RevisionState, SheetRevision
from apps.register.models import SheetState as S
from apps.transmittals.models import DownloadLog, ExternalLink, Transmittal, TransmittalRecipient
from apps.transmittals.services import issue
from apps.workflow.models import StatusTransition

from .conftest import make_pdf
from .workflow_fixtures import draft_with_pdf, new_sheet


@pytest.fixture
def recipients(team):
    client = ExternalOrg.objects.create(
        organisation=team.org, name="Apollo Hospitals", kind="client"
    )
    return [
        Contact.objects.create(
            organisation=team.org,
            full_name=f"Recipient {i}",
            email=f"r{i}@client.example",
            external_org=client,
        )
        for i in range(3)
    ]


def approved(team, number, code="P01"):
    sheet = new_sheet(team, number, state=S.APPROVED_FOR_ISSUE)
    draft_with_pdf(team, sheet, code)
    return sheet


def run_side_effects(capture):
    """Dispatch outbox events and run their on-commit tasks (eager Celery)."""
    for _ in range(4):
        with capture(execute=True):
            dispatch_pending()


def test_issue_12_sheets_to_3_recipients(
    team, recipients, client_for, fake_storage, django_capture_on_commit_callbacks
):
    sheets = [approved(team, f"A-{100 + i}") for i in range(12)]
    body = {
        "sheet_ids": [str(s.pk) for s in sheets],
        "purpose": "GFC",
        "contact_ids": [str(c.pk) for c in recipients],
        "note": "Please review.",
    }
    preview = (
        client_for(team.dc)
        .post(f"/api/v1/projects/{team.project.pk}/transmittals/preview", body, format="json")
        .json()
    )
    assert preview["summary"] == "Issue 12 sheets to 3 recipients for Good for Construction (GFC)."
    assert preview["next_number"] == "2026-014-TR-0001"
    created = client_for(team.dc).post(
        f"/api/v1/projects/{team.project.pk}/transmittals", body, format="json"
    )
    assert created.status_code == 201, created.content
    data = created.json()
    assert data["number"] == "2026-014-TR-0001"
    assert len(data["items"]) == 12
    assert SheetRevision.objects.filter(state=RevisionState.ISSUED).count() == 12
    for sheet in sheets:
        sheet.refresh_from_db()
        assert sheet.state == S.ISSUED and sheet.current_revision.code == "P01"
    assert StatusTransition.objects.filter(action="issue").count() == 12
    run_side_effects(django_capture_on_commit_callbacks)
    to = sorted(m.to[0] for m in mail.outbox if "TR-0001" in m.subject)
    assert to == ["r0@client.example", "r1@client.example", "r2@client.example"]
    assert all(re.search(r"/t/[\w-]{40,}", m.body) for m in mail.outbox if "TR-0001" in m.subject)
    assert TransmittalRecipient.objects.filter(delivered_at__isnull=False).count() == 3
    assert ExternalLink.objects.count() == 3
    assert all(len(link.token_hash) == 64 for link in ExternalLink.objects.all())  # hash only


def test_reissue_supersedes_earlier_and_tells_previous_recipients(
    team, recipients, fake_storage, django_capture_on_commit_callbacks
):
    sheet = approved(team, "A-101", "C01")
    issue(
        team.dc,
        team.project,
        sheet_ids=[sheet.pk],
        purpose="GFC",
        contact_ids=[recipients[0].pk, recipients[1].pk],
    )
    run_side_effects(django_capture_on_commit_callbacks)
    mail.outbox.clear()
    from apps.workflow.services import transition

    transition(sheet, "next_revision", team.designer)
    draft = SheetRevision.objects.get(sheet=sheet, state="draft")
    from .workflow_fixtures import ready_upload_for

    upload = ready_upload_for(team.designer, "A-101.pdf", sha="c02")
    SheetRevision.objects.filter(pk=draft.pk).update(
        file=upload.file, original_name="A-101.pdf", naming_status="ok"
    )
    for actor, action in [
        (team.designer, "submit"),
        (team.checker, "start_check"),
        (team.checker, "approve"),
    ]:
        transition(sheet, action, actor)
    t2 = issue(
        team.dc, team.project, sheet_ids=[sheet.pk], purpose="GFC", contact_ids=[recipients[2].pk]
    )
    assert t2.number == "2026-014-TR-0002"
    c01 = SheetRevision.objects.get(sheet=sheet, code="C01")
    assert c01.state == RevisionState.SUPERSEDED and c01.superseded_at is not None
    assert SheetRevision.objects.filter(sheet=sheet, state=RevisionState.ISSUED).count() == 1
    run_side_effects(django_capture_on_commit_callbacks)
    notices = [m for m in mail.outbox if m.subject.startswith("New revision of A-101")]
    assert sorted(m.to[0] for m in notices) == ["r0@client.example", "r1@client.example"]
    assert "C01" in notices[0].body and "superseded" in notices[0].body


def test_blocked_sheets_and_pl_override(team, recipients, client_for):
    ok = approved(team, "A-101")
    not_approved = new_sheet(team, "A-102", state=S.IN_PROGRESS)
    draft_with_pdf(team, not_approved)
    no_pdf = new_sheet(team, "A-103", state=S.APPROVED_FOR_ISSUE)
    misnamed = new_sheet(team, "A-104", state=S.APPROVED_FOR_ISSUE)
    rev = draft_with_pdf(team, misnamed)
    SheetRevision.objects.filter(pk=rev.pk).update(
        naming_status="blocked", naming_message="Rename to A-104.pdf."
    )
    url = f"/api/v1/projects/{team.project.pk}/transmittals"
    body = {
        "sheet_ids": [str(s.pk) for s in (ok, not_approved, no_pdf, misnamed)],
        "purpose": "FA",
        "contact_ids": [str(recipients[0].pk)],
    }
    response = client_for(team.dc).post(url, body, format="json")
    assert response.status_code == 409
    reasons = {b["number"]: b["reason"] for b in response.json()["blocked"]}
    assert reasons == {
        "A-102": "In progress: only approved sheets can be issued.",
        "A-103": "Upload PDF first.",
        "A-104": "Rename to A-104.pdf.",
    }
    assert Transmittal.objects.count() == 0  # all or nothing
    override = {
        "sheet_ids": [str(not_approved.pk)],
        "purpose": "FA",
        "contact_ids": [str(recipients[0].pk)],
        "override_reason": "Client deadline",
    }
    assert client_for(team.dc).post(url, override, format="json").status_code == 409  # DC can't
    assert client_for(team.pl).post(url, override, format="json").status_code == 201


def test_purpose_and_recipients_required_and_designer_cannot_issue(team, recipients, client_for):
    sheet = approved(team, "A-101")
    url = f"/api/v1/projects/{team.project.pk}/transmittals"
    assert (
        client_for(team.dc)
        .post(
            url,
            {
                "sheet_ids": [str(sheet.pk)],
                "purpose": "IFC",
                "contact_ids": [str(recipients[0].pk)],
            },
            format="json",
        )
        .json()["code"]
        == "invalid_purpose"
    )
    assert (
        client_for(team.designer)
        .post(
            url,
            {
                "sheet_ids": [str(sheet.pk)],
                "purpose": "GFC",
                "contact_ids": [str(recipients[0].pk)],
            },
            format="json",
        )
        .status_code
        == 403
    )


def test_hand_delivery_is_recorded(
    team, recipients, fake_storage, django_capture_on_commit_callbacks
):
    paper = Contact.objects.create(organisation=team.org, full_name="Site office (paper)")
    sheet = approved(team, "A-101")
    t = issue(team.dc, team.project, sheet_ids=[sheet.pk], purpose="GFC", contact_ids=[paper.pk])
    r = t.recipients.get()
    assert r.delivery == "hand" and r.delivered_at is not None


class TestPublicPage:
    def _issue(self, team, recipients, capture):
        sheet = approved(team, "A-101")
        t = issue(
            team.dc,
            team.project,
            sheet_ids=[sheet.pk],
            purpose="GFC",
            contact_ids=[recipients[0].pk],
        )
        run_side_effects(capture)
        token = re.search(r"/t/([\w-]+)", mail.outbox[-1].body).group(1)
        return t, sheet, token

    def test_page_downloads_and_logs(
        self, team, recipients, client, fake_storage, django_capture_on_commit_callbacks
    ):
        t, sheet, token = self._issue(team, recipients, django_capture_on_commit_callbacks)
        page = client.get(f"/t/{token}/")
        assert page.status_code == 200
        assert page["Referrer-Policy"] == "no-referrer"
        assert "noindex" in page["X-Robots-Tag"]
        html = page.content.decode()
        assert t.number in html and "A-101" in html and "Download all (ZIP)" in html
        revision = sheet.revisions.get()
        download = client.get(f"/t/{token}/r/{revision.pk}")
        assert download.status_code == 302
        assert DownloadLog.objects.filter(what="revision").count() == 1
        assert TransmittalRecipient.objects.get().last_downloaded_at is not None

    def test_zip(self, team, recipients, client, fake_storage, django_capture_on_commit_callbacks):
        _, sheet, token = self._issue(team, recipients, django_capture_on_commit_callbacks)
        revision = sheet.revisions.get()
        fake_storage.objects[revision.file.storage_key] = make_pdf(1)
        response = client.get(f"/t/{token}/zip")
        import io
        import zipfile

        names = zipfile.ZipFile(io.BytesIO(b"".join(response.streaming_content))).namelist()
        assert "A-101 P01.pdf" in names

    def test_expired_and_invalid_links(
        self, team, recipients, client, fake_storage, django_capture_on_commit_callbacks
    ):
        _, _, token = self._issue(team, recipients, django_capture_on_commit_callbacks)
        ExternalLink.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        expired = client.get(f"/t/{token}/")
        assert expired.status_code == 410
        assert "dc@firm.example" in expired.content.decode()  # who to contact
        assert client.get("/t/not-a-real-token/").status_code == 404

    def test_resend_after_bounce(
        self, team, recipients, client_for, fake_storage, django_capture_on_commit_callbacks
    ):
        t, _, _token = self._issue(team, recipients, django_capture_on_commit_callbacks)
        r = t.recipients.get()
        TransmittalRecipient.objects.filter(pk=r.pk).update(bounced_at=timezone.now())
        with django_capture_on_commit_callbacks(execute=True):
            response = client_for(team.dc).post(f"/api/v1/recipients/{r.pk}/resend")
        assert response.status_code == 200
        r.refresh_from_db()
        assert r.bounced_at is None and r.delivered_at is not None
        assert ExternalLink.objects.get(token_hash__isnull=False, pk=r.link_id).revoked_at is None
        assert ExternalLink.objects.filter(revoked_at__isnull=False).count() == 1  # old link


@pytest.mark.requires_weasyprint
def test_cover_sheet_lists_every_sheet(
    team, recipients, fake_storage, django_capture_on_commit_callbacks
):
    import pypdfium2 as pdfium

    sheets = [approved(team, f"A-{100 + i}") for i in range(12)]
    t = issue(
        team.dc,
        team.project,
        sheet_ids=[s.pk for s in sheets],
        purpose="GFC",
        contact_ids=[c.pk for c in recipients],
    )
    run_side_effects(django_capture_on_commit_callbacks)
    t.refresh_from_db()
    pdf = pdfium.PdfDocument(fake_storage.objects[t.cover_file.storage_key])
    text = "".join(pdf[i].get_textpage().get_text_range() for i in range(len(pdf)))
    assert t.number in text and "Good for Construction (GFC)" in text
    assert all(s.number in text for s in sheets)


class TestStageRollUp:
    def test_first_sheet_started_activates_stage(self, team, django_capture_on_commit_callbacks):
        from apps.workflow.services import transition

        sheet = new_sheet(team)
        transition(sheet, "start", team.designer)
        run_side_effects(django_capture_on_commit_callbacks)
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.ACTIVE and team.stage.actual_start is not None

    def test_all_sheets_issued_with_required_purpose(
        self, team, recipients, fake_storage, django_capture_on_commit_callbacks
    ):
        a, b = approved(team, "A-101"), approved(team, "A-102")
        new_sheet(team, "A-103", state=S.CANCELLED)  # cancelled sheets don't count
        issue(team.dc, team.project, sheet_ids=[a.pk], purpose="FI", contact_ids=[recipients[0].pk])
        run_side_effects(django_capture_on_commit_callbacks)
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.ACTIVE  # FI is not a required purpose
        issue(
            team.dc, team.project, sheet_ids=[b.pk], purpose="GFC", contact_ids=[recipients[0].pk]
        )
        run_side_effects(django_capture_on_commit_callbacks)
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.ACTIVE  # A-101 was only issued "for information"

    def test_deliverables_issued_when_every_sheet_has_a_required_purpose(
        self, team, recipients, fake_storage, django_capture_on_commit_callbacks
    ):
        a, b = approved(team, "A-101"), approved(team, "A-102")
        issue(
            team.dc,
            team.project,
            sheet_ids=[a.pk, b.pk],
            purpose="GFC",
            contact_ids=[recipients[0].pk],
        )
        run_side_effects(django_capture_on_commit_callbacks)
        team.stage.refresh_from_db()
        assert team.stage.state == StageState.DELIVERABLES_ISSUED
        assert team.stage.actual_end is not None

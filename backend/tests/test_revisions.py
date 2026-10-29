"""F-06 revisions, A-04 naming check, F-35 rules and tester, F-46 bulk, F-48 watermark."""

import io
from datetime import UTC, datetime

import pikepdf
import pytest

from apps.audit.models import AuditEvent
from apps.outbox.services import dispatch_pending
from apps.register.models import NamingRule, RevisionState, Sheet, SheetRevision
from apps.register.models import SheetState as S
from apps.register.revisions import next_code
from apps.workflow.services import transition

from .conftest import make_pdf
from .workflow_fixtures import draft_with_pdf, new_sheet, ready_upload_for


def _upload(client, sheet, upload, **extra):
    return client.post(
        f"/api/v1/sheets/{sheet.pk}/revisions",
        {"upload_id": str(upload.pk), **extra},
        format="json",
    )


def test_upload_creates_draft_with_next_code_and_naming_check(team, client_for) -> None:
    sheet = new_sheet(team)
    designer = client_for(team.designer)
    good = _upload(designer, sheet, ready_upload_for(team.designer, "A-101 Ground Floor.pdf"))
    assert good.status_code == 201
    assert (good.json()["code"], good.json()["state"]) == ("P01", "draft")
    dispatch_pending()
    revision = SheetRevision.objects.get(pk=good.json()["id"])
    assert revision.naming_status == "ok"


def test_a04_blocks_misnamed_file_with_the_exact_rule(team, client_for) -> None:
    sheet = new_sheet(team)
    designer = client_for(team.designer)
    _upload(designer, sheet, ready_upload_for(team.designer, "A101.pdf"))
    dispatch_pending()
    revision = SheetRevision.objects.get(sheet=sheet)
    assert revision.naming_status == "blocked"
    assert revision.naming_message == (
        "File name A101.pdf doesn't contain the sheet number A-101. Rename to A-101.pdf."
    )
    NamingRule.objects.create(
        organisation=team.org,
        target="file_name",
        regex=r"^[A-Z]-\d{3}( .+)?\.pdf$",
        example="A-101.pdf",
    )
    _upload(designer, sheet, ready_upload_for(team.designer, "a-101.pdf"))
    dispatch_pending()
    revision.refresh_from_db()
    assert "doesn't match rule" in revision.naming_message


def test_same_file_twice_is_rejected_for_the_sheet(team, client_for) -> None:
    sheet = new_sheet(team)
    designer = client_for(team.designer)
    upload = ready_upload_for(team.designer, "A-101.pdf", sha="same")
    assert _upload(designer, sheet, upload).status_code == 201
    again = ready_upload_for(team.designer, "A-101.pdf", sha="same")
    response = _upload(designer, sheet, again)
    assert response.status_code == 409
    assert response.json()["code"] == "duplicate_file"


def test_draft_is_replaced_not_duplicated(team, client_for) -> None:
    sheet = new_sheet(team)
    designer = client_for(team.designer)
    _upload(designer, sheet, ready_upload_for(team.designer, "A-101.pdf", sha="v1"))
    _upload(designer, sheet, ready_upload_for(team.designer, "A-101.pdf", sha="v2"))
    assert SheetRevision.objects.filter(sheet=sheet).count() == 1
    assert AuditEvent.objects.filter(verb="revision.replaced").exists()


def test_codes_follow_the_scheme(team) -> None:
    sheet = new_sheet(team)
    assert next_code(sheet) == "P01"
    draft_with_pdf(team, sheet, "P01")
    assert next_code(sheet) == "P02"
    assert next_code(sheet, "C") == "C01"


def test_who_can_upload_drafts(team, client_for) -> None:
    sheet = new_sheet(team)
    other_designer_upload = ready_upload_for(team.senior, "A-101.pdf")
    assert _upload(client_for(team.senior), sheet, other_designer_upload).status_code == 403
    dc_upload = ready_upload_for(team.dc, "A-101.pdf", sha="dc")
    assert _upload(client_for(team.dc), sheet, dc_upload).status_code == 201


def test_next_revision_opens_a_new_draft_code(team) -> None:
    sheet = new_sheet(team, state=S.ISSUED)
    SheetRevision.objects.create(
        organisation=team.org, sheet=sheet, code="C01", seq=1, state=RevisionState.ISSUED
    )
    transition(sheet, "next_revision", team.designer)
    assert SheetRevision.objects.get(sheet=sheet, state="draft").code == "C02"


def test_download_link(team, client_for, fake_storage) -> None:
    sheet = new_sheet(team)
    revision = draft_with_pdf(team, sheet)
    body = client_for(team.dc).get(f"/api/v1/revisions/{revision.pk}/download").json()
    assert body["watermarked"] is False
    assert body["filename"] == "A-101 P01.pdf"
    assert (
        client_for(team.outsider).get(f"/api/v1/revisions/{revision.pk}/download").status_code
        == 404
    )


@pytest.mark.requires_weasyprint
def test_superseded_download_is_watermarked_and_original_untouched(team, client_for, fake_storage):
    sheet = new_sheet(team)
    revision = draft_with_pdf(team, sheet)
    original = make_pdf(1)
    fake_storage.objects[revision.file.storage_key] = original
    revision.state = RevisionState.SUPERSEDED
    revision.superseded_at = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)
    revision.save()
    body = client_for(team.dc).get(f"/api/v1/revisions/{revision.pk}/download").json()
    assert body["watermarked"] is True
    revision.refresh_from_db()
    stamped = fake_storage.objects[revision.watermarked_key]
    assert fake_storage.objects[revision.file.storage_key] == original
    with pikepdf.open(io.BytesIO(stamped)) as pdf:
        assert len(pdf.pages) == 1
    import pypdfium2 as pdfium

    text = pdfium.PdfDocument(stamped)[0].get_textpage().get_text_range()
    assert "SUPERSEDED 20-Oct-2026" in text
    # Cached: a second download reuses the stamped copy.
    count = len(fake_storage.objects)
    client_for(team.dc).get(f"/api/v1/revisions/{revision.pk}/download")
    assert len(fake_storage.objects) == count


class TestBulk:
    def test_shift_50_sheets_by_5_working_days_writes_50_audit_rows(self, team, client_for):
        from datetime import date

        sheets = [
            new_sheet(team, f"A-{i:03d}", planned_issue_date=date(2026, 10, 30))
            for i in range(100, 150)
        ]
        before = AuditEvent.objects.filter(verb="sheet.updated").count()
        result = (
            client_for(team.dl)
            .post(
                f"/api/v1/projects/{team.project.pk}/sheets/bulk",
                {"sheet_ids": [str(s.pk) for s in sheets], "op": "shift_dates", "value": 5},
                format="json",
            )
            .json()
        )
        assert len(result["updated"]) == 50
        assert AuditEvent.objects.filter(verb="sheet.updated").count() - before == 50
        assert set(Sheet.objects.values_list("planned_issue_date", flat=True)) == {
            date(2026, 11, 6)
        }

    def test_bulk_state_change_skips_and_reports(self, team, client_for):
        a, b = new_sheet(team, "A-101"), new_sheet(team, "A-102", state=S.IN_PROGRESS)
        result = (
            client_for(team.pl)
            .post(
                f"/api/v1/projects/{team.project.pk}/sheets/bulk",
                {"sheet_ids": [str(a.pk), str(b.pk)], "op": "transition", "value": "start"},
                format="json",
            )
            .json()
        )
        assert result["updated"] == [str(a.pk)]
        assert result["skipped"][0]["number"] == "A-102"
        assert "not possible" in result["skipped"][0]["reason"]

    def test_bulk_assign_needs_edit_rights(self, team, client_for):
        sheet = new_sheet(team)
        response = client_for(team.designer).post(
            f"/api/v1/projects/{team.project.pk}/sheets/bulk",
            {"sheet_ids": [str(sheet.pk)], "op": "assign_owner", "value": str(team.dl.pk)},
            format="json",
        )
        assert response.status_code == 403


def test_naming_rule_tester(team, admin_client) -> None:
    admin_client.post(
        "/api/v1/naming-rules",
        {"target": "file_name", "regex": r"^[A-Z]-\d{3}\.pdf$", "example": "A-101.pdf"},
    )
    bad = admin_client.post(
        "/api/v1/naming-rules/test", {"target": "file_name", "value": "A101.pdf"}
    ).json()
    assert bad["passes"] is False
    good = admin_client.post(
        "/api/v1/naming-rules/test", {"target": "file_name", "value": "A-101.pdf"}
    ).json()
    assert good == {"passes": True, "problems": []}
    invalid = admin_client.post(
        "/api/v1/naming-rules", {"target": "file_name", "regex": "([", "example": "x"}
    )
    assert invalid.status_code == 400


def test_pl_sets_project_rule_staff_cannot_set_org_rule(team, client_for) -> None:
    body = {
        "target": "sheet_number",
        "regex": r"^A-\d{3}$",
        "example": "A-101",
        "project": str(team.project.pk),
    }
    assert client_for(team.pl).post("/api/v1/naming-rules", body).status_code == 201
    body.pop("project")
    assert client_for(team.pl).post("/api/v1/naming-rules", body).status_code == 403


def test_review_queue_shows_waiting_sheets_with_working_days(team, client_for) -> None:
    sheet = new_sheet(team)
    transition(sheet, "start", team.designer)
    transition(sheet, "submit", team.designer)
    queue = client_for(team.checker).get("/api/v1/reviews").json()
    assert [(i["kind"], i["sheet"]["number"], i["working_days_waiting"]) for i in queue] == [
        ("ready_for_check", "A-101", 0)
    ]
    review_sheet = client_for(team.checker).post(
        f"/api/v1/sheets/{sheet.pk}/transitions", {"action": "start_check"}, format="json"
    )
    assert review_sheet.json()["state"] == "in_check"
    queue = client_for(team.checker).get("/api/v1/reviews").json()
    review_id = queue[0]["review_id"]
    approved = client_for(team.checker).post(
        f"/api/v1/reviews/{review_id}/approve", {}, format="json"
    )
    assert approved.json()["state"] == "approved_for_issue"


def test_sheet_detail_and_timeline(team, client_for) -> None:
    sheet = new_sheet(team)
    transition(sheet, "start", team.designer)
    detail = client_for(team.designer).get(f"/api/v1/sheets/{sheet.pk}/detail").json()
    assert [a["action"] for a in detail["allowed_actions"]] == ["submit"]
    assert detail["editable_fields"] == ["notes"]
    timeline = client_for(team.designer).get(f"/api/v1/sheets/{sheet.pk}/timeline").json()
    assert timeline[0]["text"] == "Planned → In progress"

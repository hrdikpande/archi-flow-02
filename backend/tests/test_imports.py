"""F-05 / I-01: Excel and CSV import with mapping, preview, fixes, all-or-nothing, undo."""

import io
from datetime import timedelta

import openpyxl
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.models import Discipline
from apps.projects.models import Package, Stage
from apps.register.models import ImportJob, Sheet, SheetState


@pytest.fixture
def dl(org, project, make_user, add_member, client_for):
    user = make_user(OrgRole.STAFF, email="dl@firm.example", name="Dev Lead")
    add_member(user, ProjectRole.DL)
    designer = make_user(OrgRole.STAFF, email="priya@firm.example", name="Priya Sharma")
    add_member(designer, ProjectRole.DESIGNER)
    Stage.objects.create(organisation=org, project=project, seq=4, name="Working drawings")
    Discipline.objects.create(
        organisation=org, code="A", name="Architecture", sheet_prefix_regex=r"^A-\d{3}$"
    )
    Discipline.objects.create(organisation=org, code="M", name="HVAC (Mechanical)")
    Package.objects.create(organisation=org, project=project, name="Arch GFC set")
    return client_for(user)


def _xlsx(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheets"
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


HEADER = ["Drawing No", "Title", "Disc", "Stage", "Package", "Designer", "Due Date"]


def _upload(client, project, content, name="register.xlsx"):
    return client.post(
        f"/api/v1/projects/{project.pk}/imports",
        {"file": SimpleUploadedFile(name, content)},
        format="multipart",
    )


def test_mapping_is_guessed_and_bad_rows_are_explained(dl, project):
    content = _xlsx(
        [
            HEADER,
            [
                "A-101",
                "Ground Floor Plan",
                "A",
                "Working drawings",
                "Arch GFC set",
                "priya@firm.example",
                "31-Oct-2026",
            ],
            ["A-101", "Duplicate", "A", "4", "", "", ""],
            ["X-1", "Unknown discipline", "Q", "4", "", "", ""],
            ["M-205", "OT Ductwork L2", "M", "4", "", "Priya Sharma", "31/02/2026"],
        ]
    )
    response = _upload(dl, project, content)
    assert response.status_code == 201, response.content
    job = response.json()
    assert set(job["mapping"]) >= {
        "number",
        "title",
        "discipline",
        "stage",
        "package",
        "owner",
        "planned_issue_date",
    }
    rows = {r["row"]: r for r in job["report"]["rows"]}
    assert any("more than once" in e for e in rows[2]["errors"])
    assert any("Unknown discipline" in e for e in rows[4]["errors"])
    assert any("Bad date" in e for e in rows[5]["errors"])
    assert job["report"]["counts"] == {"ok": 0, "error": 4, "skipped": 0, "total": 4}


def test_fix_and_skip_then_commit_all_or_nothing_then_undo(dl, project):
    content = _xlsx(
        [
            HEADER,
            [
                "A-101",
                "Ground Floor Plan",
                "A",
                "Working drawings",
                "Arch GFC set",
                "priya@firm.example",
                "31-Oct-2026",
            ],
            ["A-102", "First Floor Plan", "A", "4", "", "", "2026-11-05"],
            ["M-205", "OT Ductwork L2", "M", "4", "", "", "31/02/2026"],
            ["Q-1", "Junk row", "Q", "4", "", "", ""],
        ]
    )
    job = _upload(dl, project, content).json()
    url = f"/api/v1/imports/{job['id']}"
    blocked = dl.post(f"{url}/commit")
    assert blocked.status_code == 409 and blocked.json()["code"] == "import_has_errors"
    assert Sheet.objects.count() == 0  # nothing imported while any row has errors
    fixed = dl.patch(
        url,
        {"skip_rows": [3], "overrides": {"2": {"planned_issue_date": "28/02/2026"}}},
        format="json",
    ).json()
    assert fixed["report"]["counts"] == {"ok": 3, "error": 0, "skipped": 1, "total": 4}
    committed = dl.post(f"{url}/commit").json()
    assert committed["state"] == "committed"
    assert sorted(Sheet.objects.values_list("number", flat=True)) == ["A-101", "A-102", "M-205"]
    a101 = Sheet.objects.get(number="A-101")
    assert a101.owner.email == "priya@firm.example" and a101.package.name == "Arch GFC set"
    assert str(Sheet.objects.get(number="M-205").planned_issue_date) == "2026-02-28"
    assert dl.post(f"{url}/undo").json()["state"] == "undone"
    assert Sheet.objects.count() == 0


def test_undo_blocked_after_a_sheet_moves_or_after_24h(dl, project):
    content = _xlsx([HEADER, ["A-101", "GF Plan", "A", "4", "", "", ""]])
    job = _upload(dl, project, content).json()
    dl.post(f"/api/v1/imports/{job['id']}/commit")
    Sheet.objects.update(state=SheetState.IN_PROGRESS)
    moved = dl.post(f"/api/v1/imports/{job['id']}/undo")
    assert moved.status_code == 409 and moved.json()["code"] == "sheets_moved"
    Sheet.objects.update(state=SheetState.PLANNED)
    ImportJob.objects.update(undo_until=timezone.now() - timedelta(minutes=1))
    assert dl.post(f"/api/v1/imports/{job['id']}/undo").json()["code"] == "undo_expired"


def test_csv_with_semicolons_and_bom(dl, project):
    content = "﻿Sheet number;Title;Discipline;Stage\nA-101;GF Plan;Architecture;Working drawings\n"
    job = _upload(dl, project, content.encode("utf-8"), "register.csv").json()
    assert job["report"]["counts"]["ok"] == 1


def test_wrong_file_type_and_template(dl, project):
    bad = _upload(dl, project, b"hello", "register.pdf")
    assert bad.status_code == 400 and bad.json()["code"] == "unsupported"
    template = dl.get("/api/v1/imports/template")
    wb = openpyxl.load_workbook(io.BytesIO(template.content))
    assert {"Sheets", "Stages", "Team", "Revisions", "Project"} <= set(wb.sheetnames)

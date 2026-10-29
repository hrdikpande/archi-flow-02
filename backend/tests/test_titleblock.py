"""F-50: title-block reading. Vector PDFs use the text layer; scans use Tesseract."""

import io
import shutil

import pikepdf
import pytest
from PIL import Image, ImageDraw, ImageFont

from apps.register.titleblock import Reading, match, read_pdf

from .workflow_fixtures import new_sheet, ready_upload_for


def vector_pdf(corner: str, body: str = "") -> bytes:
    """An A3 landscape page with `corner` text in the bottom-right title block."""
    pdf = pikepdf.new()
    lines = [f"BT /F1 10 Tf 60 520 Td ({body}) Tj ET"] if body else []
    y = 90
    for line in corner.split("\n"):
        lines.append(f"BT /F1 11 Tf 900 {y} Td ({line}) Tj ET")
        y -= 16
    stream = "\n".join(lines).encode()
    font = pdf.make_indirect(
        pikepdf.Dictionary(
            Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1, BaseFont=pikepdf.Name.Helvetica
        )
    )
    page = pikepdf.Dictionary(
        Type=pikepdf.Name.Page,
        MediaBox=[0, 0, 1191, 842],
        Resources=pikepdf.Dictionary(Font=pikepdf.Dictionary(F1=font)),
        Contents=pdf.make_stream(stream),
    )
    pdf.pages.append(pikepdf.Page(page))
    buf = io.BytesIO()
    pdf.save(buf)
    return buf.getvalue()


def test_labelled_number_beats_references(team):
    a101 = new_sheet(team, "A-101", title="Ground Floor Plan")
    a501 = new_sheet(team, "A-501", title="Door Schedule")
    data = vector_pdf(
        "GROUND FLOOR PLAN\nSHEET NO. A-101\nREV P03", body="Refer to A-501 for door types"
    )
    reading = read_pdf(data)
    assert reading.method == "text"
    found = match(reading, [a101, a501])
    assert found["sheet"] == a101 and found["confidence"] >= 0.9
    assert found["revision"] == "P03"
    assert "GROUND FLOOR PLAN" in found["title"]


def test_ambiguous_and_unmatched(team):
    s1 = new_sheet(team, "A-101", title="Plan")
    s2 = new_sheet(team, "A-102", title="Section")
    both = match(read_pdf(vector_pdf("SEE A-101", body="and A-102 elsewhere")), [s1, s2])
    assert both["sheet"] == s1  # the corner beats a reference in the drawing body
    tie = match(Reading("text", "x", "A-101 A-102"), [s1, s2])
    assert tie["sheet"] is None  # two equal candidates: the person chooses
    none = match(Reading("text", "nothing here at all", "nothing"), [s1, s2])
    assert none["sheet"] is None and none["confidence"] == 0.0


def test_longer_number_wins(team):
    s1 = new_sheet(team, "A-101", title="Plan")
    s2 = new_sheet(team, "A-101A", title="Plan part A")
    found = match(read_pdf(vector_pdf("SHEET NO A-101A  REV C01 drawing")), [s1, s2])
    assert found["sheet"] == s2 and found["revision"] == "C01"


@pytest.mark.skipif(
    shutil.which("tesseract") is None, reason="Tesseract runs in the Docker test image"
)
def test_scanned_pdf_uses_ocr(team):
    sheet = new_sheet(team, "M-205", title="OT Ductwork L2")
    image = Image.new("RGB", (2339, 1654), "white")  # A3 at 200 dpi
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=56)
    draw.text((1500, 1350), "SHEET NO: M-205", fill="black", font=font)
    draw.text((1500, 1440), "REV P02", fill="black", font=font)
    buf = io.BytesIO()
    image.save(buf, "PDF", resolution=200)
    reading = read_pdf(buf.getvalue())
    assert reading.method == "ocr"
    found = match(reading, [sheet])
    assert found["sheet"] == sheet and found["revision"] == "P02"


def test_api_matches_uploads(team, client_for, fake_storage):
    a101 = new_sheet(team, "A-101", title="Ground Floor Plan")
    upload = ready_upload_for(team.designer, "scan-0001.pdf", sha="tb1")
    fake_storage.objects[upload.file.storage_key] = vector_pdf(
        "SHEET NO A-101  REV P01 ground floor plan"
    )
    url = f"/api/v1/projects/{team.project.pk}/title-blocks"
    res = client_for(team.designer).post(url, {"upload_ids": [str(upload.pk)]}, format="json")
    assert res.status_code == 200
    row = res.json()[0]
    assert row["sheet"] == str(a101.pk) and row["method"] == "text" and row["revision"] == "P01"
    assert (
        client_for(team.outsider)
        .post(url, {"upload_ids": [str(upload.pk)]}, format="json")
        .status_code
        == 404
    )

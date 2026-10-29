"""F-50 title-block reading for bulk PDF upload (P2).

Rule-based first: the title block sits in the bottom-right corner of a sheet, so the project's
sheet numbers are looked for there before the rest of the page; that keeps cross-references in
the drawing ("Refer to A-501") from winning. Text comes from the PDF's text layer (pypdfium2);
only a page with no usable text (a scan) is rendered and read by the Tesseract binary
(Apache-2.0). OCRmyPDF and Ghostscript are AGPL and are not used (CLAUDE.md).
Files that do not match go back to the manual-match list on the upload screen.
"""

import io
import re
import shutil
import subprocess
from dataclasses import dataclass
from typing import Any

import pypdfium2 as pdfium

from apps.files import storage

from .models import Sheet

MIN_TEXT = 8  # a scan has no text layer at all; any real text means a vector PDF
CORNER_X, CORNER_Y = 0.60, 0.35  # title block: right 40%, bottom 35% of the page
LABEL = re.compile(r"(sheet|drawing|dwg)\s*(no|number|#)?\.?\s*[:\-]?\s*$", re.I)
REVISION = re.compile(r"\brev(?:ision)?\.?\s*[:\-]?\s*([A-Z]{1,2}\d{1,3})\b", re.I)
TITLE_LABEL = re.compile(r"(?:drawing|sheet)?\s*title\s*[:\-]?\s*(.+)", re.I)


@dataclass
class Reading:
    method: str  # "text" | "ocr" | "none"
    text: str  # whole first page
    corner: str  # the title-block corner


TESSERACT = shutil.which("tesseract") or "tesseract"


def _ocr(image: Any) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    out = subprocess.run(  # noqa: S603
        [TESSERACT, "stdin", "stdout", "--psm", "11", "-l", "eng"],
        input=buf.getvalue(),
        capture_output=True,
        timeout=60,
        check=False,
    )
    return out.stdout.decode(errors="ignore")


def read_pdf(data: bytes) -> Reading:
    pdf = pdfium.PdfDocument(data)
    try:
        if len(pdf) == 0:
            return Reading("none", "", "")
        page = pdf[0]
        width, height = page.get_size()
        textpage = page.get_textpage()
        try:
            text = textpage.get_text_range()
            # PDF coordinates start bottom-left.
            corner = textpage.get_text_bounded(
                left=width * CORNER_X, bottom=0, right=width, top=height * CORNER_Y
            )
        finally:
            textpage.close()
        if len(text.strip()) >= MIN_TEXT:
            return Reading("text", text, corner)
        if shutil.which("tesseract") is None:
            return Reading("none", text, "")
        image = page.render(scale=200 / 72).to_pil().convert("L")
        w, h = image.size
        corner_img = image.crop((int(w * CORNER_X), int(h * (1 - CORNER_Y)), w, h))
        return Reading("ocr", _ocr(image), _ocr(corner_img))
    finally:
        pdf.close()


def _squash(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) > 2}


def _find(text: str, number: str, ocr: bool) -> re.Match[str] | bool | None:
    hit = re.search(rf"(?<![A-Za-z0-9]){re.escape(number)}(?![A-Za-z0-9])", text, re.I)
    if hit:
        return hit
    # OCR drops or changes separators ("M 205", "M—205"): compare without them.
    return (
        ocr
        and len(_squash(number)) >= 4
        and re.search(
            rf"(?<![a-z0-9]){re.escape(_squash(number))}(?![a-z0-9])",
            re.sub(r"[^a-z0-9\s]+", "", text.lower()).replace(" ", ""),
        )
        is not None
    )


def _title(corner: str, number: str) -> str:
    if m := TITLE_LABEL.search(corner):
        return m.group(1).strip()[:300]
    candidates = [
        line.strip()
        for line in corner.splitlines()
        if line.strip()
        and number.lower() not in line.lower()
        and not REVISION.search(line)
        and not LABEL.search(line.strip())
        and re.search(r"[A-Za-z]{3}", line)
    ]
    return max(candidates, key=len)[:300] if candidates else ""


def match(reading: Reading, sheets: list[Sheet]) -> dict[str, Any]:
    """Best sheet for this reading, or none. Confidence is 0–1."""
    none = {"sheet": None, "number": None, "confidence": 0.0, "title": "", "revision": ""}
    if not (reading.text.strip() or reading.corner.strip()):
        return none
    ocr = reading.method == "ocr"
    scored: list[tuple[float, int, Sheet]] = []
    for s in sheets:
        for n in [s.number, *s.aliases]:
            in_corner = _find(reading.corner, n, ocr)
            if in_corner:
                before = (
                    reading.corner[: in_corner.start()][-30:]
                    if isinstance(in_corner, re.Match)
                    else ""
                )
                score = 0.95 if LABEL.search(before) else 0.9
            elif _find(reading.text, n, ocr):
                score = 0.6  # only in the drawing body: could be a cross-reference
            else:
                continue
            scored.append((score, len(n), s))
            break
    if not scored:
        return none
    scored.sort(key=lambda x: (-x[0], -x[1]))  # corner first; then the longer number (A-101A)
    score, _, sheet = scored[0]
    if len(scored) > 1 and scored[1][:2] == scored[0][:2]:
        return none  # two equally good candidates: let the person choose
    source = reading.corner or reading.text
    title = _title(source, sheet.number)
    if (
        title
        and _words(sheet.title)
        and len(_words(sheet.title) & _words(title)) >= max(1, len(_words(sheet.title)) // 2)
    ):
        score = min(1.0, score + 0.04)
    rev = REVISION.search(source) or REVISION.search(reading.text)
    return {
        "sheet": sheet,
        "number": sheet.number,
        "confidence": round(score, 2),
        "title": title,
        "revision": rev.group(1).upper() if rev else "",
    }


def read_uploads(actor: Any, project: Any, upload_ids: list[Any]) -> list[dict[str, Any]]:
    """Read-only: the view checks project access; attaching each file to its sheet is the
    normal draft upload (UPLOAD_DRAFT)."""
    from apps.files.models import UploadKind
    from apps.files.services import ready_upload

    sheets = list(Sheet.objects.filter(project=project).exclude(state="cancelled"))
    rows = []
    for uid in upload_ids[:200]:
        upload = ready_upload(actor, uid, UploadKind.SHEET)
        if upload.file is None:
            continue
        reading = read_pdf(storage.get_bytes(upload.file.storage_key))
        found = match(reading, sheets)
        rows.append(
            {
                "upload_id": upload.pk,
                "file_name": upload.original_name,
                "method": reading.method,
                "sheet": found["sheet"].pk if found["sheet"] else None,
                "sheet_number": found["number"],
                "confidence": found["confidence"],
                "title": found["title"],
                "revision": found["revision"],
            }
        )
    return rows

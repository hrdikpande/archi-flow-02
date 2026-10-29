"""'SUPERSEDED' watermark on downloads of superseded revisions (F-48, 02 §9).

A WeasyPrint stamp page, sized to each page, is overlaid with pikepdf. The result is cached
under a derived key; the stored original is never changed.
"""

import io
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pikepdf

from apps.core.pdf import render_pdf
from apps.files import storage

from .models import SheetRevision

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def stamp_text(superseded_at: datetime, timezone: str) -> str:
    local = superseded_at.astimezone(ZoneInfo(timezone))
    return f"SUPERSEDED {local.day:02d}-{MONTHS[local.month - 1]}-{local.year}"


def _stamp_page(width: float, height: float, text: str) -> bytes:

    size = max(min(width, height) / 9, 18)
    html = f"""<!doctype html><html><head><style>
      @page {{ size: {width}pt {height}pt; margin: 0 }}
      html, body {{ margin: 0; width: {width}pt; height: {height}pt }}
      .s {{ position: absolute; left: 50%; top: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font: 700 {size:.0f}pt "DejaVu Sans", sans-serif; letter-spacing: 2pt;
            color: rgba(166, 27, 27, 0.32); border: {size / 6:.0f}pt solid rgba(166, 27, 27, 0.32);
            padding: {size / 4:.0f}pt {size / 1.5:.0f}pt; white-space: nowrap }}
    </style></head><body><div class="s">{text}</div></body></html>"""
    return render_pdf(html)


def stamp_pdf(content: bytes, text: str) -> bytes:
    stamps: dict[tuple[float, float], pikepdf.Pdf] = {}
    out = io.BytesIO()
    with pikepdf.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            box = [float(Decimal(str(v))) for v in page.mediabox]
            width, height = box[2] - box[0], box[3] - box[1]
            key = (round(width, 1), round(height, 1))
            if key not in stamps:
                stamps[key] = pikepdf.open(io.BytesIO(_stamp_page(width, height, text)))
            page.add_overlay(stamps[key].pages[0], pikepdf.Rectangle(*box))
        pdf.save(out)
    for stamp in stamps.values():
        stamp.close()
    return out.getvalue()


def watermarked_key(revision: SheetRevision) -> str:
    """Key of the stamped copy, generating and caching it on first use."""
    if revision.watermarked_key:
        return revision.watermarked_key
    if revision.file is None or revision.superseded_at is None:
        raise ValueError("Only superseded revisions with a file are watermarked.")
    text = stamp_text(revision.superseded_at, revision.sheet.project.organisation.timezone)
    stamped = stamp_pdf(storage.get_bytes(revision.file.storage_key), text)
    key = (
        f"watermarked/{revision.organisation_id}/{revision.file.sha256[:2]}/"
        f"{revision.file.sha256}-{revision.superseded_at:%Y%m%d}.pdf"
    )
    storage.put_bytes(key, stamped, "application/pdf")
    SheetRevision.objects.filter(pk=revision.pk).update(watermarked_key=key)
    revision.watermarked_key = key
    return key

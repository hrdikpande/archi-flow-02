"""F-31 review stamp on a submittal PDF: status, date, reviewer, round, in a box at the top
right of the first page (WeasyPrint stamp page overlaid with pikepdf, like F-48)."""

import io
from decimal import Decimal
from html import escape
from typing import Any
from zoneinfo import ZoneInfo

import pikepdf
from django.utils import timezone

from apps.core.pdf import render_pdf
from apps.register.watermark import MONTHS

COLOURS = {
    "approved": "#1D6B2F",
    "approved_as_noted": "#0B6B5E",
    "revise_resubmit": "#A33E0B",
    "rejected": "#A61B1B",
}


def _stamp_page(width: float, height: float, lines: list[str], colour: str) -> bytes:

    body = "".join(f"<div>{escape(line)}</div>" for line in lines[1:])
    html = f"""<!doctype html><html><head><style>
      @page {{ size: {width}pt {height}pt; margin: 0 }}
      html, body {{ margin: 0 }}
      .s {{ position: absolute; top: 18pt; right: 18pt; width: 210pt; padding: 8pt 10pt;
            border: 2.5pt solid {colour}; color: {colour}; background: rgba(255,255,255,0.88);
            font: 8.5pt/1.35 "DejaVu Sans", sans-serif }}
      .h {{ font-weight: 700; font-size: 12pt; letter-spacing: 0.5pt; margin-bottom: 3pt }}
      .f {{ margin-top: 4pt; font-size: 6.5pt; color: #333 }}
    </style></head><body><div class="s"><div class="h">{escape(lines[0])}</div>{body}
    <div class="f">Review is for general conformance with the design intent only and does not
    relieve the contractor of responsibility for dimensions, quantities and coordination.</div>
    </div></body></html>"""
    return render_pdf(html)


def stamp_submittal(content: bytes, sub: Any, reviewer: Any) -> bytes:
    org = sub.project.organisation
    local = (sub.reviewed_at or timezone.now()).astimezone(ZoneInfo(org.timezone))
    lines = [
        sub.get_status_display().upper(),
        f"{org.name}",
        f"{sub.number} · round {sub.round}",
        f"Reviewed by {reviewer.full_name or reviewer.email}",
        f"{local.day:02d}-{MONTHS[local.month - 1]}-{local.year}",
    ]
    out = io.BytesIO()
    with pikepdf.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        box = [float(Decimal(str(v))) for v in page.mediabox]
        width, height = box[2] - box[0], box[3] - box[1]
        with pikepdf.open(
            io.BytesIO(_stamp_page(width, height, lines, COLOURS.get(sub.status, "#333")))
        ) as stamp:
            page.add_overlay(stamp.pages[0], pikepdf.Rectangle(*box))
            pdf.save(out)
    return out.getvalue()

"""F-32: site visit report as PDF, photos embedded (already ≤ 2 MB JPEGs without EXIF)."""

import base64
from typing import Any
from zoneinfo import ZoneInfo

from django.template.loader import render_to_string

from apps.core.pdf import render_pdf
from apps.files import storage
from apps.register.watermark import MONTHS

from .models import SiteReport


def _date(d: Any) -> str:
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def render_report(report: SiteReport, actor: Any) -> bytes:

    org = report.project.organisation
    observations = []
    for o in report.observations.select_related("sheet").prefetch_related("photos"):
        photos = [
            "data:image/jpeg;base64," + base64.b64encode(storage.get_bytes(p.storage_key)).decode()
            for p in o.photos.all()
        ]
        observations.append({"o": o, "photos": photos})
    filed = report.filed_at.astimezone(ZoneInfo(org.timezone)) if report.filed_at else None
    html = render_to_string(
        "ca/site_report.html",
        {
            "firm": org.name,
            "report": report,
            "project": report.project,
            "visit": _date(report.visit_date),
            "filed": _date(filed) if filed else "",
            "by": actor.full_name or actor.email,
            "observations": observations,
        },
    )
    return render_pdf(html)

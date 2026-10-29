"""Transmittal cover sheet PDF (F-14, 02 §9): HTML template rendered by WeasyPrint."""

import hashlib
from typing import Any

from django.db import transaction
from django.template.loader import render_to_string

from apps.core.pdf import render_pdf
from apps.files import storage
from apps.files.models import FileObject

from .models import Transmittal
from .services import display_date, purpose_label


def cover_context(
    transmittal: Transmittal, preview: dict[str, Any] | None = None
) -> dict[str, Any]:
    org = transmittal.project.organisation
    if preview is not None:
        return {**preview, "firm": org.name, "preview": True}
    rows = [
        {
            "number": i.revision.sheet.number,
            "title": i.revision.sheet.title,
            "revision": i.revision.code,
            "purpose": i.revision.purpose,
        }
        for i in transmittal.items.select_related("revision__sheet").order_by(
            "revision__sheet__number"
        )
    ]
    recipients = [
        {
            "name": r.contact.full_name,
            "organisation": r.contact.external_org.name if r.contact.external_org else "",
            "delivery": r.get_delivery_display(),
        }
        for r in transmittal.recipients.select_related("contact__external_org")
    ]
    return {
        "firm": org.name,
        "number": transmittal.number,
        "project": f"{transmittal.project.code} {transmittal.project.name}",
        "date": display_date(transmittal.sent_at, org.timezone),
        "purpose": purpose_label(transmittal.organisation_id, transmittal.purpose),
        "suitability": transmittal.suitability,
        "sender": transmittal.sent_by.full_name or transmittal.sent_by.email,
        "note": transmittal.note,
        "rows": rows,
        "recipients": recipients,
        "supersedes": transmittal.supersedes.number if transmittal.supersedes else "",
        "preview": False,
    }


def render_cover(context: dict[str, Any]) -> bytes:

    return render_pdf(render_to_string("transmittals/cover.html", context))


@transaction.atomic
def ensure_cover(transmittal_id: Any) -> FileObject:
    transmittal = (
        Transmittal.objects.select_for_update(of=("self",))
        .select_related("project__organisation", "sent_by", "supersedes")
        .get(pk=transmittal_id)
    )
    if transmittal.cover_file_id:
        return transmittal.cover_file  # type: ignore[return-value]
    pdf = render_cover(cover_context(transmittal))
    sha = hashlib.sha256(pdf).hexdigest()
    key = f"covers/{transmittal.organisation_id}/{transmittal.number}-{sha[:12]}.pdf"
    storage.put_bytes(key, pdf, "application/pdf")
    file, _ = FileObject.objects.get_or_create(
        organisation_id=transmittal.organisation_id,
        sha256=sha,
        defaults={
            "storage_key": key,
            "size": len(pdf),
            "mime": "application/pdf",
            "original_name": f"{transmittal.number} cover.pdf",
            "page_count": None,
        },
    )
    transmittal.cover_file = file
    transmittal.save(update_fields=["cover_file", "updated_at"])
    return file

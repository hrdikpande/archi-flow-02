"""Revisions (F-06, F-08): codes, draft uploads, downloads. Issuing is in apps/transmittals."""

import re
from typing import Any

from django.db import transaction
from django.db.models import Max

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record_change, snapshot
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import OrgSettings
from apps.files.models import UploadKind
from apps.outbox.services import emit

from .models import NamingStatus, RevisionState, Sheet, SheetRevision, SheetState

DRAFT_STATES = {
    SheetState.PLANNED,
    SheetState.IN_PROGRESS,
    SheetState.READY_FOR_CHECK,
    SheetState.IN_CHECK,
    SheetState.CHANGES_REQUESTED,
    SheetState.APPROVED_FOR_ISSUE,
    SheetState.ON_HOLD,
}


def scheme(organisation_id: Any) -> dict[str, Any]:
    return OrgSettings.objects.get(organisation_id=organisation_id).revision_scheme


def next_code(sheet: Sheet, series: str | None = None) -> str:
    """Next code in a series, e.g. P02 → P03. The series is the latest revision's unless chosen
    (DD-020: the scheme does not say when P becomes C, so the uploader chooses)."""
    sch = scheme(sheet.organisation_id)
    prefixes = [s["prefix"] for s in sch["series"]]
    digits = int(sch.get("digits", 2))
    if series is None:
        latest = sheet.revisions.order_by("-seq").first()
        match = re.match(r"^([A-Z]+)", latest.code) if latest else None
        series = match.group(1) if match and match.group(1) in prefixes else prefixes[0]
    if series not in prefixes:
        raise DomainError(
            "invalid_series", f"Revision series must be one of {', '.join(prefixes)}."
        )
    numbers = [
        int(m.group(1))
        for code in sheet.revisions.values_list("code", flat=True)
        if (m := re.match(rf"^{re.escape(series)}(\d+)$", code))
    ]
    return f"{series}{(max(numbers) + 1) if numbers else 1:0{digits}d}"


def _next_seq(sheet: Sheet) -> int:
    return (sheet.revisions.aggregate(m=Max("seq"))["m"] or 0) + 1


def create_empty_draft(sheet: Sheet, actor: User | None) -> SheetRevision:
    """Effect of 'Start next revision' (02 §6): a new draft code, file uploaded later."""
    existing = sheet.revisions.filter(state=RevisionState.DRAFT).first()
    if existing:
        return existing
    revision = SheetRevision.objects.create(
        organisation_id=sheet.organisation_id,
        sheet=sheet,
        code=next_code(sheet),
        seq=_next_seq(sheet),
        stage=sheet.stage,
        uploaded_by=actor,
    )
    record_change(
        revision,
        actor=actor,
        verb="revision.created",
        before=None,
        after=snapshot(revision, ("code", "sheet", "state")),
    )
    return revision


@transaction.atomic
def upload_draft(
    actor: User,
    sheet: Sheet,
    *,
    upload_id: Any,
    change_summary: str = "",
    series: str | None = None,
) -> SheetRevision:
    """Attach a PDF as the sheet's draft revision (one draft at a time)."""
    from apps.files.services import ready_upload

    sheet = Sheet.objects.select_for_update(of=("self",)).select_related("project").get(pk=sheet.pk)
    require(actor, Action.UPLOAD_DRAFT, project=sheet.project, is_own=sheet.owner_id == actor.pk)
    if sheet.state not in DRAFT_STATES:
        raise ConflictError(
            "no_draft_allowed",
            f"{sheet.number} is {sheet.get_state_display().lower()}. "
            "Start the next revision before uploading a new PDF.",
        )
    upload = ready_upload(actor, upload_id, UploadKind.SHEET)
    if sheet.revisions.filter(file=upload.file).exists():
        raise ConflictError(
            "duplicate_file", f"This exact PDF is already a revision of {sheet.number}."
        )
    draft = sheet.revisions.select_for_update().filter(state=RevisionState.DRAFT).first()
    if draft is None:
        draft = SheetRevision(
            organisation_id=sheet.organisation_id,
            sheet=sheet,
            code=next_code(sheet, series),
            seq=_next_seq(sheet),
            stage=sheet.stage,
        )
        before = None
        verb = "revision.uploaded"
    else:
        before = snapshot(draft, ("file", "original_name", "change_summary"))
        verb = "revision.replaced"
    draft.file = upload.file
    draft.original_name = upload.original_name
    draft.change_summary = change_summary or draft.change_summary
    draft.uploaded_by = actor
    draft.naming_status = NamingStatus.PENDING
    draft.naming_message = ""
    draft.save()
    record_change(
        draft,
        actor=actor,
        verb=verb,
        before=before,
        after=snapshot(draft, ("file", "original_name", "change_summary", "code")),
    )
    emit(
        "revision.uploaded",
        {"revision_id": str(draft.pk), "sheet_id": str(sheet.pk)},
        organisation_id=sheet.organisation_id,
    )
    return draft


def check_naming(revision: SheetRevision) -> SheetRevision:
    """A-04: block issue when the file name breaks the sheet-number or file-name rule."""
    from .naming import file_name_problems

    problems = file_name_problems(
        revision.sheet.project, revision.sheet.number, revision.original_name
    )
    revision.naming_status = NamingStatus.BLOCKED if problems else NamingStatus.OK
    revision.naming_message = " ".join(problems)
    revision.save(update_fields=["naming_status", "naming_message", "updated_at"])
    if problems:
        emit(
            "revision.naming_blocked",
            {
                "revision_id": str(revision.pk),
                "user_id": str(revision.uploaded_by_id or ""),
                "message": revision.naming_message,
            },
            organisation_id=revision.organisation_id,
        )
    return revision


def download(revision: SheetRevision, user: User, origin: str | None = None) -> dict[str, Any]:
    """Signed link to the PDF. Superseded revisions are always watermarked (F-48)."""
    from apps.files.services import download_url

    if revision.file is None:
        raise DomainError("no_file", f"{revision.code} has no PDF yet.", status_code=404)
    filename = f"{revision.sheet.number} {revision.code}.pdf"
    if revision.state == RevisionState.SUPERSEDED:
        from apps.files import storage

        from .watermark import watermarked_key

        key = watermarked_key(revision)
        url = storage.presign_get(
            key, f"{revision.sheet.number} {revision.code} SUPERSEDED.pdf", origin=origin
        )
        return {"url": url, "filename": filename, "watermarked": True}
    return {
        "url": download_url(revision.file, filename, origin=origin),
        "filename": filename,
        "watermarked": False,
    }

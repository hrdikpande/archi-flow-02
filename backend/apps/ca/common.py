"""Helpers shared by the construction-administration logs (numbering, files, images)."""

import hashlib
import io
from typing import Any

from django.db.models import Max, Model

from apps.accounts.models import User
from apps.files import storage
from apps.files.models import FileObject, UploadKind
from apps.files.services import ready_upload
from apps.projects.models import Project

DOC_KINDS = (UploadKind.DOCUMENT, UploadKind.SHEET, UploadKind.IMAGE)
MAX_PHOTO_BYTES = 2 * 1024 * 1024  # F-32: photos compressed to ≤ 2 MB each


def next_number(project: Project, model: type[Model], prefix: str) -> tuple[int, str]:
    """Call inside a transaction that has locked the project row."""
    seq = (model.objects.filter(project=project).aggregate(m=Max("seq"))["m"] or 0) + 1  # type: ignore[attr-defined]
    return seq, f"{project.code}-{prefix}-{seq:04d}"


def lock_project(project: Project) -> Project:
    return Project.objects.select_for_update().get(pk=project.pk)


def upload_files(
    actor: User, upload_ids: list[Any], kinds: tuple[str, ...] = DOC_KINDS
) -> list[FileObject]:
    files = []
    for uid in upload_ids:
        f = ready_upload(actor, uid, kinds).file
        if f is not None:
            files.append(f)
    return files


def compress_image(data: bytes, max_bytes: int = MAX_PHOTO_BYTES) -> bytes:
    """JPEG of at most `max_bytes`, oriented upright, with all EXIF removed (phone photos carry
    GPS position and device details: none of it belongs in a client report)."""
    from PIL import Image, ImageOps

    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    longest = 2560
    quality = 85
    while True:
        work = image.copy()
        work.thumbnail((longest, longest))
        buf = io.BytesIO()
        work.save(buf, "JPEG", quality=quality, optimize=True)  # no exif= : metadata dropped
        if buf.tell() <= max_bytes or (longest <= 800 and quality <= 50):
            return buf.getvalue()
        if quality > 60:
            quality -= 10
        else:
            longest = int(longest * 0.8)


def store_photo(actor: User, upload_id: Any) -> FileObject:
    """A site photo, re-encoded (≤ 2 MB, no EXIF) and stored as its own file."""
    original = ready_upload(actor, upload_id, UploadKind.IMAGE).file
    if original is None:
        raise ValueError("upload has no file")
    data = compress_image(storage.get_bytes(original.storage_key))
    sha = hashlib.sha256(data).hexdigest()
    existing = FileObject.objects.filter(
        organisation_id=original.organisation_id, sha256=sha
    ).first()
    if existing:
        return existing
    key = f"photos/{original.organisation_id}/{sha[:2]}/{sha}.jpg"
    storage.put_bytes(key, data, "image/jpeg")
    name = original.original_name.rsplit(".", 1)[0] + ".jpg"
    return FileObject.objects.create(
        organisation_id=original.organisation_id,
        storage_key=key,
        sha256=sha,
        size=len(data),
        mime="image/jpeg",
        original_name=name,
    )


def store_generated(
    org_id: Any, data: bytes, name: str, folder: str, mime: str = "application/pdf"
) -> FileObject:
    sha = hashlib.sha256(data).hexdigest()
    existing = FileObject.objects.filter(organisation_id=org_id, sha256=sha).first()
    if existing:
        return existing
    ext = "pdf" if mime == "application/pdf" else name.rsplit(".", 1)[-1]
    key = f"{folder}/{org_id}/{sha[:2]}/{sha}.{ext}"
    storage.put_bytes(key, data, mime)
    return FileObject.objects.create(
        organisation_id=org_id,
        storage_key=key,
        sha256=sha,
        size=len(data),
        mime=mime,
        original_name=name[:255],
    )


def start_revisions(actor: User, sheets: list[Any]) -> tuple[list[str], list[str]]:
    """'Answering may start a new revision' (F-30, F-33): issued sheets go back to work with a
    new draft revision. Returns (started, skipped with reason)."""
    from apps.core.exceptions import DomainError
    from apps.register.models import SheetState
    from apps.workflow.services import transition

    started, skipped = [], []
    for sheet in sheets:
        if sheet.state != SheetState.ISSUED:
            skipped.append(f"{sheet.number} is {sheet.get_state_display().lower()}")
            continue
        try:
            transition(sheet, "next_revision", actor)
            started.append(sheet.number)
        except DomainError as exc:
            skipped.append(f"{sheet.number}: {exc.detail}")
    return started, skipped

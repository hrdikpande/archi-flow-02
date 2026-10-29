"""Presigned uploads and the verification pipeline (02 §9, N-03)."""

import hashlib
import logging
import re
import tempfile
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import pikepdf
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.core.exceptions import ConflictError, DomainError
from apps.outbox.services import emit

from . import storage
from .models import FileObject, Upload, UploadKind, UploadState
from .validators import is_pdf_header

logger = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
_UNSAFE_NAME = re.compile(r"[\x00-\x1f\x7f/\\]+")


@dataclass(frozen=True)
class PresignedUpload:
    upload: Upload
    url: str
    expires_at: Any


def clean_filename(name: str) -> str:
    name = _UNSAFE_NAME.sub("_", name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]).strip(" .")
    return name[:255] or "file.pdf"


KIND_TYPES: dict[str, dict[str, str]] = {
    UploadKind.SHEET: {"application/pdf": ".pdf"},
    UploadKind.DOCUMENT: {"application/pdf": ".pdf"},
    UploadKind.IMAGE: {"image/jpeg": ".jpg", "image/png": ".png"},
    # F-34: BCF (.bcfzip is a zip) and Navisworks XML clash reports. Browsers report .bcfzip as
    # application/octet-stream or application/zip; the extension decides, content is checked.
    UploadKind.DATA: {
        "application/zip": ".bcfzip",
        "application/x-zip-compressed": ".bcfzip",
        "application/octet-stream": ".bcfzip",
        "application/xml": ".xml",
        "text/xml": ".xml",
    },
}


@transaction.atomic
def presign_upload(
    actor: User,
    *,
    filename: str,
    size: int,
    content_type: str,
    kind: str = UploadKind.SHEET,
    origin: str | None = None,
) -> PresignedUpload:
    require(actor, Action.UPLOAD_FILES)
    name = clean_filename(filename)
    allowed = KIND_TYPES.get(kind)
    if allowed is None:
        raise DomainError("invalid_kind", "Unknown upload kind.")
    ext = allowed.get(content_type)
    if kind == UploadKind.DATA:
        lower = name.lower()
        ext = (
            ".xml"
            if lower.endswith(".xml")
            else ".bcfzip"
            if lower.endswith((".bcfzip", ".bcf"))
            else None
        )
        if ext is None or content_type not in allowed:
            raise DomainError("not_data", f"{name} is not a .bcfzip or an XML clash report.")
    elif ext is None or not name.lower().endswith(
        tuple({ext, ".jpeg"} if ext == ".jpg" else {ext})
    ):
        if kind == UploadKind.IMAGE:
            raise DomainError("not_image", f"{name} is not a JPEG or PNG image.")
        raise DomainError("not_pdf", f"{name} is not a PDF. Upload one PDF per sheet.")
    if size <= 0:
        raise DomainError("empty_file", f"{name} is empty.")
    if size > settings.UPLOAD_MAX_BYTES:
        limit_mb = settings.UPLOAD_MAX_BYTES // (1024 * 1024)
        raise DomainError("too_large", f"{name} is larger than {limit_mb} MB.")
    upload = Upload(
        organisation_id=actor.org_pk,
        created_by=actor,
        uploaded_by=actor,
        kind=kind,
        original_name=name,
        declared_size=size,
        content_type=content_type,
    )
    upload.staging_key = f"staging/{actor.org_pk}/{upload.id}{ext}"
    upload.save()
    expiry = settings.UPLOAD_URL_EXPIRY
    url = storage.presign_put(upload.staging_key, content_type, int(expiry.total_seconds()), origin)
    return PresignedUpload(upload=upload, url=url, expires_at=timezone.now() + expiry)


@transaction.atomic
def complete_upload(actor: User, upload: Upload) -> Upload:
    upload = Upload.objects.select_for_update().get(pk=upload.pk)
    if upload.uploaded_by_id != actor.pk:
        raise DomainError("not_found", "Upload not found.", status_code=404)
    if upload.state != UploadState.PENDING:
        return upload  # repeat call: idempotent
    if storage.head(upload.staging_key) is None:
        raise ConflictError("not_uploaded", "The file has not reached storage yet. Try again.")
    upload.state = UploadState.UPLOADED
    upload.save(update_fields=["state", "updated_at"])
    emit("file.uploaded", {"upload_id": str(upload.pk)}, organisation_id=upload.organisation_id)
    return upload


class RejectedError(Exception):
    pass


def _sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _inspect(path: str, size: int, kind: str = UploadKind.SHEET) -> tuple[str, int | None, str]:
    """Returns (sha256, page_count, mime) or raises RejectedError with a user-facing reason."""
    if size > settings.UPLOAD_MAX_BYTES:
        raise RejectedError("The file is larger than the upload limit.")
    if kind == UploadKind.IMAGE:
        return _sha256(path), None, _inspect_image(path)
    if kind == UploadKind.DATA:
        return _sha256(path), None, _inspect_data(path)
    with open(path, "rb") as fh:
        if not is_pdf_header(fh.read(1024)):
            raise RejectedError("The file is not a PDF (it does not start with %PDF).")
    try:
        with pikepdf.open(path) as pdf:
            pages = len(pdf.pages)
    except pikepdf.PasswordError as exc:
        raise RejectedError("The PDF is password-protected. Upload an unprotected copy.") from exc
    except pikepdf.PdfError as exc:
        raise RejectedError("The PDF is damaged and cannot be opened.") from exc
    if kind == UploadKind.SHEET and pages != 1:
        raise RejectedError(f"The PDF has {pages} pages. Upload one PDF per sheet (one page each).")
    return _sha256(path), pages, PDF_MIME


def _inspect_image(path: str) -> str:
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(path) as img:
            img.verify()
            fmt = img.format
    except (UnidentifiedImageError, OSError) as exc:
        raise RejectedError("The image is damaged or not a JPEG/PNG.") from exc
    if fmt not in ("JPEG", "PNG"):
        raise RejectedError("Only JPEG and PNG images are accepted.")
    return "image/jpeg" if fmt == "JPEG" else "image/png"


def _inspect_data(path: str) -> str:
    with open(path, "rb") as fh:
        head = fh.read(512)
    if head.startswith(b"PK\x03\x04"):
        import zipfile

        if not zipfile.is_zipfile(path):
            raise RejectedError("The BCF file is damaged.")
        return "application/zip"
    if head.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"<"):
        return "application/xml"
    raise RejectedError("The file is neither a BCF zip nor an XML clash report.")


EXTENSIONS = {
    PDF_MIME: ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/zip": ".bcfzip",
    "application/xml": ".xml",
}


def _final_key(organisation_id: Any, sha256: str, mime: str = PDF_MIME) -> str:
    return f"files/{organisation_id}/{sha256[:2]}/{sha256}{EXTENSIONS[mime]}"


def process_upload(upload_id: str) -> Upload:
    """Verify an uploaded file and promote it to a FileObject. Safe to run more than once."""
    upload = Upload.objects.get(pk=upload_id)
    if upload.state != UploadState.UPLOADED:
        return upload
    reason = ""
    sha = ""
    pages: int | None = None
    size = 0
    mime = PDF_MIME
    with tempfile.NamedTemporaryFile() as tmp:
        storage.download_to(upload.staging_key, tmp)
        tmp.flush()
        size = tmp.tell()
        try:
            sha, pages, mime = _inspect(tmp.name, size, upload.kind)
        except RejectedError as exc:
            reason = str(exc)

    with transaction.atomic():
        upload = Upload.objects.select_for_update().get(pk=upload_id)
        if upload.state != UploadState.UPLOADED:
            return upload
        if reason:
            upload.state = UploadState.REJECTED
            upload.reason = reason
        else:
            existing = FileObject.objects.filter(
                organisation_id=upload.organisation_id, sha256=sha
            ).first()
            if existing is None:
                key = _final_key(upload.organisation_id, sha, mime)
                storage.copy(upload.staging_key, key, mime)
                thumb_key = _thumbnail(upload, key, sha) if mime == PDF_MIME else ""
                existing, created = FileObject.objects.get_or_create(
                    organisation_id=upload.organisation_id,
                    sha256=sha,
                    defaults={
                        "storage_key": key,
                        "size": size,
                        "mime": mime,
                        "original_name": upload.original_name,
                        "page_count": pages,
                        "thumbnail_key": thumb_key,
                        "created_by_id": upload.uploaded_by_id,
                    },
                )
                upload.is_duplicate = not created
            else:
                upload.is_duplicate = True
            upload.file = existing
            upload.state = UploadState.READY
        upload.save(update_fields=["state", "reason", "file", "is_duplicate", "updated_at"])
        staging_key = upload.staging_key
        transaction.on_commit(lambda: _safe_delete(staging_key))
    return upload


def _thumbnail(upload: Upload, key: str, sha: str) -> str:
    """First page as a small PNG for lists; failure never blocks the upload."""
    import io

    import pypdfium2 as pdfium

    try:
        with tempfile.NamedTemporaryFile() as tmp:
            storage.download_to(key, tmp)
            tmp.flush()
            pdf = pdfium.PdfDocument(tmp.name)
            page = pdf[0]
            scale = 320 / max(page.get_width(), page.get_height())
            image = page.render(scale=scale).to_pil()
            buf = io.BytesIO()
            image.save(buf, format="PNG", optimize=True)
            pdf.close()
        thumb = f"thumbs/{upload.organisation_id}/{sha[:2]}/{sha}.png"
        storage.put_bytes(thumb, buf.getvalue(), "image/png")
        return thumb
    except Exception:
        logger.warning("thumbnail failed", extra={"upload_id": str(upload.pk)})
        return ""


def _safe_delete(key: str) -> None:
    try:
        storage.delete(key)
    except Exception:
        logger.warning("could not delete staging object", extra={"key": key})


def purge_stale_uploads(older_than: timedelta = timedelta(days=1)) -> int:
    """Uploads never completed within a day are rejected and their staging object removed."""
    cutoff = timezone.now() - older_than
    stale = list(Upload.objects.filter(state=UploadState.PENDING, created_at__lt=cutoff))
    for upload in stale:
        _safe_delete(upload.staging_key)
    return Upload.objects.filter(pk__in=[u.pk for u in stale]).update(
        state=UploadState.REJECTED, reason="Upload was not completed.", updated_at=timezone.now()
    )


def ready_upload(actor: User, upload_id: Any, kind: str | tuple[str, ...]) -> Upload:
    """An upload the actor finished, verified, of the expected kind; else a clear error."""
    upload = (
        Upload.objects.select_related("file")
        .filter(pk=upload_id, organisation_id=actor.org_pk, uploaded_by=actor)
        .first()
    )
    if upload is None:
        raise DomainError("upload_not_found", "Upload not found.", status_code=404)
    kinds = (kind,) if isinstance(kind, str) else kind
    if upload.kind not in kinds:
        expected = " or ".join(str(UploadKind(k).label) for k in kinds)
        raise DomainError("wrong_upload_kind", f"Expected a {expected} upload.")
    if upload.state == UploadState.REJECTED:
        raise DomainError("upload_rejected", upload.reason)
    if upload.state != UploadState.READY or upload.file is None:
        raise ConflictError(
            "upload_not_ready", "The file is still being checked. Try again shortly."
        )
    return upload


def download_url(file: FileObject, filename: str | None = None, origin: str | None = None) -> str:
    return storage.presign_get(file.storage_key, filename or file.original_name, origin=origin)

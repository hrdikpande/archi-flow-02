"""S-15 external transmittal page (/t/<token>): public, token link, no login (02 §9)."""

import zipfile
from collections.abc import Callable, Iterator
from typing import Any

from django.core.cache import cache
from django.http import (
    Http404,
    HttpRequest,
    HttpResponse,
    HttpResponseRedirect,
    StreamingHttpResponse,
)
from django.http.response import HttpResponseBase
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.core.context import get_context
from apps.files import storage
from apps.register.models import RevisionState, SheetRevision

from .models import DownloadLog, ExternalLink, TransmittalRecipient
from .services import display_date, link_revisions, purpose_label, resolve_link

RATE_LIMIT = 60  # requests per minute per IP


def _secure(response: HttpResponseBase) -> HttpResponseBase:
    """Tokens must not leak through Referer, search engines or caches (docs/06 R-23)."""
    response["Referrer-Policy"] = "no-referrer"
    response["X-Robots-Tag"] = "noindex, nofollow"
    response["Cache-Control"] = "no-store"
    return response


def _limited(request: HttpRequest) -> bool:
    key = f"t-rate:{get_context().ip}"
    cache.add(key, 0, 60)
    try:
        count = cache.incr(key)
    except ValueError:
        count = 1
    return count > RATE_LIMIT


def public_view(
    fn: Callable[..., HttpResponseBase], methods: tuple[str, ...] = ("GET",)
) -> Callable[..., HttpResponseBase]:
    def wrapper(request: HttpRequest, token: str, *args: Any, **kwargs: Any) -> HttpResponseBase:
        if _limited(request):
            return _secure(HttpResponse("Too many requests. Try again in a minute.", status=429))
        link = resolve_link(token)
        if link is None:
            return _secure(render(request, "transmittals/public_invalid.html", status=404))
        if link.expires_at <= timezone.now():
            sender = link.transmittal.sent_by
            return _secure(
                render(
                    request,
                    "transmittals/public_expired.html",
                    {
                        "link": link,
                        "firm": link.transmittal.project.organisation.name,
                        "sender": sender.full_name or sender.email,
                        "sender_email": sender.email,
                    },
                    status=410,
                )
            )
        ExternalLink.objects.filter(pk=link.pk).update(last_used_at=timezone.now())
        return _secure(fn(request, link, *args, **kwargs))

    wrapper.__name__ = fn.__name__
    return require_http_methods(list(methods))(wrapper)


def _log(
    request: HttpRequest, link: ExternalLink, what: str, revision: SheetRevision | None = None
) -> None:
    DownloadLog.objects.create(
        link=link,
        revision=revision,
        what=what,
        ip=get_context().ip,
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
    )
    TransmittalRecipient.objects.filter(link=link).update(last_downloaded_at=timezone.now())


def _key_for(revision: SheetRevision) -> str:
    if revision.state == RevisionState.SUPERSEDED:
        from apps.register.watermark import watermarked_key

        return watermarked_key(revision)  # F-48: every superseded download is stamped
    if revision.file is None:
        raise Http404
    return revision.file.storage_key


def _filename(revision: SheetRevision) -> str:
    suffix = " SUPERSEDED" if revision.state == RevisionState.SUPERSEDED else ""
    return f"{revision.sheet.number} {revision.code}{suffix}.pdf"


@public_view
def transmittal_page(request: HttpRequest, link: ExternalLink) -> HttpResponse:
    t = link.transmittal
    org = t.project.organisation
    revisions = link_revisions(link)
    rows = []
    for r in revisions:
        newer = (
            r.sheet.revisions.filter(state=RevisionState.ISSUED).exclude(pk=r.pk).first()
            if r.state == RevisionState.SUPERSEDED
            else None
        )
        rows.append({"revision": r, "newer": newer})
    return render(
        request,
        "transmittals/public.html",
        {
            "link": link,
            "transmittal": t,
            "firm": org.name,
            "rows": rows,
            "purpose": purpose_label(t.organisation_id, t.purpose),
            "date": display_date(t.sent_at, org.timezone),
            "expires": display_date(link.expires_at, org.timezone),
            "sender": t.sent_by.full_name or t.sent_by.email,
            "is_notice": link.kind == "notice",
            "has_cover": bool(t.cover_file_id),
            "token": request.resolver_match.kwargs["token"] if request.resolver_match else "",
            "recipient": getattr(link, "recipient", None),
            "acknowledged": (
                display_date(link.recipient.acknowledged_at, org.timezone)
                if getattr(link, "recipient", None) and link.recipient.acknowledged_at
                else ""
            ),
            "ask_ack": request.GET.get("ack") == "1",
        },
    )


def acknowledge(request: HttpRequest, link: ExternalLink) -> HttpResponse:
    """F-15: the recipient confirms receipt. A POST from the page (never a GET, so mail
    scanners that prefetch links cannot acknowledge on someone's behalf)."""
    recipient = getattr(link, "recipient", None)
    if recipient is None:
        raise Http404
    if recipient.acknowledged_at is None:
        TransmittalRecipient.objects.filter(pk=recipient.pk, acknowledged_at__isnull=True).update(
            acknowledged_at=timezone.now()
        )
        _log(request, link, "acknowledge")
    return HttpResponseRedirect(".")


# The secret token in the URL is the credential, so CSRF adds nothing here; and with
# Referrer-Policy: no-referrer browsers send "Origin: null", which Django's check rejects.
acknowledge_receipt = csrf_exempt(public_view(acknowledge, methods=("POST",)))


@public_view
def download_revision(request: HttpRequest, link: ExternalLink, revision_id: str) -> HttpResponse:
    revision = next((r for r in link_revisions(link) if str(r.pk) == str(revision_id)), None)
    if revision is None or revision.file is None:
        raise Http404
    _log(request, link, "revision", revision)
    url = storage.presign_get(
        _key_for(revision),
        _filename(revision),
        expires_in=120,
        origin=request.build_absolute_uri("/").rstrip("/"),
    )
    return HttpResponseRedirect(url)


@public_view
def download_cover(request: HttpRequest, link: ExternalLink) -> HttpResponse:
    cover = link.transmittal.cover_file
    if cover is None:
        raise Http404
    _log(request, link, "cover")
    return HttpResponseRedirect(
        storage.presign_get(
            cover.storage_key,
            f"{link.transmittal.number} cover.pdf",
            expires_in=120,
            origin=request.build_absolute_uri("/").rstrip("/"),
        )
    )


class _Sink:
    """Unseekable writer: zipfile then streams with data descriptors (no temp file)."""

    def __init__(self) -> None:
        self.chunks: list[bytes] = []

    def write(self, data: bytes) -> int:
        self.chunks.append(bytes(data))
        return len(data)

    def flush(self) -> None:
        return None

    def drain(self) -> Iterator[bytes]:
        chunks, self.chunks = self.chunks, []
        yield from chunks


@public_view
def download_zip(request: HttpRequest, link: ExternalLink) -> HttpResponseBase:
    """'Download all (ZIP)', streamed so memory stays at one drawing at a time."""
    entries = [(_filename(r), _key_for(r)) for r in link_revisions(link) if r.file_id]
    cover = link.transmittal.cover_file
    if cover is not None and link.kind != "notice":
        entries.append((f"{link.transmittal.number} cover.pdf", cover.storage_key))

    def stream() -> Iterator[bytes]:
        sink = _Sink()
        with zipfile.ZipFile(sink, "w", compression=zipfile.ZIP_STORED) as archive:  # type: ignore[call-overload]
            for name, key in entries:
                archive.writestr(name, storage.get_bytes(key))
                yield from sink.drain()
        yield from sink.drain()

    _log(request, link, "zip")
    response = StreamingHttpResponse(stream(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{link.transmittal.number}.zip"'
    return response


__all__ = ["download_cover", "download_revision", "download_zip", "transmittal_page"]

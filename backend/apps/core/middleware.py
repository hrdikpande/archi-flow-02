import re
import uuid
from collections.abc import Callable
from dataclasses import replace

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from .context import RequestContext, get_context, reset_context, set_context

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9\-]{8,64}$")


CLIENT_IP_META = "HTTP_X_DRAWINGOPS_CLIENT_IP"


def _client_ip(request: HttpRequest) -> str | None:
    """The client as seen by our own proxies: each trusted proxy appends one X-Forwarded-For
    entry, so with N of them the client is the Nth from the end. Entries before that are
    whatever the client sent and are never trusted (they could be forged)."""
    forwarded = [
        p.strip() for p in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",") if p.strip()
    ]
    hops = max(1, settings.TRUSTED_PROXY_COUNT)
    if len(forwarded) >= hops:
        return forwarded[-hops]
    return request.META.get("REMOTE_ADDR")


class SecurityHeadersMiddleware:
    """CSP and Permissions-Policy on every response that has none of its own (Railway serves
    Django directly; Caddy and Vercel also set them at the edge)."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if settings.CONTENT_SECURITY_POLICY and "Content-Security-Policy" not in response:
            response["Content-Security-Policy"] = settings.CONTENT_SECURITY_POLICY
        if "Permissions-Policy" not in response:
            response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class RequestContextMiddleware:
    """Assigns a request ID (or accepts a well-formed one from Caddy) and the client IP."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.META.get("HTTP_X_REQUEST_ID", "")
        request_id = incoming if _REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        ip = _client_ip(request)
        # Always overwritten, so a client cannot supply it; allauth reads it (DD-038).
        request.META[CLIENT_IP_META] = ip or ""
        request.__dict__.pop("headers", None)  # HttpRequest.headers is cached from META
        token = set_context(RequestContext(request_id=request_id, ip=ip))
        try:
            response = self.get_response(request)
        finally:
            reset_context(token)
        response["X-Request-ID"] = request_id
        return response


class RequestUserContextMiddleware:
    """Adds the authenticated user's ID to the context once auth middleware has run."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            token = set_context(replace(get_context(), user_id=str(user.pk)))
            try:
                return self.get_response(request)
            finally:
                reset_context(token)
        return self.get_response(request)

"""Inbound email webhook (I-09): the mail provider POSTs the raw MIME message.
Authenticated by a shared secret header; never by session, so no CSRF."""

import base64
import hmac
import json

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import inbound

MAX_BYTES = 60 * 1024 * 1024


@csrf_exempt
@require_POST
def inbound_email(request: HttpRequest) -> JsonResponse:
    secret = settings.INBOUND_EMAIL_SECRET
    given = request.headers.get("X-Inbound-Secret", "")
    if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if len(request.body) > MAX_BYTES:
        return JsonResponse({"detail": "Message too large"}, status=413)
    raw = request.body
    if request.content_type == "application/json":
        try:
            raw = base64.b64decode(json.loads(request.body)["raw"])
        except (KeyError, ValueError, TypeError):
            return JsonResponse({"detail": 'Send {"raw": base64 MIME}'}, status=400)
    email = inbound.ingest(raw)
    if email is None:
        return JsonResponse({"status": "ignored"}, status=202)
    return JsonResponse({"status": email.state, "id": str(email.pk)}, status=201)

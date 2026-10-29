"""Vercel Cron: GET /integrations/cron/tick with `Authorization: Bearer $CRON_SECRET` (Vercel
sends it automatically when CRON_SECRET is set on the project). Off when the secret is unset."""

import hmac

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .scheduler import tick


@csrf_exempt
@require_http_methods(["GET", "POST"])
def cron_tick(request: HttpRequest) -> JsonResponse:
    secret = settings.CRON_SECRET
    given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    return JsonResponse({"queued": tick()})

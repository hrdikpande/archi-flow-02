"""Liveness and readiness. Not authenticated; reveals no data beyond component status."""

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.utils import timezone

from .models import Heartbeat


def livez(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


def healthz(request: HttpRequest) -> JsonResponse:
    checks: dict[str, str] = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
    try:
        cache.set("healthz", "1", 10)
        checks["cache"] = "ok" if cache.get("healthz") == "1" else "error"
    except Exception:
        checks["cache"] = "error"
    beat = Heartbeat.objects.filter(name="beat").first() if checks["database"] == "ok" else None
    if beat is None:
        checks["scheduler"] = "unknown"
    elif timezone.now() - beat.last_seen > settings.BEAT_STALE_AFTER:
        checks["scheduler"] = "stale"
    else:
        checks["scheduler"] = "ok"
    if checks["database"] == "ok":
        from apps.automation.engine import missing_daily_runs
        from apps.core.models import Organisation

        missed = [k for org in Organisation.objects.all() for k in missing_daily_runs(org)]
        checks["sweeps"] = f"missing {', '.join(sorted(set(missed)))}" if missed else "ok"
    healthy = checks["database"] == "ok" and checks["cache"] == "ok"
    body = {"status": "ok" if healthy else "error", "checks": checks}
    if beat is not None:
        body["scheduler_last_seen"] = beat.last_seen.isoformat()
    return JsonResponse(body, status=200 if healthy else 503)

"""Idempotency-Key for mutating integration calls (02 §12: required for plugins).

A retried request with the same key (per API token or user) gets the first response back
instead of being applied twice. Responses are kept for 24 hours."""

import hashlib
import json
from collections.abc import Callable
from functools import wraps
from typing import Any

from django.core.cache import cache
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import ApiToken

TTL = 24 * 3600


def _cache_key(request: Request, key: str) -> str:
    who = (
        f"token:{request.auth.pk}"
        if isinstance(request.auth, ApiToken)
        else f"user:{request.user.pk}"
    )
    return "idem:" + hashlib.sha256(f"{who}:{request.path}:{key}".encode()).hexdigest()


def idempotent(required_for_tokens: bool = True) -> Callable[..., Any]:
    def decorator(view: Callable[..., Response]) -> Callable[..., Response]:
        @wraps(view)
        def wrapper(self: Any, request: Request, *args: Any, **kwargs: Any) -> Response:
            key = (request.headers.get("Idempotency-Key") or "").strip()[:200]
            if not key:
                if required_for_tokens and isinstance(request.auth, ApiToken):
                    return Response(
                        {
                            "code": "idempotency_key_required",
                            "detail": "Send an Idempotency-Key header with this request.",
                        },
                        status=400,
                    )
                return view(self, request, *args, **kwargs)
            ck = _cache_key(request, key)
            fingerprint = hashlib.sha256(request.body or b"").hexdigest()
            if (stored := cache.get(ck)) is not None:
                if stored["fingerprint"] != fingerprint:
                    return Response(
                        {
                            "code": "idempotency_key_reused",
                            "detail": "This Idempotency-Key was used with a different request.",
                        },
                        status=422,
                    )
                response = Response(json.loads(stored["body"]), status=stored["status"])
                response["Idempotent-Replayed"] = "true"
                return response
            response = view(self, request, *args, **kwargs)
            if response.status_code < 500:
                cache.set(
                    ck,
                    {
                        "fingerprint": fingerprint,
                        "status": response.status_code,
                        "body": json.dumps(response.data, default=str),
                    },
                    TTL,
                )
            return response

        return wrapper

    return decorator

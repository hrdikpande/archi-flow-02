"""Bearer API tokens for CAD plugins and integrations (02 §11)."""

import hmac
from dataclasses import replace
from datetime import timedelta
from typing import Any

from django.utils import timezone
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import authentication, exceptions
from rest_framework.request import Request

from apps.core.context import get_context, set_context

from .models import TOKEN_PREFIX, ApiToken, hash_token_secret


class ApiTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request: Request) -> tuple[Any, ApiToken] | None:
        header = authentication.get_authorization_header(request).decode(errors="ignore")
        if not header.startswith(f"{self.keyword} "):
            return None
        raw = header[len(self.keyword) + 1 :].strip()
        parts = raw.split("_", 2)
        if len(parts) != 3 or parts[0] != TOKEN_PREFIX:
            raise exceptions.AuthenticationFailed("Malformed API token.")
        _, key_id, secret = parts
        token = ApiToken.objects.select_related("user").filter(key_id=key_id).first()
        if token is None or not hmac.compare_digest(token.secret_hash, hash_token_secret(secret)):
            raise exceptions.AuthenticationFailed("Invalid API token.")
        if not token.is_usable:
            raise exceptions.AuthenticationFailed("API token expired or revoked.")
        if not token.user.is_active:
            raise exceptions.AuthenticationFailed("Token owner is inactive.")
        now = timezone.now()
        if token.last_used_at is None or now - token.last_used_at > timedelta(minutes=5):
            ApiToken.objects.filter(pk=token.pk).update(last_used_at=now)
        set_context(replace(get_context(), user_id=str(token.user_id)))
        return token.user, token

    def authenticate_header(self, request: Request) -> str:
        return self.keyword


class ApiTokenScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.ApiTokenAuthentication"
    name = "apiToken"

    def get_security_definition(self, auto_schema: Any) -> dict[str, str]:
        return {"type": "http", "scheme": "bearer", "bearerFormat": "dop_<id>_<secret>"}

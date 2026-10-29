"""Domain errors and the API error format: {"code": "...", "detail": "...", ...}."""

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.accounts.permissions import PermissionDeniedError


class DomainError(Exception):
    """A business rule was broken. `extra` is merged into the response body."""

    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, detail: str, *, status_code: int | None = None, **extra: Any):
        super().__init__(detail)
        self.code = code
        self.detail = detail
        self.extra = extra
        if status_code is not None:
            self.status_code = status_code


class ConflictError(DomainError):
    status_code: int = status.HTTP_409_CONFLICT


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, DomainError):
        return Response({"code": exc.code, "detail": exc.detail, **exc.extra}, exc.status_code)
    if isinstance(exc, PermissionDeniedError):
        return Response(
            {"code": "permission_denied", "detail": str(exc)}, status.HTTP_403_FORBIDDEN
        )
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.message_dict if hasattr(exc, "error_dict") else exc.messages)
    if isinstance(exc, IntegrityError):
        return Response(
            {"code": "conflict", "detail": "This record conflicts with an existing one."},
            status.HTTP_409_CONFLICT,
        )
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError):
        # Always wrap: a model field may itself be called "code" or "detail".
        response.data = {
            "code": "invalid",
            "detail": "Please correct the highlighted fields.",
            "errors": response.data,
        }
    elif isinstance(response.data, dict):
        codes = exc.get_codes() if hasattr(exc, "get_codes") else None
        response.data = {"code": codes if isinstance(codes, str) else "error", **response.data}
    return response

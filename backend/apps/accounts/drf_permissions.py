"""DRF permission classes. They mirror the services' `require()` checks (02 §11)."""

from typing import Any

from allauth.account.authentication import get_authentication_records
from allauth.mfa.models import Authenticator
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from .models import ApiToken, User
from .permissions import Action, can
from .roles import OrgRole


class IsActiveOrgMember(BasePermission):
    message = "Sign in to continue."

    def has_permission(self, request: Request, view: Any) -> bool:
        if getattr(view, "public", False):
            return True
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and user.organisation_id is not None
        )


class TokenScopePermission(BasePermission):
    """API tokens only reach endpoints that opt in with `token_scopes` (fail closed)."""

    message = "This API token cannot access this endpoint."

    def has_permission(self, request: Request, view: Any) -> bool:
        if not isinstance(request.auth, ApiToken):
            return True
        required = getattr(view, "token_scopes", None)
        if required is None:
            return False
        return set(required).issubset(set(request.auth.scopes))


def mfa_setup_required(request: Request) -> bool:
    """Admins who signed in with a password must have TOTP (F-40). SSO admins rely on
    the identity provider's MFA."""
    user = request.user
    if not user.is_authenticated or user.org_role != OrgRole.ADMIN:
        return False
    if isinstance(request.auth, ApiToken):
        return False
    records = get_authentication_records(request._request)
    if not any(r.get("method") == "password" for r in records):
        return False
    return not Authenticator.objects.filter(user=user, type=Authenticator.Type.TOTP).exists()


class MfaSatisfied(BasePermission):
    message = "Set up two-factor authentication to continue."

    def has_permission(self, request: Request, view: Any) -> bool:
        if getattr(view, "public", False) or getattr(view, "allow_without_mfa", False):
            return True
        return not mfa_setup_required(request)


def _declared_action(request: Request, view: Any) -> Action | None:
    mapping: dict[str, Action] = getattr(view, "action_permissions", {})
    key = getattr(view, "action", None) or request.method
    action = mapping.get(key) if key else None
    if action is None and request.method == "HEAD":
        action = mapping.get("GET") or mapping.get("list") or mapping.get("retrieve")
    return action


class ActionPermission(BasePermission):
    """Checks the endpoint's declared Action. Endpoints that declare none are refused.

    Project-scoped views tell the check which project applies:
      - `permission_project()` for routes such as /projects/{id}/sheets (no object yet);
      - `object_project(obj)` and optionally `object_is_own(obj)` for detail routes, checked in
        has_object_permission once the (membership-scoped) object is loaded.
    """

    message = "You do not have permission to do this."

    def has_permission(self, request: Request, view: Any) -> bool:
        if getattr(view, "public", False):
            return True
        action = _declared_action(request, view)
        if action is None:
            return request.method == "OPTIONS"
        user = request.user
        if not isinstance(user, User):
            return False
        if hasattr(view, "object_project") and view.kwargs.get(
            getattr(view, "lookup_url_kwarg", None) or getattr(view, "lookup_field", "pk")
        ):
            return True  # decided per object in has_object_permission
        project = view.permission_project() if hasattr(view, "permission_project") else None
        return can(user, action, project=project)

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        if getattr(view, "public", False) or not hasattr(view, "object_project"):
            return True
        action = _declared_action(request, view)
        user = request.user
        if action is None or not isinstance(user, User):
            return False
        is_own = view.object_is_own(obj) if hasattr(view, "object_is_own") else False
        return can(user, action, project=view.object_project(obj), is_own=is_own)

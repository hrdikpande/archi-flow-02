"""allauth adapters: no self-signup for local accounts; SSO limited to the firm's domains."""

from typing import Any

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings
from django.http import HttpRequest

from apps.core.models import Organisation

from .roles import OrgRole


def email_domain_allowed(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower() if "@" in email else ""
    return bool(domain) and domain in settings.SSO_ALLOWED_DOMAINS


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        # Local accounts are created by an Admin (break-glass); staff use SSO.
        return False


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest, sociallogin: Any) -> bool:
        return email_domain_allowed(sociallogin.user.email or "")

    def populate_user(self, request: HttpRequest, sociallogin: Any, data: dict[str, Any]) -> Any:
        user = super().populate_user(request, sociallogin, data)
        user.email = (user.email or "").lower()
        name = " ".join(p for p in [data.get("first_name"), data.get("last_name")] if p)
        user.full_name = data.get("name") or name or ""
        # Single-tenant deployment: the firm's organisation. No project access until added (F-40).
        user.organisation = Organisation.objects.order_by("created_at").first()
        user.org_role = OrgRole.STAFF
        return user

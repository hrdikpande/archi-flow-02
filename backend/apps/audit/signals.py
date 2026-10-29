from typing import Any

from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver

from apps.core.models import Organisation

from .services import record


@receiver(user_logged_in)
def audit_login(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    if user.organisation_id:
        record(
            organisation_id=user.organisation_id,
            actor=user,
            verb="auth.login",
            entity_type="accounts.user",
            entity_id=user.pk,
            entity_label=user.email,
        )


@receiver(user_logged_out)
def audit_logout(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    if user is not None and user.organisation_id:
        record(
            organisation_id=user.organisation_id,
            actor=user,
            verb="auth.logout",
            entity_type="accounts.user",
            entity_id=user.pk,
            entity_label=user.email,
        )


@receiver(user_login_failed)
def audit_login_failed(sender: Any, credentials: dict[str, Any], **kwargs: Any) -> None:
    # Single-tenant deployment: failed logins are recorded against the one organisation.
    org = Organisation.objects.order_by("created_at").first()
    if org is not None:
        record(
            organisation_id=org.pk,
            actor=None,
            verb="auth.login_failed",
            entity_type="accounts.user",
            entity_id="-",
            entity_label=str(credentials.get("email", credentials.get("username", "")))[:200],
        )

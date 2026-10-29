"""User administration and API tokens. All writes audited (F-39)."""

from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_change, snapshot
from apps.core.exceptions import ConflictError, DomainError
from apps.core.records import update_record

from .models import ApiToken, User, hash_token_secret
from .permissions import Action, require
from .roles import OrgRole

USER_AUDIT_FIELDS = ("email", "full_name", "org_role", "is_active", "can_lead_projects")


@transaction.atomic
def update_user(actor: User, user: User, **data: Any) -> User:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    user = User.objects.select_for_update().get(pk=user.pk)
    losing_admin = user.org_role == OrgRole.ADMIN and (
        data.get("org_role", OrgRole.ADMIN) != OrgRole.ADMIN or data.get("is_active") is False
    )
    if losing_admin:
        other_admins = (
            User.objects.filter(organisation_id=user.org_pk, org_role=OrgRole.ADMIN, is_active=True)
            .exclude(pk=user.pk)
            .exists()
        )
        if not other_admins:
            raise ConflictError(
                "last_admin", "At least one active admin is required. Add another admin first."
            )
    before = snapshot(user, USER_AUDIT_FIELDS)
    for name in ("full_name", "org_role", "is_active", "can_lead_projects"):
        if name in data:
            setattr(user, name, data[name])
    user.save()
    record_change(
        user,
        actor=actor,
        verb="user.updated",
        before=before,
        after=snapshot(user, USER_AUDIT_FIELDS),
        organisation_id=user.organisation_id,
    )
    return user


@transaction.atomic
def create_api_token(
    actor: User, *, user: User, name: str, scopes: list[str], expires_in_days: int = 90
) -> tuple[ApiToken, str]:
    """Returns the token row and the plaintext, which is never stored."""
    require(actor, Action.MANAGE_ORG_SETTINGS)
    if user.organisation_id != actor.org_pk:
        raise DomainError("invalid_user", "User is not in your organisation.")
    if not 1 <= expires_in_days <= 365:
        raise DomainError("invalid_expiry", "Tokens expire after 1 to 365 days.")
    key_id, secret, plaintext = ApiToken.generate()
    token = ApiToken.objects.create(
        organisation_id=actor.org_pk,
        created_by=actor,
        user=user,
        name=name,
        key_id=key_id,
        secret_hash=hash_token_secret(secret),
        scopes=sorted(set(scopes)),
        expires_at=timezone.now() + timedelta(days=expires_in_days),
    )
    record_change(
        token,
        actor=actor,
        verb="api_token.created",
        before=None,
        after=snapshot(token, ("name", "user", "key_id", "scopes", "expires_at")),
    )
    return token, plaintext


@transaction.atomic
def revoke_api_token(actor: User, token: ApiToken) -> ApiToken:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    if token.revoked_at is not None:
        return token
    return update_record(token, actor=actor, verb="api_token.revoked", revoked_at=timezone.now())

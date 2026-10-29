from typing import Any

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.core.exceptions import ConflictError, DomainError
from apps.core.records import create_record, delete_record, update_record

from .models import Contact, ExternalOrg


def _normalise_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _check_duplicate_email(
    organisation_id: Any, email: str, *, exclude_id: Any = None, confirmed: bool
) -> None:
    """F-43: a duplicate email warns. The client must resend with confirm_duplicate=true."""
    if not email or confirmed:
        return
    existing = (
        Contact.objects.filter(organisation_id=organisation_id, email__iexact=email)
        .exclude(pk=exclude_id)
        .select_related("external_org")
        .first()
    )
    if existing is not None:
        raise ConflictError(
            "duplicate_email",
            f"{existing.full_name} already uses {email}. Save anyway?",
            existing={
                "id": str(existing.pk),
                "full_name": existing.full_name,
                "external_org": existing.external_org.name if existing.external_org else None,
            },
        )


def _check_org(actor: User, external_org: ExternalOrg | None) -> None:
    if external_org is not None and external_org.organisation_id != actor.org_pk:
        raise DomainError("invalid_external_org", "Unknown organisation.")


@transaction.atomic
def create_external_org(actor: User, **data: Any) -> ExternalOrg:
    require(actor, Action.MANAGE_CONTACTS)
    data["email"] = _normalise_email(data.get("email"))
    return create_record(
        ExternalOrg,
        actor=actor,
        verb="external_org.created",
        organisation_id=actor.org_pk,
        **data,
    )


@transaction.atomic
def update_external_org(actor: User, org: ExternalOrg, **data: Any) -> ExternalOrg:
    require(actor, Action.MANAGE_CONTACTS)
    if "email" in data:
        data["email"] = _normalise_email(data["email"])
    return update_record(org, actor=actor, verb="external_org.updated", **data)


@transaction.atomic
def delete_external_org(actor: User, org: ExternalOrg) -> None:
    require(actor, Action.MANAGE_CONTACTS)
    if org.contacts.exists():
        raise ConflictError(
            "has_contacts", "This organisation still has contacts. Deactivate it instead."
        )
    delete_record(org, actor=actor, verb="external_org.deleted")


@transaction.atomic
def create_contact(actor: User, *, confirm_duplicate: bool = False, **data: Any) -> Contact:
    require(actor, Action.MANAGE_CONTACTS)
    _check_org(actor, data.get("external_org"))
    data["email"] = _normalise_email(data.get("email"))
    _check_duplicate_email(actor.org_pk, data["email"], confirmed=confirm_duplicate)
    return create_record(
        Contact,
        actor=actor,
        verb="contact.created",
        organisation_id=actor.org_pk,
        **data,
    )


@transaction.atomic
def update_contact(
    actor: User, contact: Contact, *, confirm_duplicate: bool = False, **data: Any
) -> Contact:
    require(actor, Action.MANAGE_CONTACTS)
    if "external_org" in data:
        _check_org(actor, data["external_org"])
    if "email" in data:
        data["email"] = _normalise_email(data["email"])
        if data["email"] != contact.email:
            _check_duplicate_email(
                actor.org_pk,
                data["email"],
                exclude_id=contact.pk,
                confirmed=confirm_duplicate,
            )
    return update_record(contact, actor=actor, verb="contact.updated", **data)


@transaction.atomic
def delete_contact(actor: User, contact: Contact) -> None:
    """Contacts referenced by transmittals (S4) are protected by FK; deactivate instead."""
    require(actor, Action.MANAGE_CONTACTS)
    delete_record(contact, actor=actor, verb="contact.deleted")

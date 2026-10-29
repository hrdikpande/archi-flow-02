"""Organisation settings, disciplines, holidays (F-42). All writes audited (F-39)."""

from datetime import date
from typing import Any

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record_change, snapshot

from .models import Discipline, Holiday, Organisation, OrgSettings
from .records import create_record, delete_record, update_record

ORG_FIELDS = ("name", "timezone", "currency", "work_week")


def get_or_create_settings(organisation: Organisation) -> OrgSettings:
    settings_row, _ = OrgSettings.objects.get_or_create(organisation=organisation)
    return settings_row


@transaction.atomic
def update_org_settings(
    actor: User, *, organisation: dict[str, Any] | None = None, **fields: Any
) -> OrgSettings:
    """Changes apply to new records; existing records keep their values (F-42)."""
    require(actor, Action.MANAGE_ORG_SETTINGS)
    org = Organisation.objects.select_for_update().get(pk=actor.org_pk)
    if organisation:
        before = snapshot(org, ORG_FIELDS)
        for name, value in organisation.items():
            if name in ORG_FIELDS:
                setattr(org, name, value)
        org.full_clean()
        org.save()
        record_change(
            org,
            actor=actor,
            verb="org.updated",
            before=before,
            after=snapshot(org, ORG_FIELDS),
            organisation_id=org.pk,
        )
    row = get_or_create_settings(org)
    if fields:
        before = snapshot(row)
        for name, value in fields.items():
            setattr(row, name, value)
        row.full_clean()
        row.save()
        record_change(
            row,
            actor=actor,
            verb="org_settings.updated",
            before=before,
            after=snapshot(row),
            organisation_id=org.pk,
        )
    return row


@transaction.atomic
def create_discipline(actor: User, **data: Any) -> Discipline:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    data["code"] = data["code"].upper()
    return create_record(
        Discipline,
        actor=actor,
        verb="discipline.created",
        organisation_id=actor.org_pk,
        **data,
    )


@transaction.atomic
def update_discipline(actor: User, discipline: Discipline, **data: Any) -> Discipline:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    if "code" in data:
        data["code"] = data["code"].upper()
    return update_record(discipline, actor=actor, verb="discipline.updated", **data)


@transaction.atomic
def delete_discipline(actor: User, discipline: Discipline) -> None:
    """Deleting is only possible while nothing references the discipline (FK PROTECT);
    otherwise deactivate it."""
    require(actor, Action.MANAGE_ORG_SETTINGS)
    delete_record(discipline, actor=actor, verb="discipline.deleted")


@transaction.atomic
def create_holiday(actor: User, *, date: date, name: str) -> Holiday:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    return create_record(
        Holiday,
        actor=actor,
        verb="holiday.created",
        organisation_id=actor.org_pk,
        date=date,
        name=name,
    )


@transaction.atomic
def update_holiday(actor: User, holiday: Holiday, **data: Any) -> Holiday:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    return update_record(holiday, actor=actor, verb="holiday.updated", **data)


@transaction.atomic
def delete_holiday(actor: User, holiday: Holiday) -> None:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    delete_record(holiday, actor=actor, verb="holiday.deleted")

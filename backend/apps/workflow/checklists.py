"""F-13 designer pre-check lists: ticked before "Submit for check"; mandatory items block
submit; the ticks are kept per review round and shown with that round's review."""

from typing import Any

from django.db import transaction
from django.db.models import Q, QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record_change, snapshot
from apps.core.exceptions import DomainError
from apps.register.models import Sheet

from .models import Checklist, ChecklistItem, ChecklistResponse


def applicable(sheet: Sheet) -> list[Checklist]:
    """Active lists for the sheet's discipline (or any discipline) and its stage."""
    stage_name = sheet.stage.name.lower()
    lists = (
        Checklist.objects.filter(organisation_id=sheet.organisation_id, is_active=True)
        .filter(Q(discipline__isnull=True) | Q(discipline_id=sheet.discipline_id))
        .prefetch_related("items")
    )
    return [
        c for c in lists if not c.stage_names or stage_name in {n.lower() for n in c.stage_names}
    ]


def items_for(sheet: Sheet) -> list[ChecklistItem]:
    return [i for c in applicable(sheet) for i in c.items.all()]


def missing_mandatory(sheet: Sheet, ticked: set[int]) -> list[str]:
    return [i.text for i in items_for(sheet) if i.mandatory and i.pk not in ticked]


def store_response(sheet: Sheet, actor: User, ticked: set[int]) -> ChecklistResponse | None:
    items = items_for(sheet)
    if not items:
        return None
    response, _ = ChecklistResponse.objects.update_or_create(
        sheet=sheet,
        round=sheet.review_round,
        defaults={
            "organisation_id": sheet.organisation_id,
            "submitted_by": actor,
            "items": [
                {
                    "id": i.pk,
                    "checklist": i.checklist.name,
                    "text": i.text,
                    "mandatory": i.mandatory,
                    "ticked": i.pk in ticked,
                }
                for i in items
            ],
        },
    )
    return response


def response_for(sheet: Sheet, round_: int) -> ChecklistResponse | None:
    return ChecklistResponse.objects.filter(sheet=sheet, round=round_).first()


# --- Admin: the checklist builder (S-19) -------------------------------------------------


def org_checklists(user: User) -> QuerySet[Checklist]:
    return Checklist.objects.filter(organisation_id=user.org_pk).prefetch_related("items")


@transaction.atomic
def save_checklist(
    actor: User, checklist: Checklist | None, *, items: list[dict[str, Any]], **data: Any
) -> Checklist:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    if not items:
        raise DomainError("no_items", "Add at least one item.")
    if checklist is None:
        checklist = Checklist(organisation_id=actor.org_pk)
        before = None
    else:
        before = {
            **snapshot(checklist, ("name", "discipline", "stage_names", "is_active")),
            "items": [i.text for i in checklist.items.all()],
        }
    for k, v in data.items():
        setattr(checklist, k, v)
    checklist.stage_names = [n.strip() for n in checklist.stage_names if n.strip()]
    checklist.save()
    checklist.items.all().delete()
    ChecklistItem.objects.bulk_create(
        [
            ChecklistItem(
                checklist=checklist,
                seq=n,
                text=i["text"].strip(),
                mandatory=i.get("mandatory", True),
            )
            for n, i in enumerate(items, start=1)
            if i["text"].strip()
        ]
    )
    record_change(
        checklist,
        actor=actor,
        verb="checklist.saved",
        before=before,
        after={
            **snapshot(checklist, ("name", "discipline", "stage_names", "is_active")),
            "items": [i["text"] for i in items],
        },
    )
    return checklist


def delete_checklist(actor: User, checklist: Checklist) -> None:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    from apps.core.records import delete_record

    delete_record(checklist, actor=actor, verb="checklist.deleted")

"""F-12 review delegation: between two dates, reviews waiting for a person route to their
delegate. Only on projects where the delegate may review (PL, DL or senior reviewer there);
elsewhere the review stays with the original reviewer and A-07 escalates it to the DL."""

from datetime import date
from typing import Any

from django.db import transaction
from django.db.models import QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import Action, can
from apps.accounts.roles import ProjectRole
from apps.core.clock import org_today
from apps.core.exceptions import DomainError
from apps.core.records import create_record, delete_record
from apps.people.services import can_manage_staff
from apps.projects.models import ProjectMembership

from .models import Delegation

REVIEWER_ROLES = (ProjectRole.PL, ProjectRole.DL, ProjectRole.SENIOR_REVIEWER)


def active_delegate(user_id: Any, day: date) -> User | None:
    d = (
        Delegation.objects.filter(user_id=user_id, start__lte=day, end__gte=day)
        .select_related("delegate")
        .order_by("-start")
        .first()
    )
    return d.delegate if d and d.delegate.is_active else None


def delegators_of(user: User, day: date) -> list[Any]:
    """People whose reviews currently route to `user`."""
    return list(
        Delegation.objects.filter(delegate=user, start__lte=day, end__gte=day).values_list(
            "user_id", flat=True
        )
    )


def can_review_on(user: User, project_id: Any) -> bool:
    return ProjectMembership.objects.filter(
        user=user, project_id=project_id, role__in=REVIEWER_ROLES
    ).exists()


def is_acting_for(user: User, reviewer_id: Any, project_id: Any) -> bool:
    """True when `user` is today's delegate of `reviewer_id` and may review on this project."""
    if reviewer_id is None or reviewer_id == user.pk:
        return False
    delegate = active_delegate(reviewer_id, org_today(user.org))
    return delegate is not None and delegate.pk == user.pk and can_review_on(user, project_id)


def visible_delegations(actor: User) -> QuerySet[Delegation]:
    qs = Delegation.objects.filter(organisation_id=actor.org_pk).select_related("user", "delegate")
    if can(actor, Action.MANAGE_STAFF):
        return qs
    return qs.filter(user=actor) | qs.filter(delegate=actor)


@transaction.atomic
def set_delegation(
    actor: User, *, user: User, delegate: User, start: date, end: date, note: str = ""
) -> Delegation:
    if user.pk != actor.pk and not can_manage_staff(actor, user):
        raise DomainError(
            "not_allowed", "You can set a delegate only for yourself.", status_code=403
        )
    if delegate.pk == user.pk:
        raise DomainError("self_delegate", "Choose someone else as the delegate.")
    if delegate.organisation_id != user.organisation_id or not delegate.is_active:
        raise DomainError("invalid_delegate", "The delegate must be an active person in the firm.")
    if end < start:
        raise DomainError("invalid_dates", "The delegation ends before it starts.")
    if Delegation.objects.filter(user=user, start__lte=end, end__gte=start).exists():
        raise DomainError(
            "overlap", "There is already a delegation in those dates; remove it first."
        )
    if active_delegate(delegate.pk, start) is not None:
        raise DomainError("chain", f"{delegate} has delegated their own reviews in those dates.")
    return create_record(
        Delegation,
        actor=actor,
        verb="delegation.created",
        organisation_id=user.organisation_id,
        user=user,
        delegate=delegate,
        start=start,
        end=end,
        note=note,
    )


@transaction.atomic
def remove_delegation(actor: User, delegation: Delegation) -> None:
    if delegation.user_id != actor.pk and not can_manage_staff(actor, delegation.user):
        raise DomainError(
            "not_allowed", "You can remove only your own delegation.", status_code=403
        )
    delete_record(delegation, actor=actor, verb="delegation.deleted")

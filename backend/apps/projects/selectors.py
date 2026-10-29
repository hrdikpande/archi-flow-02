"""Membership-scoped reads (F-38). Every list of project data must pass through these."""

from django.db.models import Model, QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import PERMISSIONS, Action

from .models import Project


def visible_projects(user: User) -> QuerySet[Project]:
    """Projects the user may view: all in the org for Owner/Admin, else by membership."""
    if not user.is_active or user.organisation_id is None:
        return Project.objects.none()
    base = Project.objects.filter(organisation_id=user.organisation_id)
    if user.org_role in PERMISSIONS[Action.VIEW_PROJECT].org_roles:
        return base
    return base.filter(memberships__user=user).distinct()


def scope_to_visible_projects[T: Model](
    queryset: QuerySet[T], user: User, project_field: str = "project"
) -> QuerySet[T]:
    """Filters any project-owned queryset to the projects the user can see."""
    return queryset.filter(**{f"{project_field}__in": visible_projects(user)})

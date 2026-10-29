"""Who on a project should hear about something (notification audiences)."""

from typing import Any

from django.db.models import Q

from apps.accounts.models import User
from apps.accounts.roles import ProjectRole


def members_with_role(project_id: Any, *roles: str, discipline_id: Any = None) -> list[User]:
    """Users with these project roles. For DLs, those leading the given discipline come first;
    a DL with no discipline on the membership leads them all."""
    qs = User.objects.filter(
        memberships__project_id=project_id, memberships__role__in=roles, is_active=True
    )
    if discipline_id is not None and roles == (ProjectRole.DL,):
        qs = qs.filter(
            Q(memberships__discipline_id=discipline_id) | Q(memberships__discipline__isnull=True)
        )
    return list(qs.distinct())

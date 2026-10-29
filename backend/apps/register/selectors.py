from typing import Any

from django.db.models import Prefetch, Q, QuerySet

from apps.accounts.models import User
from apps.projects.models import Project
from apps.projects.selectors import visible_projects

from .models import Sheet


def open_flags() -> Prefetch:
    from apps.automation.models import Flag

    return Prefetch(
        "flags", queryset=Flag.objects.filter(cleared_at__isnull=True), to_attr="open_flags"
    )


def visible_sheets(user: User) -> QuerySet[Sheet]:
    return Sheet.objects.filter(project__in=visible_projects(user))


def register_sheets(project: Project, filters: dict[str, Any]) -> QuerySet[Sheet]:
    qs = (
        Sheet.objects.filter(project=project)
        .select_related("discipline", "stage", "package", "owner", "checker", "current_revision")
        .prefetch_related(open_flags())
    )
    for key in ("discipline", "stage", "package", "owner", "checker"):
        values = filters.get(key)
        if values:
            qs = qs.filter(**{f"{key}_id__in": values})
    if states := filters.get("state"):
        qs = qs.filter(state__in=states)
    if q := (filters.get("q") or "").strip():
        qs = qs.filter(Q(number__icontains=q) | Q(title__icontains=q) | Q(aliases__contains=[q]))
    return qs.order_by("number")

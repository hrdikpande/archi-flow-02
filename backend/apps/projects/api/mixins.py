from functools import cached_property
from typing import Any

from django.http import Http404

from apps.accounts.request import acting_user
from apps.projects.models import Project
from apps.projects.selectors import visible_projects


class ProjectNestedMixin:
    """For routes under /projects/{project_pk}/…: the project must be visible (else 404)."""

    kwargs: dict[str, Any]
    request: Any

    @cached_property
    def project(self) -> Project:
        project = (
            visible_projects(acting_user(self.request))
            .filter(pk=self.kwargs["project_pk"])
            .select_related("organisation")
            .first()
        )
        if project is None:
            raise Http404
        return project

    def permission_project(self) -> Project:
        return self.project


class ProjectObjectMixin:
    """For detail routes whose object belongs to a project (sheet, stage, package …)."""

    project_path = "project"

    def object_project(self, obj: Any) -> Project:
        for part in self.project_path.split("__"):
            obj = getattr(obj, part)
        return obj

"""Base viewset: organisation-scoped querysets and writes routed through services."""

from typing import Any

from django.db.models import Model, QuerySet
from rest_framework import viewsets

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user


class OrgScopedViewSet(viewsets.ModelViewSet):
    """Subclasses set `queryset`, `serializer_class`, `action_permissions` and the three
    service callables. Views stay thin: no model writes here (CLAUDE.md)."""

    action_permissions: dict[str, Action] = {}
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self) -> QuerySet[Any]:
        return super().get_queryset().filter(organisation_id=acting_user(self.request).org_pk)

    def create_service(self, actor: Any, **data: Any) -> Model:
        raise NotImplementedError

    def update_service(self, actor: Any, instance: Any, **data: Any) -> Model:
        raise NotImplementedError

    def delete_service(self, actor: Any, instance: Any) -> None:
        raise NotImplementedError

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = self.create_service(
            acting_user(self.request), **serializer.validated_data
        )

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = self.update_service(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

    def perform_destroy(self, instance: Any) -> None:
        self.delete_service(acting_user(self.request), instance)

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core import services
from apps.core.models import Discipline, Holiday
from apps.core.viewsets import OrgScopedViewSet

from .serializers import (
    DisciplineSerializer,
    HolidaySerializer,
    OrganisationSerializer,
    OrgSettingsSerializer,
)

ADMIN_WRITES = {
    "list": Action.VIEW_ORG_REFERENCE,
    "retrieve": Action.VIEW_ORG_REFERENCE,
    "create": Action.MANAGE_ORG_SETTINGS,
    "partial_update": Action.MANAGE_ORG_SETTINGS,
    "destroy": Action.MANAGE_ORG_SETTINGS,
}


class OrgSettingsView(generics.GenericAPIView):
    serializer_class = OrgSettingsSerializer
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "PATCH": Action.MANAGE_ORG_SETTINGS}

    def _payload(self, request: Request) -> dict[str, Any]:
        row = services.get_or_create_settings(acting_user(request).org)
        data = OrgSettingsSerializer(row).data
        data["organisation"] = OrganisationSerializer(row.organisation).data
        return data

    def get(self, request: Request) -> Response:
        return Response(self._payload(request))

    def patch(self, request: Request) -> Response:
        serializer = OrgSettingsSerializer(
            data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        services.update_org_settings(acting_user(request), **serializer.validated_data)
        return Response(self._payload(request))


class DisciplineViewSet(OrgScopedViewSet):
    queryset = Discipline.objects.all()
    serializer_class = DisciplineSerializer
    action_permissions = ADMIN_WRITES
    pagination_class = None

    def get_queryset(self) -> QuerySet[Discipline]:
        return super().get_queryset().order_by("sort_order", "code")

    def create_service(self, actor: Any, **data: Any) -> Any:
        return services.create_discipline(actor, **data)

    def update_service(self, actor: Any, instance: Any, **data: Any) -> Any:
        return services.update_discipline(actor, instance, **data)

    def delete_service(self, actor: Any, instance: Any) -> None:
        services.delete_discipline(actor, instance)


@extend_schema(parameters=[OpenApiParameter("year", int, required=False)])
class HolidayViewSet(OrgScopedViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    action_permissions = ADMIN_WRITES
    pagination_class = None

    def get_queryset(self) -> QuerySet[Holiday]:
        qs = super().get_queryset().order_by("date")
        year = self.request.query_params.get("year")
        if year and year.isdigit():
            qs = qs.filter(date__year=int(year))
        return qs

    def create_service(self, actor: Any, **data: Any) -> Any:
        return services.create_holiday(actor, **data)

    def update_service(self, actor: Any, instance: Any, **data: Any) -> Any:
        return services.update_holiday(actor, instance, **data)

    def delete_service(self, actor: Any, instance: Any) -> None:
        services.delete_holiday(actor, instance)

from typing import Any

from django.db.models import Count, Q, QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from apps.accounts.permissions import Action
from apps.contacts import services
from apps.contacts.models import Contact, ExternalOrg
from apps.core.pagination import DefaultCursorPagination
from apps.core.viewsets import OrgScopedViewSet

from .serializers import ContactSerializer, ExternalOrgSerializer

CONTACT_PERMISSIONS = {
    "list": Action.VIEW_ORG_REFERENCE,
    "retrieve": Action.VIEW_ORG_REFERENCE,
    "create": Action.MANAGE_CONTACTS,
    "partial_update": Action.MANAGE_CONTACTS,
    "destroy": Action.MANAGE_CONTACTS,
}


class NameCursor(DefaultCursorPagination):
    ordering = "name"


class FullNameCursor(DefaultCursorPagination):
    ordering = "full_name"


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("kind", str, required=False),
        ]
    )
)
class ExternalOrgViewSet(OrgScopedViewSet):
    queryset = ExternalOrg.objects.all()
    serializer_class = ExternalOrgSerializer
    action_permissions = CONTACT_PERMISSIONS
    pagination_class = NameCursor

    def get_queryset(self) -> QuerySet[ExternalOrg]:
        qs = super().get_queryset().annotate(contact_count=Count("contacts"))
        params = self.request.query_params
        if q := params.get("q", "").strip():
            qs = qs.filter(name__icontains=q)
        if kind := params.get("kind"):
            qs = qs.filter(kind=kind)
        return qs

    def create_service(self, actor: Any, **data: Any) -> Any:
        return services.create_external_org(actor, **data)

    def update_service(self, actor: Any, instance: Any, **data: Any) -> Any:
        return services.update_external_org(actor, instance, **data)

    def delete_service(self, actor: Any, instance: Any) -> None:
        services.delete_external_org(actor, instance)


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("external_org", str, required=False),
        ]
    )
)
class ContactViewSet(OrgScopedViewSet):
    queryset = Contact.objects.select_related("external_org")
    serializer_class = ContactSerializer
    action_permissions = CONTACT_PERMISSIONS
    pagination_class = FullNameCursor

    def get_queryset(self) -> QuerySet[Contact]:
        qs = super().get_queryset()
        params = self.request.query_params
        if q := params.get("q", "").strip():
            qs = qs.filter(
                Q(full_name__icontains=q)
                | Q(email__icontains=q)
                | Q(external_org__name__icontains=q)
            )
        if org := params.get("external_org"):
            qs = qs.filter(external_org_id=org)
        return qs

    def create_service(self, actor: Any, **data: Any) -> Any:
        return services.create_contact(actor, **data)

    def update_service(self, actor: Any, instance: Any, **data: Any) -> Any:
        return services.update_contact(actor, instance, **data)

    def delete_service(self, actor: Any, instance: Any) -> None:
        services.delete_contact(actor, instance)

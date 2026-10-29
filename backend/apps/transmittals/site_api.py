"""Manage site-view magic links (F-51) for a project: PL or DC."""

from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.contacts.models import Contact
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.selectors import visible_projects

from . import site
from .models import SiteLink


class SiteLinkSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source="contact.full_name", read_only=True)
    contact_email = serializers.CharField(source="contact.email", read_only=True)
    downloads = serializers.IntegerField(source="downloads.count", read_only=True)
    contact = OrgPrimaryKeyRelatedField(queryset=Contact.objects.all())

    class Meta:
        model = SiteLink
        fields = [
            "id",
            "contact",
            "contact_name",
            "contact_email",
            "expires_at",
            "revoked_at",
            "last_used_at",
            "downloads",
            "created_at",
        ]
        read_only_fields = ["id", "expires_at", "revoked_at", "last_used_at", "created_at"]


class SiteLinkListView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = SiteLinkSerializer
    pagination_class = None
    queryset = SiteLink.objects.none()
    action_permissions = {"GET": Action.ISSUE_SHEETS, "POST": Action.ISSUE_SHEETS}

    def get_queryset(self) -> Any:
        return SiteLink.objects.filter(project=self.project).select_related("contact")

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        payload = SiteLinkSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        link, _ = site.create_link(
            acting_user(request),
            self.project,
            payload.validated_data["contact"],
            settings.FRONTEND_URL,
        )
        return Response(SiteLinkSerializer(link).data, status=status.HTTP_201_CREATED)


class SiteLinkRevokeView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = SiteLinkSerializer
    queryset = SiteLink.objects.none()
    action_permissions = {"POST": Action.ISSUE_SHEETS}

    def get_queryset(self) -> Any:
        return SiteLink.objects.filter(project__in=visible_projects(acting_user(self.request)))

    @extend_schema(request=None, responses=SiteLinkSerializer)
    def post(self, request: Request, pk: str) -> Response:
        return Response(
            SiteLinkSerializer(site.revoke(acting_user(request), self.get_object())).data
        )

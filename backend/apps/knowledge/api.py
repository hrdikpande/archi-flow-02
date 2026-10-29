"""S-22 knowledge search and the project decision log (F-58)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.models import Discipline
from apps.files.links import SheetRefSerializer
from apps.projects.api.mixins import ProjectNestedMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.register.models import Sheet

from . import services
from .models import Decision


class DecisionSerializer(serializers.ModelSerializer):
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )
    logged_by_detail = UserMiniSerializer(source="logged_by", read_only=True, allow_null=True)

    class Meta:
        model = Decision
        fields = [
            "id",
            "number",
            "title",
            "text",
            "decided_on",
            "decided_by",
            "tags",
            "sheets",
            "sheet_refs",
            "discipline",
            "logged_by_detail",
            "created_at",
        ]
        read_only_fields = ["id", "number", "created_at"]


class DecisionListView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = DecisionSerializer
    pagination_class = None
    queryset = Decision.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.LOG_DECISIONS}

    def get_queryset(self) -> QuerySet[Decision]:
        return (
            Decision.objects.filter(project=self.project)
            .prefetch_related("sheets")
            .select_related("logged_by")
        )

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.log_decision(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class SheetLinkSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()


class KnowledgeHitSerializer(serializers.Serializer):
    kind = serializers.CharField()
    kind_label = serializers.CharField()
    id = serializers.CharField()
    project = serializers.UUIDField()
    project_code = serializers.CharField()
    title = serializers.CharField()
    snippet = serializers.CharField(allow_blank=True)
    sheets = SheetLinkSerializer(many=True)
    link = serializers.CharField()


class KnowledgeSearchView(APIView):
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=True),
            OpenApiParameter("project", str, required=False),
            OpenApiParameter("discipline", str, required=False),
            OpenApiParameter("kind", str, many=True, required=False),
        ],
        responses=KnowledgeHitSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        p = request.query_params
        hits = services.search(
            acting_user(request),
            p.get("q", "")[:200],
            project=p.get("project") or None,
            discipline=p.get("discipline") or None,
            kinds=p.getlist("kind") or None,
        )
        return Response(KnowledgeHitSerializer(hits, many=True).data)

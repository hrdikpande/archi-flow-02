"""S-21 clash issues (P3, F-34): import BCF / Navisworks, list, update, view snapshot."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.models import Discipline
from apps.files.links import AttachmentLinkSerializer, SheetRefSerializer, link
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet

from . import services
from .models import ClashImport, ClashIssue


class ClashIssueSerializer(serializers.ModelSerializer):
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    assignee = OrgPrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )
    assignee_detail = UserMiniSerializer(source="assignee", read_only=True, allow_null=True)
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )
    discipline_code = serializers.CharField(source="discipline.code", read_only=True, default=None)
    snapshot_link = serializers.SerializerMethodField()

    class Meta:
        model = ClashIssue
        fields = [
            "id",
            "source",
            "guid",
            "title",
            "description",
            "source_status",
            "status",
            "priority",
            "topic_type",
            "labels",
            "assigned_to_text",
            "assignee",
            "assignee_detail",
            "discipline",
            "discipline_code",
            "sheets",
            "sheet_refs",
            "snapshot_link",
            "source_modified",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "source",
            "guid",
            "title",
            "description",
            "source_status",
            "priority",
            "topic_type",
            "labels",
            "assigned_to_text",
            "source_modified",
            "updated_at",
        ]

    @extend_schema_field(AttachmentLinkSerializer(allow_null=True))
    def get_snapshot_link(self, obj: ClashIssue) -> Any:
        return link(self.context.get("request"), obj.snapshot)


class ClashImportSerializer(serializers.ModelSerializer):
    imported_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = ClashImport
        fields = ["id", "source", "original_name", "counts", "imported_by", "created_at"]
        read_only_fields = fields


class ImportRequestSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()


class ClashListView(ProjectNestedMixin, generics.ListAPIView):
    serializer_class = ClashIssueSerializer
    pagination_class = None
    queryset = ClashIssue.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(
        parameters=[
            OpenApiParameter("status", str, required=False),
            OpenApiParameter("discipline", str, required=False),
        ]
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[ClashIssue]:
        qs = (
            ClashIssue.objects.filter(project=self.project)
            .select_related("discipline", "assignee", "snapshot")
            .prefetch_related("sheets")
        )
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        if d := self.request.query_params.get("discipline"):
            qs = qs.filter(discipline_id=d)
        return qs


class ClashImportView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = ClashImportSerializer
    pagination_class = None
    queryset = ClashImport.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.MANAGE_CLASHES}

    def get_queryset(self) -> QuerySet[ClashImport]:
        return ClashImport.objects.filter(project=self.project).select_related("imported_by")[:20]

    @extend_schema(request=ImportRequestSerializer, responses={201: ClashImportSerializer})
    def post(self, request: Request, project_pk: str) -> Response:
        payload = ImportRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        job = services.import_clashes(
            acting_user(request), self.project, payload.validated_data["upload_id"]
        )
        return Response(ClashImportSerializer(job).data, status=status.HTTP_201_CREATED)


class ClashDetailView(ProjectObjectMixin, generics.RetrieveUpdateAPIView):
    serializer_class = ClashIssueSerializer
    queryset = ClashIssue.objects.none()
    http_method_names = ["get", "patch"]
    action_permissions = {"GET": Action.VIEW_PROJECT, "PATCH": Action.MANAGE_CLASHES}

    def get_queryset(self) -> QuerySet[ClashIssue]:
        return ClashIssue.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_issue(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

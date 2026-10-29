from typing import Any

from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.projects.models import Project
from apps.projects.selectors import visible_projects

from . import services
from .models import ExportFormat, ExportJob, ExportKind


class ExportRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ExportKind.choices)
    format = serializers.ChoiceField(choices=ExportFormat.choices)
    project = serializers.UUIDField(required=False, allow_null=True)
    filters = serializers.DictField(required=False, default=dict)


class ExportJobSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    file_name = serializers.CharField(source="file.original_name", default=None, allow_null=True)

    class Meta:
        model = ExportJob
        fields = [
            "id",
            "kind",
            "format",
            "filters",
            "project",
            "state",
            "row_count",
            "error",
            "created_at",
            "finished_at",
            "file_name",
            "download_url",
        ]
        read_only_fields = fields

    def get_download_url(self, obj: ExportJob) -> str | None:
        request = self.context.get("request")
        origin = request.build_absolute_uri("/").rstrip("/") if request else None
        return services.download_url(obj, origin)


class ExportListView(APIView):
    """F-52: POST starts an export of a list with its current filters."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=ExportJobSerializer(many=True))
    def get(self, request: Request) -> Response:
        jobs = ExportJob.objects.filter(user=acting_user(request)).select_related("file")[:20]
        return Response(ExportJobSerializer(jobs, many=True, context={"request": request}).data)

    @extend_schema(
        request=ExportRequestSerializer,
        responses={201: ExportJobSerializer, 202: ExportJobSerializer},
    )
    def post(self, request: Request) -> Response:
        payload = ExportRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        user = acting_user(request)
        project: Project | None = None
        if d.get("project"):
            project = visible_projects(user).filter(pk=d["project"]).first()
            if project is None:
                raise Http404
        job = services.start(user, d["kind"], d["format"], d["filters"], project)
        code = status.HTTP_201_CREATED if job.state == "done" else status.HTTP_202_ACCEPTED
        return Response(ExportJobSerializer(job, context={"request": request}).data, status=code)


class ExportDetailView(generics.RetrieveAPIView):
    serializer_class = ExportJobSerializer
    queryset = ExportJob.objects.none()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    def get_queryset(self) -> Any:
        return ExportJob.objects.filter(user=acting_user(self.request)).select_related("file")

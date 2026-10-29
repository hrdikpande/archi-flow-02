from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.register import onboarding
from apps.register.models import OnboardingJob


class OnboardingIssueSerializer(serializers.Serializer):
    sheet = serializers.CharField()
    row = serializers.IntegerField(allow_null=True)
    message = serializers.CharField()


class OnboardingReportSerializer(serializers.Serializer):
    errors = OnboardingIssueSerializer(many=True)  # type: ignore[assignment]
    missing_files = serializers.ListField(child=serializers.CharField())
    counts = serializers.DictField(child=serializers.IntegerField())
    ready = serializers.BooleanField()


class OnboardingJobSerializer(serializers.ModelSerializer):
    report = OnboardingReportSerializer(source="report_view")
    project_code = serializers.CharField(source="data.project.code", default="")
    project_name = serializers.CharField(source="data.project.name", default="")

    class Meta:
        model = OnboardingJob
        fields = [
            "id",
            "original_name",
            "state",
            "report",
            "project",
            "project_code",
            "project_name",
            "created_at",
            "committed_at",
        ]
        read_only_fields = fields


class OnboardingFilesSerializer(serializers.Serializer):
    uploads = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=500)


class OnboardingStartView(APIView):
    """F-54 step 1: upload the filled-in template workbook (Admin)."""

    parser_classes = [MultiPartParser]
    action_permissions = {"GET": Action.MANAGE_ORG_SETTINGS, "POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(responses=OnboardingJobSerializer(many=True))
    def get(self, request: Request) -> Response:
        jobs = OnboardingJob.objects.filter(organisation_id=acting_user(request).org_pk)[:20]
        return Response(OnboardingJobSerializer(jobs, many=True).data)

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"file": {"type": "string", "format": "binary"}},
            }
        },
        responses={201: OnboardingJobSerializer},
    )
    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            raise serializers.ValidationError({"file": "Choose the onboarding workbook."})
        job = onboarding.start(acting_user(request), name=upload.name or "", content=upload.read())
        return Response(OnboardingJobSerializer(job).data, status=status.HTTP_201_CREATED)


class _OnboardingObject(generics.GenericAPIView):
    serializer_class = OnboardingJobSerializer
    queryset = OnboardingJob.objects.none()

    def get_queryset(self) -> Any:
        return OnboardingJob.objects.filter(organisation_id=acting_user(self.request).org_pk)


class OnboardingDetailView(_OnboardingObject):
    action_permissions = {"GET": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(responses=OnboardingJobSerializer)
    def get(self, request: Request, pk: str) -> Response:
        return Response(OnboardingJobSerializer(self.get_object()).data)


class OnboardingFilesView(_OnboardingObject):
    """F-54 step 2: attach PDFs (uploaded and verified through /uploads) by file name."""

    action_permissions = {"POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(request=OnboardingFilesSerializer, responses=OnboardingJobSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = OnboardingFilesSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        job = onboarding.attach_files(
            acting_user(request), self.get_object(), payload.validated_data["uploads"]
        )
        return Response(OnboardingJobSerializer(job).data)


class OnboardingCommitView(_OnboardingObject):
    """F-54 step 3: load everything in one transaction."""

    action_permissions = {"POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(request=None, responses=OnboardingJobSerializer)
    def post(self, request: Request, pk: str) -> Response:
        job = onboarding.commit(acting_user(request), self.get_object())
        return Response(OnboardingJobSerializer(job).data)


class TitleBlockRequestSerializer(serializers.Serializer):
    upload_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=200)


class TitleBlockResultSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()
    file_name = serializers.CharField()
    method = serializers.ChoiceField(choices=["text", "ocr", "none"])
    sheet = serializers.UUIDField(allow_null=True)
    sheet_number = serializers.CharField(allow_null=True)
    confidence = serializers.FloatField()
    title = serializers.CharField(allow_blank=True)
    revision = serializers.CharField(allow_blank=True)


class TitleBlockView(APIView):
    """F-50: read uploaded PDFs' title blocks and match them to the register."""

    action_permissions = {"POST": Action.UPLOAD_FILES}

    @extend_schema(
        request=TitleBlockRequestSerializer, responses=TitleBlockResultSerializer(many=True)
    )
    def post(self, request: Request, project_pk: str) -> Response:
        from apps.projects.selectors import visible_projects
        from apps.register.titleblock import read_uploads

        payload = TitleBlockRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        actor = acting_user(request)
        project = visible_projects(actor).filter(pk=project_pk).first()
        if project is None:
            from django.http import Http404

            raise Http404
        rows = read_uploads(actor, project, payload.validated_data["upload_ids"])
        return Response(TitleBlockResultSerializer(rows, many=True).data)

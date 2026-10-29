"""CAD plugin and storage connector API (02 §12: /integrations/cad-sync, API tokens)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.idempotency import idempotent
from apps.core.models import Discipline
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.models import Stage
from apps.projects.selectors import visible_projects

from . import services
from .models import CadFileEvent, ProposalState, SyncBatch, SyncProposal, SyncSource

IDEMPOTENCY_HEADER = OpenApiParameter(
    "Idempotency-Key",
    str,
    OpenApiParameter.HEADER,
    required=False,
    description="Required with API tokens: a retry with the same key is not applied twice.",
)


class SyncSheetSerializer(serializers.Serializer):
    number = serializers.CharField(max_length=40)
    title = serializers.CharField(max_length=300, allow_blank=True, required=False, default="")
    revision = serializers.CharField(max_length=20, allow_blank=True, required=False, default="")


class SyncRequestSerializer(serializers.Serializer):
    project_code = serializers.CharField(max_length=40)
    source = serializers.ChoiceField(choices=SyncSource.choices)  # type: ignore[assignment]
    model_path = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")
    app_version = serializers.CharField(max_length=60, allow_blank=True, required=False, default="")
    plugin_version = serializers.CharField(
        max_length=30, allow_blank=True, required=False, default=""
    )
    sheets = SyncSheetSerializer(many=True)


class BatchSerializer(serializers.ModelSerializer):
    sent_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = SyncBatch
        fields = [
            "id",
            "source",
            "model_path",
            "app_version",
            "plugin_version",
            "sent_by",
            "counts",
            "created_at",
        ]
        read_only_fields = fields


class ProposalSerializer(serializers.ModelSerializer):
    discipline_code = serializers.CharField(source="discipline.code", default=None, allow_null=True)
    source = serializers.CharField(source="batch.source")  # type: ignore[assignment]
    sent_by = serializers.CharField(source="batch.sent_by.short_name")

    class Meta:
        model = SyncProposal
        fields = [
            "id",
            "kind",
            "number",
            "cad_title",
            "cad_revision",
            "sheet",
            "register_title",
            "register_revision",
            "discipline",
            "discipline_code",
            "state",
            "source",
            "sent_by",
            "created_at",
        ]
        read_only_fields = fields


class DecideSerializer(serializers.Serializer):
    accept = serializers.BooleanField()
    stage = OrgPrimaryKeyRelatedField(queryset=Stage.objects.all(), required=False, allow_null=True)
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), required=False, allow_null=True
    )


class CadSyncView(APIView):
    """F-09: the plugin posts the model's sheet list; the response says what was proposed."""

    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}  # project access checked in service
    token_scopes = ["cad_sync:write"]

    @extend_schema(
        request=SyncRequestSerializer,
        responses={201: BatchSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    @idempotent()
    def post(self, request: Request) -> Response:
        payload = SyncRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        batch = services.receive_sync(acting_user(request), **payload.validated_data)
        return Response(BatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class ProposalListView(ProjectNestedMixin, generics.ListAPIView):
    """Sync proposals screen for the DL (F-09)."""

    serializer_class = ProposalSerializer
    pagination_class = None
    queryset = SyncProposal.objects.none()
    action_permissions = {"GET": Action.EDIT_SHEETS}

    @extend_schema(parameters=[OpenApiParameter("state", str, required=False)])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[SyncProposal]:
        state = self.request.query_params.get("state") or ProposalState.OPEN
        return SyncProposal.objects.filter(project=self.project, state=state).select_related(
            "discipline", "batch__sent_by"
        )


class ProposalDecideView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = ProposalSerializer
    queryset = SyncProposal.objects.none()
    action_permissions = {"POST": Action.EDIT_SHEETS}

    def get_queryset(self) -> QuerySet[SyncProposal]:
        return SyncProposal.objects.filter(project__in=visible_projects(acting_user(self.request)))

    @extend_schema(request=DecideSerializer, responses=ProposalSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = DecideSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        proposal = services.decide(
            acting_user(request),
            self.get_object(),
            d["accept"],
            stage=d.get("stage"),
            discipline=d.get("discipline"),
        )
        return Response(ProposalSerializer(proposal).data)


class FileEventSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=500)
    event = serializers.ChoiceField(
        choices=["created", "modified", "deleted", "renamed"], default="modified"
    )
    at = serializers.DateTimeField(required=False)
    by = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")


class FileEventsRequestSerializer(serializers.Serializer):
    project_code = serializers.CharField(max_length=40)
    connector = serializers.CharField(max_length=60, allow_blank=True, required=False, default="")
    events = FileEventSerializer(many=True)


class FileEventsResultSerializer(serializers.Serializer):
    matched = serializers.IntegerField()
    unmatched = serializers.IntegerField()


class FileEventsView(APIView):
    """I-02: the storage connector reports CAD file activity (no file content is sent)."""

    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}
    token_scopes = ["file_events:write"]

    @extend_schema(
        request=FileEventsRequestSerializer,
        responses={201: FileEventsResultSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    @idempotent()
    def post(self, request: Request) -> Response:
        payload = FileEventsRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        events = [{**e, "at": e["at"].isoformat() if e.get("at") else None} for e in d["events"]]
        result = services.receive_file_events(
            acting_user(request),
            project_code=d["project_code"],
            events=events,
            connector=d["connector"],
        )
        return Response(result, status=status.HTTP_201_CREATED)


class CadEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CadFileEvent
        fields = ["id", "path", "event", "at", "by", "connector"]
        read_only_fields = fields


class SheetCadEventsView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = CadEventSerializer
    pagination_class = None
    queryset = CadFileEvent.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT}

    def get_queryset(self) -> Any:
        from apps.register.selectors import visible_sheets

        return visible_sheets(acting_user(self.request))

    @extend_schema(responses=CadEventSerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        sheet = self.get_object()
        return Response(CadEventSerializer(sheet.cad_events.all()[:50], many=True).data)

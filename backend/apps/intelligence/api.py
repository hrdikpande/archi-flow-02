"""S-23 forecasts panel and F-57 findings (P4). Every response is labelled advisory."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.selectors import visible_projects
from apps.register.selectors import visible_sheets

from . import checks, services
from .models import Finding, FindingStatus, ModelRun, Prediction, WorkloadForecast


class GateSerializer(serializers.Serializer):
    months = serializers.FloatField()
    cycles = serializers.IntegerField()
    needs_months = serializers.IntegerField()
    needs_cycles = serializers.IntegerField()
    met = serializers.BooleanField()


class ModelRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelRun
        fields = [
            "id",
            "kind",
            "status",
            "metrics",
            "training_rows",
            "note",
            "forced",
            "created_at",
        ]
        read_only_fields = fields


class StatusSerializer(serializers.Serializer):
    gate = GateSerializer()
    runs = serializers.DictField(child=ModelRunSerializer())


class ReasonSerializer(serializers.Serializer):
    feature = serializers.CharField()
    text = serializers.CharField()
    effect = serializers.FloatField()


class PredictionSerializer(serializers.ModelSerializer):
    sheet_number = serializers.CharField(source="sheet.number")
    sheet_title = serializers.CharField(source="sheet.title")
    planned_date = serializers.DateField(source="sheet.planned_issue_date", allow_null=True)
    reasons = ReasonSerializer(many=True)
    advisory = serializers.SerializerMethodField()

    class Meta:
        model = Prediction
        fields = [
            "id",
            "sheet",
            "sheet_number",
            "sheet_title",
            "planned_date",
            "score",
            "reasons",
            "advisory",
            "created_at",
        ]
        read_only_fields = fields

    def get_advisory(self, obj: Prediction) -> str:
        return "Forecast: advisory only. It never changes dates or assignments."


class ForecastSerializer(serializers.ModelSerializer):
    discipline_code = serializers.CharField(source="discipline.code")

    class Meta:
        model = WorkloadForecast
        fields = ["discipline", "discipline_code", "week", "hours", "baseline_hours"]
        read_only_fields = fields


class FeedbackSerializer(serializers.Serializer):
    agree = serializers.BooleanField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class FindingSerializer(serializers.ModelSerializer):
    revision_code = serializers.CharField(source="revision.code")
    sheet_number = serializers.CharField(source="sheet.number")
    reviewed_by_detail = UserMiniSerializer(source="reviewed_by", allow_null=True, read_only=True)

    class Meta:
        model = Finding
        fields = [
            "id",
            "sheet",
            "sheet_number",
            "revision",
            "revision_code",
            "rule",
            "message",
            "status",
            "reviewed_by_detail",
            "reviewed_at",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class ReviewFindingSerializer(serializers.Serializer):
    accept = serializers.BooleanField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class RuleEvalSerializer(serializers.Serializer):
    rule = serializers.CharField()
    accepted = serializers.IntegerField()
    rejected = serializers.IntegerField()
    open = serializers.IntegerField()
    precision = serializers.FloatField(allow_null=True)


class EvaluationSerializer(serializers.Serializer):
    labelled_sheets = serializers.IntegerField()
    needed_sheets = serializers.IntegerField()
    precision = serializers.FloatField(allow_null=True)
    rules = RuleEvalSerializer(many=True)
    mode = serializers.CharField()


class ModeSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["off", "evaluation", "on"])


class StatusView(APIView):
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=StatusSerializer)
    def get(self, request: Request) -> Response:
        return Response(StatusSerializer(services.status(acting_user(request))).data)


class ProjectRiskView(ProjectNestedMixin, generics.ListAPIView):
    serializer_class = PredictionSerializer
    pagination_class = None
    queryset = Prediction.objects.none()
    action_permissions = {"GET": Action.VIEW_FORECASTS}

    def get_queryset(self) -> QuerySet[Prediction]:
        return services.project_predictions(acting_user(self.request), self.project)


class PredictionFeedbackView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = FeedbackSerializer
    queryset = Prediction.objects.none()
    action_permissions = {"POST": Action.VIEW_FORECASTS}

    def get_queryset(self) -> QuerySet[Prediction]:
        return Prediction.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")

    @extend_schema(request=FeedbackSerializer, responses={204: None})
    def post(self, request: Request, pk: str) -> Response:
        payload = FeedbackSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        services.feedback(acting_user(request), self.get_object(), **payload.validated_data)
        return Response(status=204)


class WorkloadForecastView(generics.ListAPIView):
    serializer_class = ForecastSerializer
    pagination_class = None
    queryset = WorkloadForecast.objects.none()
    action_permissions = {"GET": Action.VIEW_FORECASTS}

    def get_queryset(self) -> QuerySet[WorkloadForecast]:
        return services.workload_forecast(acting_user(self.request))


class SheetFindingsView(ProjectObjectMixin, generics.GenericAPIView):
    """Findings show on sheets only when the firm has turned checks on (after evaluation)."""

    serializer_class = FindingSerializer
    pagination_class = None
    action_permissions = {"GET": Action.REVIEW_FINDINGS}

    def get_queryset(self) -> Any:
        return visible_sheets(acting_user(self.request)).select_related("project")

    @extend_schema(responses=FindingSerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        sheet = self.get_object()
        mode = checks.evaluation(sheet.organisation_id)["mode"]
        rows = (
            Finding.objects.filter(sheet=sheet).select_related("revision", "sheet", "reviewed_by")
            if mode == "on"
            else []
        )
        return Response(FindingSerializer(rows, many=True).data)


class FindingQueueView(generics.ListAPIView):
    """Evaluation / labelling queue: open findings on the projects where the user reviews."""

    serializer_class = FindingSerializer
    pagination_class = None
    queryset = Finding.objects.none()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    def get_queryset(self) -> QuerySet[Finding]:
        from apps.accounts.roles import ProjectRole
        from apps.projects.models import ProjectMembership

        user = acting_user(self.request)
        projects = ProjectMembership.objects.filter(
            user=user,
            role__in=[ProjectRole.PL, ProjectRole.DL, ProjectRole.SENIOR_REVIEWER, ProjectRole.DC],
        ).values("project_id")
        return Finding.objects.filter(
            project_id__in=projects, status=FindingStatus.OPEN
        ).select_related("revision", "sheet", "reviewed_by")[:200]


class FindingReviewView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = FindingSerializer
    queryset = Finding.objects.none()
    action_permissions = {"POST": Action.REVIEW_FINDINGS}

    def get_queryset(self) -> QuerySet[Finding]:
        return Finding.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")

    @extend_schema(request=ReviewFindingSerializer, responses=FindingSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ReviewFindingSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        f = checks.review_finding(acting_user(request), self.get_object(), **payload.validated_data)
        return Response(FindingSerializer(f).data)


class EvaluationView(APIView):
    action_permissions = {"GET": Action.MANAGE_ORG_SETTINGS, "PUT": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(responses=EvaluationSerializer)
    def get(self, request: Request) -> Response:
        return Response(EvaluationSerializer(checks.evaluation(acting_user(request).org_pk)).data)

    @extend_schema(request=ModeSerializer, responses=EvaluationSerializer)
    def put(self, request: Request) -> Response:
        payload = ModeSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        return Response(
            EvaluationSerializer(
                checks.set_mode(acting_user(request), payload.validated_data["mode"])
            ).data
        )


class RunNowView(APIView):
    action_permissions = {"POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(request=None, responses={202: None})
    def post(self, request: Request) -> Response:
        from .tasks import weekly

        weekly.delay()
        return Response(status=202)

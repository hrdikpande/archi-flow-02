from datetime import date, timedelta
from typing import Any

from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.clock import org_today
from apps.core.models import Discipline
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.models import Project
from apps.projects.selectors import visible_projects
from apps.register.api.serializers import SheetFlagSerializer
from apps.workflow.api.serializers import AllowedActionSerializer

from . import services


class ProjectBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()


class SheetBriefSerializer(serializers.Serializer):
    """A sheet in a dashboard list: enough to show the row and link to it."""

    id = serializers.UUIDField()
    project = serializers.UUIDField(source="project_id")
    project_code = serializers.CharField(source="project.code")
    number = serializers.CharField()
    title = serializers.CharField()
    state = serializers.CharField()
    discipline_code = serializers.CharField(source="discipline.code")
    planned_issue_date = serializers.DateField(allow_null=True)
    owner_name = serializers.SerializerMethodField()
    current_revision_code = serializers.CharField(
        source="current_revision.code", default=None, allow_null=True
    )
    flags = serializers.SerializerMethodField()

    def get_owner_name(self, obj: Any) -> str | None:
        return obj.owner.short_name if obj.owner_id else None

    @extend_schema_field(SheetFlagSerializer(many=True))
    def get_flags(self, obj: Any) -> list[dict[str, Any]]:
        flags = getattr(obj, "open_flags", None)
        if flags is None:
            flags = [f for f in obj.flags.all() if f.cleared_at is None]
        return [
            {
                "kind": f.kind,
                "rule": f.rule,
                "raised_at": f.raised_at,
                "days": f.data.get("days"),
                "escalated": bool(f.data.get("escalated_at")),
            }
            for f in flags
        ]


class StageBriefSerializer(serializers.Serializer):
    seq = serializers.IntegerField()
    name = serializers.CharField()
    state = serializers.CharField()


class LoadCellSerializer(serializers.Serializer):
    week = serializers.DateField()
    planned_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    capacity_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    pct = serializers.IntegerField(allow_null=True)


class DisciplineLoadSerializer(serializers.Serializer):
    discipline = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()
    cells = LoadCellSerializer(many=True)


class PortfolioRowSerializer(serializers.Serializer):
    project = ProjectBriefSerializer()
    stage = StageBriefSerializer(allow_null=True)
    planned = serializers.IntegerField()
    issued = serializers.IntegerField()
    late = serializers.IntegerField()
    at_risk = serializers.IntegerField()
    leads = serializers.ListField(child=serializers.CharField())
    next_stage_date = serializers.DateField(allow_null=True)


class ReadyToInvoiceSerializer(serializers.Serializer):
    stages = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    oldest_days = serializers.IntegerField(allow_null=True)


class PortfolioSerializer(serializers.Serializer):
    updated_at = serializers.DateTimeField(allow_null=True)
    active_projects = serializers.IntegerField()
    late = serializers.IntegerField()
    late_delta = serializers.IntegerField(allow_null=True)
    at_risk = serializers.IntegerField()
    at_risk_delta = serializers.IntegerField(allow_null=True)
    oldest_review_days = serializers.IntegerField(allow_null=True)
    over_allocated_people = serializers.IntegerField()
    projects = PortfolioRowSerializer(many=True)
    discipline_load = DisciplineLoadSerializer(many=True)
    ready_to_invoice = ReadyToInvoiceSerializer()


class DisciplineStatsSerializer(serializers.Serializer):
    discipline = serializers.UUIDField()
    code = serializers.CharField()
    planned = serializers.IntegerField()
    issued = serializers.IntegerField()
    late = serializers.IntegerField()
    at_risk = serializers.IntegerField()
    in_check = serializers.IntegerField()


class BurnUpSeriesSerializer(serializers.Serializer):
    discipline = serializers.CharField()
    planned = serializers.ListField(child=serializers.IntegerField())
    issued = serializers.ListField(child=serializers.IntegerField(allow_null=True))
    total = serializers.IntegerField()


class BurnUpSerializer(serializers.Serializer):
    weeks = serializers.ListField(child=serializers.DateField())
    series = BurnUpSeriesSerializer(many=True)


class LateItemSerializer(serializers.Serializer):
    sheet = SheetBriefSerializer()
    days = serializers.IntegerField()
    owner = serializers.CharField(allow_null=True)


class StageTimelineSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    seq = serializers.IntegerField()
    name = serializers.CharField()
    state = serializers.CharField()
    planned_start = serializers.DateField(allow_null=True)
    planned_end = serializers.DateField(allow_null=True)
    actual_start = serializers.DateField(allow_null=True)
    actual_end = serializers.DateField(allow_null=True)


class TeamLoadSerializer(serializers.Serializer):
    user = UserMiniSerializer()
    planned_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    total_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    capacity_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    pct = serializers.IntegerField(allow_null=True)


class TransmittalBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    purpose = serializers.CharField()
    sent_at = serializers.DateTimeField(allow_null=True)
    sheets = serializers.IntegerField()
    recipients = serializers.IntegerField()


class UnacknowledgedSerializer(serializers.Serializer):
    transmittal = serializers.UUIDField()
    number = serializers.CharField()
    contact = serializers.CharField()
    days = serializers.IntegerField()


class ChangeOrderBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    title = serializers.CharField()
    status = serializers.CharField()
    cost_impact = serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True)
    schedule_impact_days = serializers.IntegerField(allow_null=True)


class ConstructionSummarySerializer(serializers.Serializer):
    open_comments = serializers.IntegerField()
    open_rfis = serializers.IntegerField()
    overdue_rfis = serializers.IntegerField()
    change_orders = ChangeOrderBriefSerializer(many=True)


class ProjectDashboardSerializer(serializers.Serializer):
    updated_at = serializers.DateTimeField(allow_null=True)
    unacknowledged = UnacknowledgedSerializer(many=True)
    construction = ConstructionSummarySerializer()
    by_discipline = DisciplineStatsSerializer(many=True)
    burn_up = BurnUpSerializer()
    late = LateItemSerializer(many=True)
    stages = StageTimelineSerializer(many=True)
    team_this_week = TeamLoadSerializer(many=True)
    transmittals = TransmittalBriefSerializer(many=True)


class AssignmentSerializer(serializers.Serializer):
    owner = UserMiniSerializer(allow_null=True)
    total = serializers.IntegerField()
    by_state = serializers.DictField(child=serializers.IntegerField())
    late = serializers.IntegerField()
    at_risk = serializers.IntegerField()
    next_due = serializers.DateField(allow_null=True)


class CheckQueueItemSerializer(serializers.Serializer):
    sheet = SheetBriefSerializer()
    project_code = serializers.CharField()
    checker = serializers.CharField(allow_null=True)
    owner = serializers.CharField(allow_null=True)
    working_days = serializers.IntegerField()


class PersonLoadSerializer(serializers.Serializer):
    user = UserMiniSerializer()
    cells = LoadCellSerializer(many=True)


class DisciplineBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()


class DisciplineDashboardSerializer(serializers.Serializer):
    discipline = DisciplineBriefSerializer()
    projects = serializers.IntegerField()
    assignments = AssignmentSerializer(many=True)
    check_queue = CheckQueueItemSerializer(many=True)
    capacity = PersonLoadSerializer(many=True)


class DueItemSerializer(serializers.Serializer):
    sheet = SheetBriefSerializer()
    next_action = AllowedActionSerializer(allow_null=True)


class ReturnedItemSerializer(serializers.Serializer):
    sheet = SheetBriefSerializer()
    by = serializers.CharField(allow_null=True)
    at = serializers.DateTimeField(allow_null=True)
    reason = serializers.CharField(allow_blank=True)


class TimesheetStatusSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    state = serializers.CharField()
    logged_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    capacity_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    planned_h = serializers.DecimalField(max_digits=8, decimal_places=1)
    last_week_state = serializers.CharField()


class MyWorkSerializer(serializers.Serializer):
    week = serializers.DateField()
    due = DueItemSerializer(many=True)
    returned = ReturnedItemSerializer(many=True)
    reviews_waiting = serializers.IntegerField()
    oldest_review_days = serializers.IntegerField(allow_null=True)
    timesheet = TimesheetStatusSerializer()
    logs_hours = serializers.BooleanField()
    led_disciplines = DisciplineBriefSerializer(many=True)


class IssuedLateSerializer(serializers.Serializer):
    sheets = serializers.IntegerField()
    late = serializers.IntegerField()
    pct = serializers.FloatField(allow_null=True)


class DaysInCheckSerializer(serializers.Serializer):
    checks = serializers.IntegerField()
    average = serializers.FloatField(allow_null=True)


class HoursRowSerializer(serializers.Serializer):
    project = ProjectBriefSerializer()
    planned_h = serializers.DecimalField(max_digits=10, decimal_places=1)
    logged_h = serializers.DecimalField(max_digits=10, decimal_places=1)
    pct = serializers.IntegerField(allow_null=True)


class InvoiceLagSerializer(serializers.Serializer):
    stages = serializers.IntegerField()
    average_days = serializers.FloatField(allow_null=True)


class BaselineSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()
    issued_late = IssuedLateSerializer()
    days_in_check = DaysInCheckSerializer()
    hours_vs_planned = HoursRowSerializer(many=True)
    invoice_lag = InvoiceLagSerializer()
    definitions = serializers.DictField(child=serializers.CharField())


class HoursReportRowSerializer(serializers.Serializer):
    label = serializers.CharField()  # type: ignore[assignment]
    planned_h = serializers.DecimalField(max_digits=10, decimal_places=1, allow_null=True)
    logged_h = serializers.DecimalField(max_digits=10, decimal_places=1)
    available_h = serializers.DecimalField(max_digits=10, decimal_places=1, allow_null=True)
    pct = serializers.IntegerField(allow_null=True)


class HoursReportSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()
    group = serializers.CharField()
    rows = HoursReportRowSerializer(many=True)


def _period(request: Request, default_days: int = 30) -> tuple[date, date]:
    today = org_today(acting_user(request).org)
    try:
        end = date.fromisoformat(request.query_params.get("to") or today.isoformat())
        start = date.fromisoformat(
            request.query_params.get("from") or (end - timedelta(days=default_days)).isoformat()
        )
    except ValueError as exc:
        raise serializers.ValidationError({"from": "Use YYYY-MM-DD."}) from exc
    if (end - start).days > 3 * 366:
        raise serializers.ValidationError({"from": "Choose a period of up to three years."})
    return start, end


class PortfolioView(APIView):
    """S-03 (D-01, F-22)."""

    action_permissions = {"GET": Action.VIEW_PORTFOLIO}

    @extend_schema(responses=PortfolioSerializer)
    def get(self, request: Request) -> Response:
        return Response(PortfolioSerializer(services.portfolio(acting_user(request))).data)


class ProjectDashboardView(APIView):
    """S-04 (D-02, F-23)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}  # VIEW_PROJECT checked in service

    @extend_schema(responses=ProjectDashboardSerializer)
    def get(self, request: Request, pk: str) -> Response:
        user = acting_user(request)
        project = visible_projects(user).filter(pk=pk).first()
        if project is None:
            raise Http404
        return Response(ProjectDashboardSerializer(services.project_dashboard(user, project)).data)


class DisciplineDashboardView(APIView):
    """D-03 (F-23)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}  # DL/Owner checked in service

    @extend_schema(responses=DisciplineDashboardSerializer)
    def get(self, request: Request, code: str) -> Response:
        user = acting_user(request)
        discipline = get_object_or_404(Discipline, organisation_id=user.org_pk, code__iexact=code)
        data = services.discipline_dashboard(user, discipline)
        return Response(DisciplineDashboardSerializer(data).data)


class MyWorkView(APIView):
    """S-02 (D-04, F-23)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=MyWorkSerializer)
    def get(self, request: Request) -> Response:
        return Response(MyWorkSerializer(services.my_work(acting_user(request))).data)


class BaselineView(APIView):
    """D-05 (F-53): the four baseline metrics for any date range, with definitions."""

    action_permissions = {"GET": Action.VIEW_BASELINE}

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str, required=False),
            OpenApiParameter("to", str, required=False),
        ],
        responses=BaselineSerializer,
    )
    def get(self, request: Request) -> Response:
        start, end = _period(request, 90)
        return Response(
            BaselineSerializer(services.baseline(acting_user(request), start, end)).data
        )


class HoursReportView(APIView):
    """03 §9 reports: hours by project/stage (planned vs actual); utilisation by person or
    discipline."""

    action_permissions = {"GET": Action.VIEW_HOURS_REPORT}

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str, required=False),
            OpenApiParameter("to", str, required=False),
            OpenApiParameter(
                "group", str, enum=["project", "stage", "person", "discipline"], required=False
            ),
        ],
        responses=HoursReportSerializer,
    )
    def get(self, request: Request) -> Response:
        start, end = _period(request, 30)
        group = request.query_params.get("group") or "project"
        if group not in ("project", "stage", "person", "discipline"):
            raise serializers.ValidationError(
                {"group": "Use project, stage, person or discipline."}
            )
        data = services.hours_report(acting_user(request), start, end, group)
        return Response(HoursReportSerializer(data).data)


def project_or_404(request: Request, pk: str) -> Project:
    project = visible_projects(acting_user(request)).filter(pk=pk).first()
    if project is None:
        raise Http404
    return project


class SheetListView(APIView):
    """Late / at-risk / waiting sheets across the viewer's projects: where a portfolio number
    lands ("clicks Late 27 and lands on the filtered register", S6 demo)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}
    LIMIT = 1000

    @extend_schema(
        parameters=[
            OpenApiParameter("flag", str, many=True, required=False, enum=["late", "at_risk"]),
            OpenApiParameter("state", str, many=True, required=False),
            OpenApiParameter("project", str, many=True, required=False),
            OpenApiParameter("discipline", str, many=True, required=False),
            OpenApiParameter("owner", str, required=False),
        ],
        responses=SheetBriefSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        return Response(SheetBriefSerializer(org_sheets(request)[: self.LIMIT], many=True).data)


def org_sheets(request: Request) -> Any:
    from apps.automation.models import Flag
    from apps.register.selectors import open_flags, visible_sheets

    params = request.query_params
    qs = (
        visible_sheets(acting_user(request))
        .select_related("project", "discipline", "owner", "current_revision")
        .prefetch_related(open_flags())
    )
    if flags := params.getlist("flag"):
        qs = qs.filter(
            pk__in=Flag.objects.filter(kind__in=flags, cleared_at__isnull=True).values("sheet_id")
        )
    if states := params.getlist("state"):
        qs = qs.filter(state__in=states)
    if projects := params.getlist("project"):
        qs = qs.filter(project_id__in=projects)
    if disciplines := params.getlist("discipline"):
        qs = qs.filter(discipline_id__in=disciplines)
    if owner := params.get("owner"):
        qs = qs.filter(Q(owner_id=owner))
    return qs.order_by("project__code", "planned_issue_date", "number")

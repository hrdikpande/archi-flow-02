from datetime import date, timedelta
from typing import Any

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.accounts.roles import OrgRole
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.calendar import WorkingCalendar
from apps.core.clock import org_today
from apps.core.models import Discipline
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.models import Project, Stage
from apps.projects.selectors import visible_projects

from . import services
from .models import Allocation, Leave, Timesheet


class StaffSerializer(serializers.Serializer):
    user = UserMiniSerializer()
    org_role = serializers.CharField()
    discipline = serializers.UUIDField(allow_null=True)
    discipline_code = serializers.CharField(allow_null=True)
    team = serializers.CharField(allow_blank=True)
    weekly_capacity_h = serializers.DecimalField(max_digits=4, decimal_places=1)
    cost_rate = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    can_manage = serializers.BooleanField()


class StaffUpdateSerializer(serializers.Serializer):
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )
    team = serializers.CharField(max_length=80, allow_blank=True, required=False)
    weekly_capacity_h = serializers.DecimalField(
        max_digits=4, decimal_places=1, min_value=0, max_value=80, required=False
    )
    cost_rate = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, allow_null=True, required=False
    )


class LeaveSerializer(serializers.ModelSerializer):
    serializer_related_field = OrgPrimaryKeyRelatedField

    class Meta:
        model = Leave
        # No free-text note: leave reasons (e.g. illness) are not collected (docs/privacy.md).
        fields = ["id", "user", "start", "end", "type"]
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        if attrs["end"] < attrs["start"]:
            raise serializers.ValidationError({"end": "Leave ends before it starts."})
        return attrs


class AllocationSerializer(serializers.ModelSerializer):
    project_code = serializers.CharField(source="project.code", read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True)

    class Meta:
        model = Allocation
        fields = [
            "id",
            "user",
            "project",
            "project_code",
            "stage",
            "stage_name",
            "week",
            "planned_h",
        ]
        read_only_fields = fields


class AllocationSetSerializer(serializers.Serializer):
    user = OrgPrimaryKeyRelatedField(queryset=User.objects.all())
    project = OrgPrimaryKeyRelatedField(queryset=Project.objects.all())
    stage = OrgPrimaryKeyRelatedField(queryset=Stage.objects.all())
    weeks = serializers.ListField(child=serializers.DateField(), min_length=1, max_length=52)
    hours = serializers.DecimalField(max_digits=5, decimal_places=1, min_value=0, max_value=100)


class CopyForwardSerializer(serializers.Serializer):
    user = OrgPrimaryKeyRelatedField(queryset=User.objects.all())
    week = serializers.DateField()
    count = serializers.IntegerField(min_value=1, max_value=26)
    project = OrgPrimaryKeyRelatedField(
        queryset=Project.objects.all(), required=False, allow_null=True
    )


class CellSerializer(serializers.Serializer):
    week = serializers.DateField()
    capacity_h = serializers.DecimalField(max_digits=5, decimal_places=1)
    planned_h = serializers.DecimalField(max_digits=6, decimal_places=1)
    pct = serializers.IntegerField(allow_null=True)
    band = serializers.CharField(allow_null=True)


class WorkloadRowSerializer(serializers.Serializer):
    user = UserMiniSerializer()
    discipline = serializers.CharField(allow_null=True)
    cells = CellSerializer(many=True)


class WorkloadSerializer(serializers.Serializer):
    weeks = serializers.ListField(child=serializers.DateField())
    people = WorkloadRowSerializer(many=True)
    over_pct = serializers.IntegerField()
    under_pct = serializers.IntegerField()


class EntrySerializer(serializers.Serializer):
    stage = serializers.UUIDField()
    date = serializers.DateField()
    hours = serializers.DecimalField(max_digits=4, decimal_places=1, min_value=0, max_value=24)
    note = serializers.CharField(max_length=300, allow_blank=True, required=False, default="")


class EntryOutSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    project = serializers.UUIDField(source="project_id")
    stage = serializers.UUIDField(source="stage_id")
    date = serializers.DateField()
    hours = serializers.DecimalField(max_digits=4, decimal_places=1)
    note = serializers.CharField()


class StageOptionSerializer(serializers.Serializer):
    stage = serializers.UUIDField(source="pk")
    stage_name = serializers.CharField(source="name")
    project = serializers.UUIDField(source="project_id")
    project_code = serializers.CharField(source="project.code")
    project_name = serializers.CharField(source="project.name")


class TimesheetSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)
    entries = EntryOutSerializer(many=True, read_only=True)
    approved_by = UserMiniSerializer(read_only=True)
    total_h = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "user",
            "week",
            "state",
            "submitted_at",
            "approved_at",
            "approved_by",
            "return_reason",
            "imported",
            "entries",
            "total_h",
            "can_approve",
        ]
        read_only_fields = fields

    def get_total_h(self, obj: Timesheet) -> str:
        return str(sum((e.hours for e in obj.entries.all()), start=0))

    def get_can_approve(self, obj: Timesheet) -> bool:
        request = self.context.get("request")
        return request is not None and services.can_approve(acting_user(request), obj)


class MyWeekSerializer(serializers.Serializer):
    timesheet = TimesheetSerializer()
    stages = StageOptionSerializer(many=True)
    allocations = AllocationSerializer(many=True)
    working_days = serializers.ListField(child=serializers.DateField())


class ApprovalsSerializer(serializers.Serializer):
    week = serializers.DateField()
    to_approve = TimesheetSerializer(many=True)
    missing = UserMiniSerializer(many=True)


class CopiedSerializer(serializers.Serializer):
    copied = serializers.IntegerField()


class ImportResultSerializer(serializers.Serializer):
    rows = serializers.IntegerField()
    weeks = serializers.IntegerField()
    skipped = serializers.IntegerField()


class ReturnSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)


def _week_param(request: Request, user: User) -> date:
    raw = request.query_params.get("week")
    try:
        return (
            services.monday(date.fromisoformat(raw))
            if raw
            else services.monday(org_today(user.org))
        )
    except ValueError as exc:
        raise serializers.ValidationError({"week": "Use YYYY-MM-DD."}) from exc


def _person(actor: User, user_id: Any) -> User:
    person = User.objects.filter(organisation_id=actor.org_pk, pk=user_id).first()
    if person is None:
        raise Http404
    return person


def _staff_row(actor: User, person: User) -> dict[str, Any]:
    profile = services.profile_for(person)
    return {
        "user": person,
        "org_role": person.org_role,
        "discipline": profile.discipline_id,
        "discipline_code": profile.discipline.code if profile.discipline else None,
        "team": profile.team,
        "weekly_capacity_h": profile.weekly_capacity_h,
        "cost_rate": profile.cost_rate if actor.org_role == OrgRole.ADMIN else None,
        "can_manage": services.can_manage_staff(actor, person),
    }


class StaffListView(APIView):
    """F-16 staff directory: the people the viewer may see (03 §9)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=StaffSerializer(many=True))
    def get(self, request: Request) -> Response:
        actor = acting_user(request)
        people = (
            User.objects.filter(organisation_id=actor.org_pk, is_active=True)
            if actor.org_role == OrgRole.ADMIN
            else services.visible_people(actor)
        )
        people = people.select_related("staff_profile__discipline")
        rows = [_staff_row(actor, p) for p in people.order_by("full_name", "email")]
        return Response(StaffSerializer(rows, many=True).data)


class StaffDetailView(APIView):
    action_permissions = {"PATCH": Action.VIEW_ORG_REFERENCE}  # service checks MANAGE_STAFF

    @extend_schema(request=StaffUpdateSerializer, responses=StaffSerializer)
    def patch(self, request: Request, pk: str) -> Response:
        payload = StaffUpdateSerializer(
            data=request.data, partial=True, context={"request": request}
        )
        payload.is_valid(raise_exception=True)
        actor = acting_user(request)
        person = _person(actor, pk)
        services.update_profile(actor, person, **payload.validated_data)
        person = User.objects.select_related("staff_profile__discipline").get(pk=person.pk)
        return Response(StaffSerializer(_staff_row(actor, person)).data)


class LeaveListView(generics.ListCreateAPIView):
    serializer_class = LeaveSerializer
    pagination_class = None
    queryset = Leave.objects.none()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(parameters=[OpenApiParameter("user", str, required=False)])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Leave]:
        actor = acting_user(self.request)
        qs = Leave.objects.filter(user__in=services.visible_people(actor))
        if user := self.request.query_params.get("user"):
            qs = qs.filter(user_id=user)
        return qs

    def perform_create(self, serializer: Any) -> None:
        actor = acting_user(self.request)
        data = dict(serializer.validated_data)
        person = _person(actor, data.pop("user").pk)
        serializer.instance = services.add_leave(actor, person, **data)


class LeaveDetailView(generics.DestroyAPIView):
    queryset = Leave.objects.none()
    serializer_class = LeaveSerializer
    action_permissions = {"DELETE": Action.VIEW_ORG_REFERENCE}

    def get_queryset(self) -> QuerySet[Leave]:
        return Leave.objects.filter(organisation_id=acting_user(self.request).org_pk)

    def perform_destroy(self, instance: Leave) -> None:
        services.delete_leave(acting_user(self.request), instance)


class AllocationView(APIView):
    """F-17 planned hours: list (people the viewer sees) and set for weeks in one action."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "PUT": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[
            OpenApiParameter("user", str, required=False),
            OpenApiParameter("week", str, required=False),
            OpenApiParameter("project", str, required=False),
        ],
        responses=AllocationSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        actor = acting_user(request)
        qs = Allocation.objects.filter(user__in=services.visible_people(actor)).select_related(
            "project", "stage"
        )
        params = request.query_params
        if u := params.get("user"):
            qs = qs.filter(user_id=u)
        if w := params.get("week"):
            qs = qs.filter(week=services.monday(date.fromisoformat(w)))
        if p := params.get("project"):
            qs = qs.filter(project_id=p)
        return Response(AllocationSerializer(qs.order_by("week", "project__code"), many=True).data)

    @extend_schema(request=AllocationSetSerializer, responses=AllocationSerializer(many=True))
    def put(self, request: Request) -> Response:
        payload = AllocationSetSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        actor = acting_user(request)
        if not visible_projects(actor).filter(pk=d["project"].pk).exists():
            raise Http404
        rows = services.set_allocations(
            actor,
            user=_person(actor, d["user"].pk),
            project=d["project"],
            stage=d["stage"],
            weeks=d["weeks"],
            hours=d["hours"],
        )
        return Response(AllocationSerializer(rows, many=True).data)


class CopyForwardView(APIView):
    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(request=CopyForwardSerializer, responses=CopiedSerializer)
    def post(self, request: Request) -> Response:
        payload = CopyForwardSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        actor = acting_user(request)
        copied = services.copy_forward(
            actor,
            user=_person(actor, d["user"].pk),
            week=d["week"],
            count=d["count"],
            project=d.get("project"),
        )
        return Response({"copied": copied})


class WorkloadView(APIView):
    """S-09 heat map (F-19)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str, required=False),
            OpenApiParameter("to", str, required=False),
            OpenApiParameter("discipline", str, required=False),
        ],
        responses=WorkloadSerializer,
    )
    def get(self, request: Request) -> Response:
        actor = acting_user(request)
        today = org_today(actor.org)
        try:
            start = date.fromisoformat(request.query_params.get("from") or today.isoformat())
            to = request.query_params.get("to")
            end = date.fromisoformat(to) if to else start + timedelta(weeks=7)
        except ValueError as exc:
            raise serializers.ValidationError({"from": "Use YYYY-MM-DD."}) from exc
        data = services.workload(actor, start, end, request.query_params.get("discipline") or None)
        return Response(WorkloadSerializer(data).data)


class MyTimesheetView(APIView):
    """S-10 for the signed-in person: their week, the stages they may log on, allocations."""

    action_permissions = {"GET": Action.LOG_OWN_TIMESHEET}

    @extend_schema(
        parameters=[OpenApiParameter("week", str, required=False)], responses=MyWeekSerializer
    )
    def get(self, request: Request) -> Response:
        actor = acting_user(request)
        week = _week_param(request, actor)
        sheet = services.timesheet_for(actor, week)

        cal = WorkingCalendar.for_org(actor.org, week, week + timedelta(days=6))
        return Response(
            MyWeekSerializer(
                {
                    "timesheet": sheet,
                    "stages": services.allowed_stages(actor, week),
                    "allocations": Allocation.objects.filter(user=actor, week=week).select_related(
                        "project", "stage"
                    ),
                    "working_days": [
                        week + timedelta(days=i)
                        for i in range(7)
                        if cal.is_working_day(week + timedelta(days=i))
                    ],
                },
                context={"request": request},
            ).data
        )


class _TimesheetObject(generics.GenericAPIView):
    queryset = Timesheet.objects.none()
    serializer_class = TimesheetSerializer

    def get_queryset(self) -> QuerySet[Timesheet]:
        actor = acting_user(self.request)
        return Timesheet.objects.filter(user__in=services.visible_people(actor)).prefetch_related(
            "entries"
        )


class TimesheetEntriesView(_TimesheetObject):
    action_permissions = {"PUT": Action.LOG_OWN_TIMESHEET}

    @extend_schema(request=EntrySerializer(many=True), responses=TimesheetSerializer)
    def put(self, request: Request, pk: str) -> Response:
        payload = EntrySerializer(data=request.data, many=True, context={"request": request})
        payload.is_valid(raise_exception=True)
        sheet = services.save_entries(
            acting_user(request), self.get_object(), list(payload.validated_data)
        )
        return Response(
            TimesheetSerializer(
                Timesheet.objects.get(pk=sheet.pk), context={"request": request}
            ).data
        )


class TimesheetSubmitView(_TimesheetObject):
    action_permissions = {"POST": Action.LOG_OWN_TIMESHEET}

    @extend_schema(request=None, responses=TimesheetSerializer)
    def post(self, request: Request, pk: str) -> Response:
        sheet = services.submit(acting_user(request), self.get_object())
        return Response(TimesheetSerializer(sheet, context={"request": request}).data)


class TimesheetApproveView(_TimesheetObject):
    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}  # approver checked in service

    @extend_schema(request=None, responses=TimesheetSerializer)
    def post(self, request: Request, pk: str) -> Response:
        sheet = services.approve(acting_user(request), self.get_object())
        return Response(TimesheetSerializer(sheet, context={"request": request}).data)


class TimesheetReturnView(_TimesheetObject):
    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(request=ReturnSerializer, responses=TimesheetSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ReturnSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        sheet = services.return_sheet(
            acting_user(request), self.get_object(), payload.validated_data["reason"]
        )
        return Response(TimesheetSerializer(sheet, context={"request": request}).data)


class ApprovalsView(APIView):
    """DL view (S-10): submitted weeks to approve, and who has not submitted."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[OpenApiParameter("week", str, required=False)], responses=ApprovalsSerializer
    )
    def get(self, request: Request) -> Response:
        actor = acting_user(request)
        week = (
            _week_param(request, actor)
            if request.query_params.get("week")
            else (services.monday(org_today(actor.org)) - timedelta(weeks=1))
        )
        return Response(
            {
                "week": week,
                "to_approve": TimesheetSerializer(
                    services.approvals_for(actor), many=True, context={"request": request}
                ).data,
                "missing": UserMiniSerializer(services.missing_for(actor, week), many=True).data,
            }
        )


class TimesheetImportView(APIView):
    """DEC-03: import hours from the firm's existing timesheet tool (Admin)."""

    parser_classes = [MultiPartParser]
    action_permissions = {"POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"file": {"type": "string", "format": "binary"}},
            }
        },
        responses=ImportResultSerializer,
    )
    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            raise serializers.ValidationError({"file": "Choose a CSV file."})
        result = services.import_csv(acting_user(request), upload.read())
        return Response(result, status=status.HTTP_200_OK)

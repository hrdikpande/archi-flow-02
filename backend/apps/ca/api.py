"""S-20 construction-administration logs (P3): RFIs, submittals, site reports, change orders."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.contacts.models import Contact
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.files.links import AttachmentLinkSerializer, SheetRefSerializer, link, links
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet

from . import services
from .models import ChangeOrder, Rfi, SiteObservation, SiteReport, Submittal, SubmittalStatus

SHEETS = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)


def _user_field() -> Any:
    return OrgPrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)


def _contact_field() -> Any:
    return OrgPrimaryKeyRelatedField(
        queryset=Contact.objects.all(), allow_null=True, required=False
    )


class UploadIdsField(serializers.ListField):
    child = serializers.UUIDField()


class RevisionResultSerializer(serializers.Serializer):
    revisions_started = serializers.ListField(child=serializers.CharField())
    skipped = serializers.ListField(child=serializers.CharField())


# --- RFIs -----------------------------------------------------------------------------------


class RfiSerializer(serializers.ModelSerializer):
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    assignee = _user_field()
    assignee_detail = UserMiniSerializer(source="assignee", read_only=True, allow_null=True)
    responded_by_detail = UserMiniSerializer(source="responded_by", read_only=True, allow_null=True)
    raised_by = _contact_field()
    attachment_ids = UploadIdsField(write_only=True, required=False)
    attachment_links = serializers.SerializerMethodField()

    class Meta:
        model = Rfi
        fields = [
            "id",
            "number",
            "subject",
            "question",
            "raised_by",
            "raised_by_name",
            "received_on",
            "due_on",
            "ball_in_court",
            "assignee",
            "assignee_detail",
            "status",
            "response",
            "responded_at",
            "responded_by_detail",
            "cost_impact",
            "schedule_impact",
            "sheets",
            "sheet_refs",
            "attachment_ids",
            "attachment_links",
            "created_at",
        ]
        read_only_fields = ["id", "number", "status", "response", "responded_at", "created_at"]

    @extend_schema_field(AttachmentLinkSerializer(many=True))
    def get_attachment_links(self, obj: Rfi) -> list[dict[str, Any]]:
        return links(self.context.get("request"), obj.attachments.all())


class RfiRespondSerializer(serializers.Serializer):
    response = serializers.CharField(max_length=20000)
    revise_sheets = SHEETS


class CloseSerializer(serializers.Serializer):
    void = serializers.BooleanField(default=False)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class _ProjectList(ProjectNestedMixin, generics.ListCreateAPIView):
    pagination_class = None
    model: type[Any]

    def get_queryset(self) -> QuerySet[Any]:
        return services.visible(
            self.model, acting_user(self.request), self.project
        ).prefetch_related("sheets")


class _Object(ProjectObjectMixin, generics.RetrieveUpdateAPIView):
    model: type[Any]
    http_method_names = ["get", "patch"]

    def get_queryset(self) -> QuerySet[Any]:
        return self.model.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")


class RfiListView(_ProjectList):
    model = Rfi
    serializer_class = RfiSerializer
    queryset = Rfi.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.MANAGE_CA}

    def perform_create(self, serializer: Any) -> None:
        d = dict(serializer.validated_data)
        serializer.instance = services.create_rfi(
            acting_user(self.request), self.project, attachment_ids=d.pop("attachment_ids", []), **d
        )


class RfiDetailView(_Object):
    model = Rfi
    serializer_class = RfiSerializer
    queryset = Rfi.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "PATCH": Action.MANAGE_CA}

    def perform_update(self, serializer: Any) -> None:
        d = dict(serializer.validated_data)
        d.pop("attachment_ids", None)
        serializer.instance = services.update_rfi(
            acting_user(self.request), serializer.instance, **d
        )


class RfiRespondView(_Object):
    model = Rfi
    serializer_class = RevisionResultSerializer
    queryset = Rfi.objects.none()
    action_permissions = {"POST": Action.VIEW_PROJECT}  # assignee or PL/DL/DC: service checks
    http_method_names = ["post"]

    @extend_schema(request=RfiRespondSerializer, responses=RevisionResultSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = RfiRespondSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        result = services.respond_rfi(
            acting_user(request),
            self.get_object(),
            payload.validated_data["response"],
            payload.validated_data.get("revise_sheets", []),
        )
        return Response(RevisionResultSerializer(result).data)


class RfiCloseView(_Object):
    model = Rfi
    serializer_class = RfiSerializer
    queryset = Rfi.objects.none()
    action_permissions = {"POST": Action.MANAGE_CA}
    http_method_names = ["post"]

    @extend_schema(request=CloseSerializer, responses=RfiSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = CloseSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        rfi = services.close_rfi(
            acting_user(request),
            self.get_object(),
            payload.validated_data["void"],
            payload.validated_data.get("reason", ""),
        )
        return Response(RfiSerializer(rfi, context={"request": request}).data)


# --- Submittals -----------------------------------------------------------------------------


class SubmittalSerializer(serializers.ModelSerializer):
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    reviewer = _user_field()
    reviewer_detail = UserMiniSerializer(source="reviewer", read_only=True, allow_null=True)
    reviewed_by_detail = UserMiniSerializer(source="reviewed_by", read_only=True, allow_null=True)
    submitted_by = _contact_field()
    file_upload = serializers.UUIDField(write_only=True)
    ball_in_court = serializers.SerializerMethodField()
    file_link = serializers.SerializerMethodField()
    stamped_link = serializers.SerializerMethodField()

    class Meta:
        model = Submittal
        fields = [
            "id",
            "number",
            "title",
            "kind",
            "spec_section",
            "submitted_by",
            "submitted_by_name",
            "received_on",
            "due_on",
            "round",
            "reviewer",
            "reviewer_detail",
            "status",
            "review_comment",
            "reviewed_at",
            "reviewed_by_detail",
            "ball_in_court",
            "sheets",
            "sheet_refs",
            "file_upload",
            "file_link",
            "stamped_link",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "round",
            "status",
            "review_comment",
            "reviewed_at",
            "created_at",
        ]

    @extend_schema_field(serializers.CharField(allow_blank=True))
    def get_ball_in_court(self, obj: Submittal) -> str:
        return services.ball_in_court(obj)

    @extend_schema_field(AttachmentLinkSerializer(allow_null=True))
    def get_file_link(self, obj: Submittal) -> Any:
        return link(self.context.get("request"), obj.file)

    @extend_schema_field(AttachmentLinkSerializer(allow_null=True))
    def get_stamped_link(self, obj: Submittal) -> Any:
        return link(self.context.get("request"), obj.stamped_file)


class ReviewSubmittalSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[c for c in SubmittalStatus.values if c != SubmittalStatus.PENDING]
    )
    comment = serializers.CharField(required=False, allow_blank=True, max_length=10000)


class ResubmitSerializer(serializers.Serializer):
    file_upload = serializers.UUIDField()


class SubmittalListView(_ProjectList):
    model = Submittal
    serializer_class = SubmittalSerializer
    queryset = Submittal.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.MANAGE_CA}

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_submittal(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class SubmittalDetailView(_Object):
    model = Submittal
    serializer_class = SubmittalSerializer
    queryset = Submittal.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT}
    http_method_names = ["get"]


class SubmittalReviewView(_Object):
    model = Submittal
    serializer_class = SubmittalSerializer
    queryset = Submittal.objects.none()
    action_permissions = {"POST": Action.REVIEW_SUBMITTAL}
    http_method_names = ["post"]

    @extend_schema(request=ReviewSubmittalSerializer, responses=SubmittalSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ReviewSubmittalSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        sub = services.review_submittal(
            acting_user(request), self.get_object(), **payload.validated_data
        )
        return Response(SubmittalSerializer(sub, context={"request": request}).data)


class SubmittalResubmitView(_Object):
    model = Submittal
    serializer_class = SubmittalSerializer
    queryset = Submittal.objects.none()
    action_permissions = {"POST": Action.MANAGE_CA}
    http_method_names = ["post"]

    @extend_schema(request=ResubmitSerializer, responses=SubmittalSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ResubmitSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        sub = services.resubmit(
            acting_user(request), self.get_object(), payload.validated_data["file_upload"]
        )
        return Response(SubmittalSerializer(sub, context={"request": request}).data)


# --- Site reports ---------------------------------------------------------------------------


class ObservationSerializer(serializers.ModelSerializer):
    sheet_number = serializers.CharField(source="sheet.number", read_only=True, default=None)
    photo_links = serializers.SerializerMethodField()

    class Meta:
        model = SiteObservation
        fields = [
            "id",
            "seq",
            "text",
            "sheet",
            "sheet_number",
            "action",
            "action_owner",
            "photo_links",
        ]
        read_only_fields = fields

    @extend_schema_field(AttachmentLinkSerializer(many=True))
    def get_photo_links(self, obj: SiteObservation) -> list[dict[str, Any]]:
        return links(self.context.get("request"), obj.photos.all())


class SiteReportSerializer(serializers.ModelSerializer):
    created_by_detail = UserMiniSerializer(source="created_by", read_only=True, allow_null=True)
    observation_count = serializers.IntegerField(source="observations.count", read_only=True)
    pdf_link = serializers.SerializerMethodField()

    class Meta:
        model = SiteReport
        fields = [
            "id",
            "number",
            "visit_date",
            "attendees",
            "weather",
            "summary",
            "state",
            "filed_at",
            "created_by_detail",
            "observation_count",
            "pdf_link",
            "created_at",
        ]
        read_only_fields = ["id", "number", "state", "filed_at", "created_at"]

    @extend_schema_field(AttachmentLinkSerializer(allow_null=True))
    def get_pdf_link(self, obj: SiteReport) -> Any:
        return link(self.context.get("request"), obj.pdf)


class SiteReportDetailSerializer(SiteReportSerializer):
    observations = ObservationSerializer(many=True, read_only=True)

    class Meta(SiteReportSerializer.Meta):
        fields = [*SiteReportSerializer.Meta.fields, "observations"]


class ObservationCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    sheet = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), allow_null=True, required=False)
    action = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    action_owner = serializers.CharField(required=False, allow_blank=True, max_length=12)
    photo_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class SiteReportListView(_ProjectList):
    model = SiteReport
    serializer_class = SiteReportSerializer
    queryset = SiteReport.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.FILE_SITE_REPORT}

    def get_queryset(self) -> QuerySet[Any]:
        return services.visible(SiteReport, acting_user(self.request), self.project).select_related(
            "created_by"
        )

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_report(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class SiteReportDetailView(_Object):
    model = SiteReport
    serializer_class = SiteReportDetailSerializer
    queryset = SiteReport.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "PATCH": Action.FILE_SITE_REPORT}

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_report(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )


class ObservationAddView(_Object):
    model = SiteReport
    serializer_class = ObservationSerializer
    queryset = SiteReport.objects.none()
    action_permissions = {"POST": Action.FILE_SITE_REPORT}
    http_method_names = ["post"]

    @extend_schema(request=ObservationCreateSerializer, responses={201: ObservationSerializer})
    def post(self, request: Request, pk: str) -> Response:
        payload = ObservationCreateSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        obs = services.add_observation(
            acting_user(request), self.get_object(), **payload.validated_data
        )
        return Response(
            ObservationSerializer(obs, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ObservationDeleteView(ProjectObjectMixin, generics.DestroyAPIView):
    serializer_class = ObservationSerializer
    queryset = SiteObservation.objects.none()
    project_path = "report__project"
    action_permissions = {"DELETE": Action.FILE_SITE_REPORT}

    def get_queryset(self) -> QuerySet[SiteObservation]:
        return SiteObservation.objects.filter(
            report__project__in=visible_projects(acting_user(self.request))
        ).select_related("report__project")

    def perform_destroy(self, instance: SiteObservation) -> None:
        services.remove_observation(acting_user(self.request), instance)


class SiteReportFileView(_Object):
    model = SiteReport
    serializer_class = SiteReportSerializer
    queryset = SiteReport.objects.none()
    action_permissions = {"POST": Action.FILE_SITE_REPORT}
    http_method_names = ["post"]

    @extend_schema(request=None, responses=SiteReportSerializer)
    def post(self, request: Request, pk: str) -> Response:
        report = services.file_report(acting_user(request), self.get_object())
        return Response(SiteReportSerializer(report, context={"request": request}).data)


# --- Change orders --------------------------------------------------------------------------


class ChangeOrderSerializer(serializers.ModelSerializer):
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    rfi = OrgPrimaryKeyRelatedField(queryset=Rfi.objects.all(), allow_null=True, required=False)
    rfi_number = serializers.CharField(source="rfi.number", read_only=True, default=None)
    decided_by_detail = UserMiniSerializer(source="decided_by", read_only=True, allow_null=True)

    class Meta:
        model = ChangeOrder
        fields = [
            "id",
            "number",
            "title",
            "description",
            "origin",
            "rfi",
            "rfi_number",
            "cost_impact",
            "schedule_impact_days",
            "status",
            "decided_at",
            "decided_by_detail",
            "decision_note",
            "revision_cycle_started",
            "sheets",
            "sheet_refs",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "status",
            "decided_at",
            "decision_note",
            "revision_cycle_started",
            "created_at",
        ]


class ChangeOrderDecisionSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class ChangeOrderListView(_ProjectList):
    model = ChangeOrder
    serializer_class = ChangeOrderSerializer
    queryset = ChangeOrder.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.MANAGE_CA}

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_change_order(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class ChangeOrderDetailView(_Object):
    model = ChangeOrder
    serializer_class = ChangeOrderSerializer
    queryset = ChangeOrder.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT}
    http_method_names = ["get"]


class ChangeOrderDecideView(_Object):
    model = ChangeOrder
    serializer_class = ChangeOrderSerializer
    queryset = ChangeOrder.objects.none()
    action_permissions = {"POST": Action.APPROVE_CHANGE_ORDER}
    http_method_names = ["post"]

    @extend_schema(request=ChangeOrderDecisionSerializer, responses=ChangeOrderSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ChangeOrderDecisionSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        co = services.decide_change_order(
            acting_user(request),
            self.get_object(),
            payload.validated_data["approve"],
            payload.validated_data.get("note", ""),
        )
        return Response(ChangeOrderSerializer(co).data)


class ChangeOrderRevisionsView(_Object):
    model = ChangeOrder
    serializer_class = RevisionResultSerializer
    queryset = ChangeOrder.objects.none()
    action_permissions = {"POST": Action.MANAGE_CA}
    http_method_names = ["post"]

    @extend_schema(request=None, responses=RevisionResultSerializer)
    def post(self, request: Request, pk: str) -> Response:
        result = services.start_revision_cycle(acting_user(request), self.get_object())
        return Response(RevisionResultSerializer(result).data)

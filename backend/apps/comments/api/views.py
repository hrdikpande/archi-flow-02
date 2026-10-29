"""S-16 client comments log, email review queue, stage approvals (P2)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.contacts.models import Contact
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.files.links import AttachmentLinkSerializer, SheetRefSerializer
from apps.files.links import links as _links
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.models import Stage
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet

from .. import inbound, services
from ..models import ClientApproval, ClientComment, CommentSource, InboundEmail


class CommentSerializer(serializers.ModelSerializer):
    assignee_detail = UserMiniSerializer(source="assignee", read_only=True, allow_null=True)
    responded_by_detail = UserMiniSerializer(source="responded_by", read_only=True, allow_null=True)
    sheet_refs = SheetRefSerializer(source="sheets", many=True, read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True, default=None)
    attachment_links = serializers.SerializerMethodField()
    email_id = serializers.SerializerMethodField()
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    stage = OrgPrimaryKeyRelatedField(queryset=Stage.objects.all(), allow_null=True, required=False)
    assignee = OrgPrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )
    from_contact = OrgPrimaryKeyRelatedField(
        queryset=Contact.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = ClientComment
        fields = [
            "id",
            "number",
            "source",
            "received_on",
            "from_name",
            "from_contact",
            "subject",
            "body",
            "sheets",
            "sheet_refs",
            "stage",
            "stage_name",
            "assignee",
            "assignee_detail",
            "status",
            "response",
            "responded_at",
            "responded_by_detail",
            "reject_reason",
            "closed_at",
            "attachment_links",
            "email_id",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "status",
            "responded_at",
            "reject_reason",
            "closed_at",
            "created_at",
        ]

    @extend_schema_field(AttachmentLinkSerializer(many=True))
    def get_attachment_links(self, obj: ClientComment) -> list[dict[str, Any]]:
        return _links(self.context.get("request"), obj.attachments.all())

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_email_id(self, obj: ClientComment) -> Any:
        email = getattr(obj, "email", None)
        return email.pk if email else None


class CommentUpdateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=["respond", "close", "reject", "reopen"], required=False
    )
    assignee = OrgPrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )
    sheets = OrgPrimaryKeyRelatedField(queryset=Sheet.objects.all(), many=True, required=False)
    stage = OrgPrimaryKeyRelatedField(queryset=Stage.objects.all(), allow_null=True, required=False)
    response = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    reject_reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    source = serializers.ChoiceField(choices=CommentSource.choices, required=False)  # type: ignore[assignment]
    received_on = serializers.DateField(required=False)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=300)
    body = serializers.CharField(required=False, max_length=20000)


class UploadIdsSerializer(serializers.Serializer):
    upload_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=20)


def _org_scoped(actor: User, data: dict[str, Any]) -> None:
    for key in ("assignee", "from_contact"):
        obj = data.get(key)
        if obj is not None and obj.organisation_id != actor.organisation_id:
            raise serializers.ValidationError({key: "Unknown."})


class CommentListView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    pagination_class = None
    queryset = ClientComment.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.LOG_CLIENT_COMMENTS}

    @extend_schema(
        parameters=[
            OpenApiParameter("status", str, many=True, required=False),
            OpenApiParameter("sheet", str, required=False),
        ]
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[ClientComment]:
        qs = services.visible_comments(acting_user(self.request), self.project).select_related(
            "email"
        )
        if statuses := self.request.query_params.getlist("status"):
            qs = qs.filter(status__in=statuses)
        if sheet := self.request.query_params.get("sheet"):
            qs = qs.filter(sheets__id=sheet)
        return qs

    def perform_create(self, serializer: Any) -> None:
        actor = acting_user(self.request)
        data = dict(serializer.validated_data)
        _org_scoped(actor, data)
        serializer.instance = services.log_comment(actor, self.project, **data)


class CommentDetailView(ProjectObjectMixin, generics.RetrieveAPIView):
    serializer_class = CommentSerializer
    queryset = ClientComment.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT, "PATCH": Action.VIEW_PROJECT}

    def get_queryset(self) -> QuerySet[ClientComment]:
        return ClientComment.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")

    @extend_schema(request=CommentUpdateSerializer, responses=CommentSerializer)
    def patch(self, request: Request, pk: str) -> Response:
        payload = CommentUpdateSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        actor = acting_user(request)
        _org_scoped(actor, payload.validated_data)
        comment = services.update_comment(actor, self.get_object(), **payload.validated_data)
        return Response(CommentSerializer(comment, context={"request": request}).data)


class CommentAttachmentsView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = CommentSerializer
    queryset = ClientComment.objects.none()
    action_permissions = {"POST": Action.VIEW_PROJECT}  # assignee or PL/DL/DC: service checks

    def get_queryset(self) -> QuerySet[ClientComment]:
        return ClientComment.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project")

    @extend_schema(request=UploadIdsSerializer, responses=CommentSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = UploadIdsSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        comment = services.attach(
            acting_user(request), self.get_object(), payload.validated_data["upload_ids"]
        )
        return Response(CommentSerializer(comment, context={"request": request}).data)


class InboundEmailSerializer(serializers.ModelSerializer):
    attachment_links = serializers.SerializerMethodField()
    raw_url = serializers.SerializerMethodField()
    comment_number = serializers.CharField(source="comment.number", default=None, read_only=True)

    class Meta:
        model = InboundEmail
        fields = [
            "id",
            "from_address",
            "from_name",
            "subject",
            "text",
            "received_at",
            "state",
            "comment",
            "comment_number",
            "attachment_links",
            "raw_url",
        ]
        read_only_fields = fields

    @extend_schema_field(AttachmentLinkSerializer(many=True))
    def get_attachment_links(self, obj: InboundEmail) -> list[dict[str, Any]]:
        return _links(self.context.get("request"), obj.attachments.all())

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_raw_url(self, obj: InboundEmail) -> str | None:
        if obj.raw is None:
            return None
        return _links(self.context.get("request"), [obj.raw])[0]["url"]


class InboundEmailListView(ProjectNestedMixin, generics.ListAPIView):
    """Emails to the project address; `state=review` is the unknown-sender queue."""

    serializer_class = InboundEmailSerializer
    pagination_class = None
    queryset = InboundEmail.objects.none()
    action_permissions = {"GET": Action.LOG_CLIENT_COMMENTS}

    @extend_schema(parameters=[OpenApiParameter("state", str, required=False)])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[InboundEmail]:
        qs = InboundEmail.objects.filter(project=self.project).select_related("comment", "raw")
        if state := self.request.query_params.get("state"):
            qs = qs.filter(state=state)
        return qs[:200]


class ReviewEmailSerializer(serializers.Serializer):
    accept = serializers.BooleanField()


class InboundEmailReviewView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = InboundEmailSerializer
    queryset = InboundEmail.objects.none()
    action_permissions = {"POST": Action.LOG_CLIENT_COMMENTS}

    def get_queryset(self) -> QuerySet[InboundEmail]:
        return InboundEmail.objects.filter(project__in=visible_projects(acting_user(self.request)))

    @extend_schema(request=ReviewEmailSerializer, responses=InboundEmailSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = ReviewEmailSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        email = inbound.review(
            acting_user(request), self.get_object(), payload.validated_data["accept"]
        )
        return Response(InboundEmailSerializer(email, context={"request": request}).data)


class ApprovalSerializer(serializers.ModelSerializer):
    evidence_link = serializers.SerializerMethodField()
    recorded_by_detail = UserMiniSerializer(source="recorded_by", read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True)

    class Meta:
        model = ClientApproval
        fields = [
            "id",
            "stage",
            "stage_name",
            "approved_by",
            "approved_on",
            "note",
            "evidence_link",
            "recorded_by_detail",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(AttachmentLinkSerializer)
    def get_evidence_link(self, obj: ClientApproval) -> dict[str, Any]:
        return _links(self.context.get("request"), [obj.evidence])[0]


class RecordApprovalSerializer(serializers.Serializer):
    approved_by = serializers.CharField(max_length=200)
    approved_on = serializers.DateField()
    evidence_upload_id = serializers.UUIDField()
    approved_contact = OrgPrimaryKeyRelatedField(
        queryset=Contact.objects.all(), allow_null=True, required=False
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ApprovalListView(ProjectNestedMixin, generics.ListAPIView):
    serializer_class = ApprovalSerializer
    pagination_class = None
    queryset = ClientApproval.objects.none()
    action_permissions = {"GET": Action.VIEW_STAGE_DATA}

    def get_queryset(self) -> QuerySet[ClientApproval]:
        return ClientApproval.objects.filter(stage__project=self.project).select_related(
            "stage", "evidence", "recorded_by"
        )


class StageApprovalView(ProjectObjectMixin, generics.GenericAPIView):
    """F-26: record the client's approval of a stage, with evidence."""

    serializer_class = ApprovalSerializer
    queryset = Stage.objects.none()
    action_permissions = {"POST": Action.RECORD_CLIENT_APPROVAL}

    def get_queryset(self) -> QuerySet[Stage]:
        return Stage.objects.filter(project__in=visible_projects(acting_user(self.request)))

    @extend_schema(request=RecordApprovalSerializer, responses={201: ApprovalSerializer})
    def post(self, request: Request, pk: str) -> Response:
        payload = RecordApprovalSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = dict(payload.validated_data)
        actor = acting_user(request)
        _org_scoped(actor, {"from_contact": d.get("approved_contact")})
        approval = services.record_approval(
            actor, self.get_object(), evidence_upload=d.pop("evidence_upload_id"), **d
        )
        return Response(
            ApprovalSerializer(approval, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

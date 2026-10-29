from typing import Any

from django.db.models import Count, QuerySet
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.files import storage
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet
from apps.register.selectors import visible_sheets

from . import services
from .models import Transmittal, TransmittalRecipient


class IssueRequestSerializer(serializers.Serializer):
    sheet_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=2000)
    purpose = serializers.CharField(max_length=6)
    suitability = serializers.CharField(max_length=6, required=False, allow_blank=True)
    contact_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    hand_contact_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    supersedes = serializers.UUIDField(required=False, allow_null=True)
    override_reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class BlockedSerializer(serializers.Serializer):
    sheet_id = serializers.UUIDField()
    number = serializers.CharField()
    reason = serializers.CharField()


class PreviewSerializer(serializers.Serializer):
    summary = serializers.CharField()
    issue_count = serializers.IntegerField()
    recipient_count = serializers.IntegerField()
    superseded_count = serializers.IntegerField()
    previous_recipient_count = serializers.IntegerField()
    blocked = BlockedSerializer(many=True)
    next_number = serializers.CharField()


class RecipientSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source="contact.full_name")
    contact_email = serializers.CharField(source="contact.email")
    organisation = serializers.CharField(source="contact.external_org.name", default="")
    link_expires_at = serializers.DateTimeField(source="link.expires_at", default=None)

    class Meta:
        model = TransmittalRecipient
        fields = [
            "id",
            "contact",
            "contact_name",
            "contact_email",
            "organisation",
            "delivery",
            "delivered_at",
            "bounced_at",
            "bounce_reason",
            "last_downloaded_at",
            "link_expires_at",
            "acknowledged_at",
        ]
        read_only_fields = fields


class ItemSerializer(serializers.Serializer):
    revision_id = serializers.UUIDField(source="revision.id")
    sheet_id = serializers.UUIDField(source="revision.sheet_id")
    number = serializers.CharField(source="revision.sheet.number")
    title = serializers.CharField(source="revision.sheet.title")
    revision = serializers.CharField(source="revision.code")
    revision_state = serializers.CharField(source="revision.state")


class TransmittalSerializer(serializers.ModelSerializer):
    sent_by = UserMiniSerializer(read_only=True)
    purpose_label = serializers.SerializerMethodField()
    sheet_count = serializers.IntegerField(read_only=True, default=0)
    recipient_count = serializers.IntegerField(read_only=True, default=0)
    has_cover = serializers.SerializerMethodField()
    supersedes_number = serializers.CharField(source="supersedes.number", default=None)

    class Meta:
        model = Transmittal
        fields = [
            "id",
            "project",
            "number",
            "purpose",
            "purpose_label",
            "suitability",
            "note",
            "sent_at",
            "sent_by",
            "sheet_count",
            "recipient_count",
            "has_cover",
            "supersedes",
            "supersedes_number",
            "override_reason",
        ]
        read_only_fields = fields

    def get_purpose_label(self, obj: Transmittal) -> str:
        return services.purpose_label(obj.organisation_id, obj.purpose)

    def get_has_cover(self, obj: Transmittal) -> bool:
        return obj.cover_file_id is not None


class TransmittalDetailSerializer(TransmittalSerializer):
    items = ItemSerializer(many=True, read_only=True)
    recipients = RecipientSerializer(many=True, read_only=True)

    class Meta(TransmittalSerializer.Meta):
        fields = [*TransmittalSerializer.Meta.fields, "items", "recipients"]
        read_only_fields = fields


class DistributionRowSerializer(serializers.Serializer):
    contact = serializers.CharField()
    organisation = serializers.CharField(allow_blank=True)
    revision = serializers.CharField()
    revision_state = serializers.CharField()
    transmittal = serializers.CharField()
    sent_at = serializers.DateTimeField()
    delivery = serializers.CharField()
    downloaded_at = serializers.DateTimeField(allow_null=True)


def _issue_kwargs(project: Any, data: dict[str, Any]) -> dict[str, Any]:
    supersedes = None
    if data.get("supersedes"):
        supersedes = Transmittal.objects.filter(project=project, pk=data["supersedes"]).first()
    return {
        "sheet_ids": data["sheet_ids"],
        "purpose": data["purpose"],
        "contact_ids": data["contact_ids"],
        "hand_contact_ids": data.get("hand_contact_ids", []),
        "suitability": data.get("suitability", ""),
        "note": data.get("note", ""),
        "supersedes": supersedes,
        "override_reason": data.get("override_reason", ""),
    }


class TransmittalListView(ProjectNestedMixin, generics.GenericAPIView):
    """Transmittal log per project (03 §8) and issuing (S-07)."""

    serializer_class = TransmittalSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.ISSUE_SHEETS}

    @extend_schema(responses=TransmittalSerializer(many=True))
    def get(self, request: Request, project_pk: str) -> Response:
        qs = self.project.transmittals.select_related("sent_by", "supersedes").annotate(
            sheet_count=Count("items", distinct=True),
            recipient_count=Count("recipients", distinct=True),
        )
        return Response(TransmittalSerializer(qs, many=True).data)

    @extend_schema(request=IssueRequestSerializer, responses={201: TransmittalDetailSerializer})
    def post(self, request: Request, project_pk: str) -> Response:
        payload = IssueRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        transmittal = services.issue(
            acting_user(request),
            self.project,
            **_issue_kwargs(self.project, payload.validated_data),
        )
        return Response(
            TransmittalDetailSerializer(transmittal).data, status=status.HTTP_201_CREATED
        )


class TransmittalPreviewView(ProjectNestedMixin, generics.GenericAPIView):
    serializer_class = PreviewSerializer
    action_permissions = {"POST": Action.ISSUE_SHEETS}

    @extend_schema(request=IssueRequestSerializer, responses=PreviewSerializer)
    def post(self, request: Request, project_pk: str) -> Response:
        payload = IssueRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        p = services.plan(
            acting_user(request),
            self.project,
            sheet_ids=d["sheet_ids"],
            purpose=d["purpose"],
            contact_ids=d["contact_ids"],
            override_reason=d.get("override_reason", ""),
        )
        seq = (self.project.transmittals.count() or 0) + 1
        return Response(
            {
                "summary": p.summary(),
                "issue_count": len(p.checks),
                "recipient_count": len(p.contacts),
                "superseded_count": p.superseded_count,
                "previous_recipient_count": len(p.previous_recipients),
                "blocked": [
                    {"sheet_id": c.sheet.pk, "number": c.sheet.number, "reason": c.problem}
                    for c in p.blocked
                ],
                "next_number": f"{self.project.code}-TR-{seq:04d}",
            }
        )


class CoverPreviewView(ProjectNestedMixin, generics.GenericAPIView):
    """The composer's cover preview (S-07 step 3), marked PREVIEW, nothing saved."""

    serializer_class = IssueRequestSerializer
    action_permissions = {"POST": Action.ISSUE_SHEETS}

    @extend_schema(
        request=IssueRequestSerializer,
        responses={(200, "application/pdf"): OpenApiResponse(OpenApiTypes.BINARY)},
    )
    def post(self, request: Request, project_pk: str) -> HttpResponse:
        from .cover import render_cover

        payload = IssueRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        d = payload.validated_data
        user = acting_user(request)
        p = services.plan(
            user,
            self.project,
            sheet_ids=d["sheet_ids"],
            purpose=d["purpose"],
            contact_ids=d["contact_ids"],
            override_reason=d.get("override_reason", ""),
        )
        org = self.project.organisation
        context = {
            "firm": org.name,
            "preview": True,
            "number": f"{self.project.code}-TR-{self.project.transmittals.count() + 1:04d}",
            "project": f"{self.project.code} {self.project.name}",
            "date": services.display_date(timezone.now(), org.timezone),
            "purpose": p.purpose_label,
            "suitability": d.get("suitability", ""),
            "sender": user.full_name or user.email,
            "note": d.get("note", ""),
            "rows": [
                {
                    "number": c.sheet.number,
                    "title": c.sheet.title,
                    "revision": c.revision.code if c.revision else "—",
                    "purpose": p.purpose,
                }
                for c in p.checks
            ],
            "recipients": [
                {
                    "name": c.full_name,
                    "organisation": c.external_org.name if c.external_org else "",
                    "delivery": "Email" if c.email else "By hand",
                }
                for c in p.contacts
            ],
            "supersedes": "",
        }
        response = HttpResponse(render_cover(context), content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="cover-preview.pdf"'
        return response


class _TransmittalObject(ProjectObjectMixin, generics.GenericAPIView):
    queryset = Transmittal.objects.none()

    def get_queryset(self) -> QuerySet[Transmittal]:
        return Transmittal.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project", "sent_by", "supersedes")


class TransmittalDetailView(_TransmittalObject):
    serializer_class = TransmittalDetailSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses=TransmittalDetailSerializer)
    def get(self, request: Request, pk: str) -> Response:
        t = self.get_object()
        t.sheet_count = t.items.count()
        t.recipient_count = t.recipients.count()
        return Response(TransmittalDetailSerializer(t).data)


class CoverView(_TransmittalObject):
    serializer_class = TransmittalSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses={200: OpenApiResponse(description="Signed link")})
    def get(self, request: Request, pk: str) -> Response:
        t = self.get_object()
        if t.cover_file is None:
            return Response(
                {"code": "not_ready", "detail": "The cover sheet is being made."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {
                "url": storage.presign_get(
                    t.cover_file.storage_key,
                    f"{t.number} cover.pdf",
                    origin=request.build_absolute_uri("/").rstrip("/"),
                )
            }
        )


class ResendView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = RecipientSerializer
    queryset = TransmittalRecipient.objects.none()
    project_path = "transmittal__project"
    action_permissions = {"POST": Action.ISSUE_SHEETS}

    def get_queryset(self) -> QuerySet[TransmittalRecipient]:
        return TransmittalRecipient.objects.filter(
            transmittal__project__in=visible_projects(acting_user(self.request))
        ).select_related("transmittal__project", "contact")

    @extend_schema(request=None, responses=RecipientSerializer)
    def post(self, request: Request, pk: str) -> Response:
        recipient = services.resend(acting_user(request), self.get_object())
        return Response(RecipientSerializer(recipient).data)


class DistributionView(ProjectObjectMixin, generics.GenericAPIView):
    """'Who has which revision' matrix for a sheet (03 §8)."""

    serializer_class = DistributionRowSerializer
    queryset = Sheet.objects.none()
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT}

    def get_queryset(self) -> QuerySet[Sheet]:
        return visible_sheets(acting_user(self.request)).select_related("project")

    @extend_schema(responses=DistributionRowSerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        return Response(
            DistributionRowSerializer(services.distribution(self.get_object()), many=True).data
        )

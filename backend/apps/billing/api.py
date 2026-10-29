"""S-17 billing signals (F-27, F-28, I-08). API tokens: accounting:read lists and exports,
accounting:write marks invoiced (the accounting tool can call back)."""

from typing import Any

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.idempotency import idempotent
from apps.projects.api.serializers import UserMiniSerializer

from . import services
from .models import BillingSignal


class BillingSignalSerializer(serializers.ModelSerializer):
    project_code = serializers.CharField(source="project.code")
    project_name = serializers.CharField(source="project.name")
    client = serializers.CharField(source="project.client.name", default=None, allow_null=True)
    stage_seq = serializers.IntegerField(source="stage.seq")
    stage_name = serializers.CharField(source="stage.name")
    stage_state = serializers.CharField(source="stage.state")
    days_waiting = serializers.SerializerMethodField()
    invoiced_by_detail = UserMiniSerializer(source="invoiced_by", allow_null=True)

    class Meta:
        model = BillingSignal
        fields = [
            "id",
            "project",
            "project_code",
            "project_name",
            "client",
            "stage",
            "stage_seq",
            "stage_name",
            "stage_state",
            "fee_pct",
            "fee_amount",
            "ready_at",
            "days_waiting",
            "invoiced_at",
            "invoiced_by_detail",
            "invoice_ref",
            "exported_at",
            "webhook_delivered_at",
        ]
        read_only_fields = fields

    def get_days_waiting(self, obj: BillingSignal) -> int:
        return services.days_waiting(obj)


class MarkInvoicedSerializer(serializers.Serializer):
    invoice_ref = serializers.CharField(required=False, allow_blank=True, max_length=100)


class SignalListView(generics.ListAPIView):
    serializer_class = BillingSignalSerializer
    pagination_class = None
    queryset = BillingSignal.objects.none()
    action_permissions = {"GET": Action.VIEW_BILLING}
    token_scopes = ["accounting:read"]

    @extend_schema(
        parameters=[OpenApiParameter("state", str, enum=["ready", "invoiced"], required=False)]
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> Any:
        qs = services.visible_signals(acting_user(self.request))
        state = self.request.query_params.get("state")
        if state == "ready":
            qs = qs.filter(invoiced_at__isnull=True)
        elif state == "invoiced":
            qs = qs.filter(invoiced_at__isnull=False).order_by("-invoiced_at")
        return qs


class SignalExportView(APIView):
    action_permissions = {"GET": Action.VIEW_BILLING}
    token_scopes = ["accounting:read"]

    @extend_schema(responses={(200, "text/csv"): OpenApiResponse(OpenApiTypes.BINARY)})
    def get(self, request: Request) -> HttpResponse:
        data = services.export_csv(acting_user(request))
        response = HttpResponse(data, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="ready-to-invoice.csv"'
        return response


class MarkInvoicedView(generics.GenericAPIView):
    serializer_class = BillingSignalSerializer
    queryset = BillingSignal.objects.none()
    action_permissions = {"POST": Action.MARK_INVOICED}
    token_scopes = ["accounting:write"]

    def get_queryset(self) -> Any:
        return BillingSignal.objects.filter(organisation_id=acting_user(self.request).org_pk)

    @extend_schema(request=MarkInvoicedSerializer, responses=BillingSignalSerializer)
    @idempotent()
    def post(self, request: Request, pk: str) -> Response:
        payload = MarkInvoicedSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        signal = services.mark_invoiced(
            acting_user(request), self.get_object(), payload.validated_data.get("invoice_ref", "")
        )
        return Response(BillingSignalSerializer(signal).data)

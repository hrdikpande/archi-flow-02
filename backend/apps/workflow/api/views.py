from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.projects.api.mixins import ProjectObjectMixin
from apps.register.api.views import SheetDetailSerializer, sheet_detail_payload
from apps.register.models import Sheet
from apps.register.selectors import visible_sheets
from apps.workflow import services
from apps.workflow.models import Review
from apps.workflow.selectors import review_queue
from apps.workflow.timeline import sheet_timeline

from .serializers import (
    QueueItemSerializer,
    RedlineUploadSerializer,
    ReviewActionSerializer,
    ReviewSerializer,
    TimelineEntrySerializer,
    TransitionRequestSerializer,
)


class _SheetObject(ProjectObjectMixin, generics.GenericAPIView):
    queryset = Sheet.objects.none()
    pagination_class = None

    def get_queryset(self) -> QuerySet[Sheet]:
        return visible_sheets(acting_user(self.request)).select_related("project", "stage")


class SheetTransitionView(_SheetObject):
    """F-10: one endpoint for every state change; 409 + allowed actions when not allowed."""

    serializer_class = TransitionRequestSerializer
    action_permissions = {"POST": Action.VIEW_PROJECT}

    @extend_schema(request=TransitionRequestSerializer, responses=SheetDetailSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = TransitionRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        sheet = services.transition(
            self.get_object(),
            data["action"],
            acting_user(request),
            reason=data.get("reason", ""),
            comment=data.get("comment", ""),
            redline_upload_ids=data["redline_upload_ids"],
            checklist=data["checklist"],
        )
        return Response(sheet_detail_payload(sheet, request))


class SheetTimelineView(_SheetObject):
    serializer_class = TimelineEntrySerializer
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses=TimelineEntrySerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        return Response(TimelineEntrySerializer(sheet_timeline(self.get_object()), many=True).data)


class SheetReviewsView(_SheetObject):
    serializer_class = ReviewSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses=ReviewSerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        reviews = (
            self.get_object()
            .reviews.select_related("reviewer", "revision")
            .prefetch_related("redlines")
        )
        return Response(ReviewSerializer(reviews, many=True).data)


class ReviewQueueView(generics.GenericAPIView):
    """S-08: sheets waiting for my check, oldest first, with working days waiting."""

    serializer_class = QueueItemSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=QueueItemSerializer(many=True))
    def get(self, request: Request) -> Response:
        return Response(QueueItemSerializer(review_queue(acting_user(request)), many=True).data)


class _ReviewObject(ProjectObjectMixin, generics.GenericAPIView):
    queryset = Review.objects.none()
    project_path = "sheet__project"

    def get_queryset(self) -> QuerySet[Review]:
        return Review.objects.filter(
            sheet__in=visible_sheets(acting_user(self.request))
        ).select_related("sheet__project", "sheet__stage")


class ReviewApproveView(_ReviewObject):
    serializer_class = ReviewActionSerializer
    action_permissions = {"POST": Action.REVIEW_SHEET}

    @extend_schema(request=ReviewActionSerializer, responses=SheetDetailSerializer)
    def post(self, request: Request, pk: str) -> Response:
        return self._act(request, "approve")

    def _act(self, request: Request, action: str) -> Response:
        review = self.get_object()
        payload = ReviewActionSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        sheet = services.transition(
            review.sheet,
            action,
            acting_user(request),
            comment=payload.validated_data.get("comment", ""),
            redline_upload_ids=payload.validated_data["redline_upload_ids"],
        )
        return Response(sheet_detail_payload(sheet, request))


class ReviewReturnView(ReviewApproveView):
    @extend_schema(request=ReviewActionSerializer, responses=SheetDetailSerializer)
    def post(self, request: Request, pk: str) -> Response:
        return self._act(request, "return")


class ReviewRedlinesView(_ReviewObject):
    serializer_class = RedlineUploadSerializer
    action_permissions = {"POST": Action.REVIEW_SHEET}

    @extend_schema(request=RedlineUploadSerializer, responses=ReviewSerializer)
    def post(self, request: Request, pk: str) -> Response:
        payload = RedlineUploadSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        review = services.add_redlines(
            self.get_object(), acting_user(request), payload.validated_data["upload_ids"]
        )
        return Response(ReviewSerializer(review).data)

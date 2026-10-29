from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.files import services
from apps.files.models import Upload

from .serializers import PresignRequestSerializer, PresignResponseSerializer, UploadSerializer


class UploadViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Upload.objects.none()  # schema hint; get_queryset() scopes
    serializer_class = UploadSerializer
    action_permissions = {
        "retrieve": Action.UPLOAD_FILES,
        "presign": Action.UPLOAD_FILES,
        "complete": Action.UPLOAD_FILES,
    }

    def get_queryset(self) -> QuerySet[Upload]:
        return Upload.objects.filter(
            organisation_id=acting_user(self.request).org_pk, uploaded_by=acting_user(self.request)
        ).select_related("file")

    @extend_schema(request=PresignRequestSerializer, responses={201: PresignResponseSerializer})
    @action(detail=False, methods=["post"])
    def presign(self, request: Request) -> Response:
        payload = PresignRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        origin = request.build_absolute_uri("/").rstrip("/")
        result = services.presign_upload(
            acting_user(request), origin=origin, **payload.validated_data
        )
        body = {
            "upload": UploadSerializer(result.upload).data,
            "url": result.url,
            "method": "PUT",
            "headers": {"Content-Type": payload.validated_data["content_type"]},
            "expires_at": result.expires_at,
        }
        return Response(PresignResponseSerializer(body).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={202: UploadSerializer})
    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: str | None = None) -> Response:
        upload = services.complete_upload(acting_user(request), self.get_object())
        return Response(UploadSerializer(upload).data, status=status.HTTP_202_ACCEPTED)

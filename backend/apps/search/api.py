from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user

from . import services


class SheetHitSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    project = serializers.UUIDField(source="project_id")
    project_code = serializers.CharField(source="project.code")
    number = serializers.CharField()
    title = serializers.CharField()
    state = serializers.CharField()
    discipline_code = serializers.CharField(source="discipline.code")
    current_revision_code = serializers.CharField(
        source="current_revision.code", default=None, allow_null=True
    )


class ProjectHitSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()
    status = serializers.CharField()


class TransmittalHitSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    project = serializers.UUIDField(source="project_id")
    project_code = serializers.CharField(source="project.code")
    number = serializers.CharField()
    purpose = serializers.CharField()
    sent_at = serializers.DateTimeField(allow_null=True)


class ContactHitSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    organisation_name = serializers.CharField(
        source="external_org.name", default=None, allow_null=True
    )


class SearchResultSerializer(serializers.Serializer):
    sheets = SheetHitSerializer(many=True)
    projects = ProjectHitSerializer(many=True)
    transmittals = TransmittalHitSerializer(many=True)
    contacts = ContactHitSerializer(many=True)


class SearchView(APIView):
    """F-44: the ⌘K palette's search. Results respect permissions."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=True),
            OpenApiParameter("limit", int, required=False),
        ],
        responses=SearchResultSerializer,
    )
    def get(self, request: Request) -> Response:
        try:
            limit = max(1, min(int(request.query_params.get("limit", 8)), 25))
        except ValueError:
            limit = 8
        result = services.search(acting_user(request), request.query_params.get("q", ""), limit)
        return Response(SearchResultSerializer(result).data)

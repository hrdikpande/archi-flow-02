from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.audit import activity
from apps.audit.models import AuditEvent
from apps.core.pagination import DefaultCursorPagination
from apps.projects.api.mixins import ProjectNestedMixin


class ActivityCursor(DefaultCursorPagination):
    ordering = "-at"
    page_size = 50


class ActivityItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    at = serializers.DateTimeField()
    type = serializers.CharField()
    verb = serializers.CharField()
    actor = serializers.CharField()
    text = serializers.CharField()
    entity_type = serializers.CharField()
    entity_id = serializers.CharField()
    entity_label = serializers.CharField()
    link = serializers.CharField()
    discipline = serializers.UUIDField(allow_null=True)


class ActivityView(ProjectNestedMixin, generics.ListAPIView):
    """F-45: the project activity feed (S-04 Activity tab)."""

    serializer_class = ActivityItemSerializer
    pagination_class = ActivityCursor
    queryset = AuditEvent.objects.none()
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(
        parameters=[
            OpenApiParameter("actor", str, required=False),
            OpenApiParameter("discipline", str, required=False),
            OpenApiParameter("type", str, many=True, required=False, enum=list(activity.TYPES)),
        ]
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> Any:
        params = self.request.query_params
        return activity.feed(
            self.project,
            actor=params.get("actor") or None,
            discipline=params.get("discipline") or None,
            kinds=params.getlist("type") or None,
        )

    def get_serializer(self, *args: Any, **kwargs: Any) -> Any:
        if args and not isinstance(args[0], AuditEvent):
            events = list(args[0])
            links = activity.links(self.project, events)
            rows = [
                {
                    "id": e.pk,
                    "at": e.at,
                    "type": activity.type_of(e),
                    "verb": e.verb,
                    "actor": e.actor.short_name if e.actor else e.actor_label,
                    "text": activity.describe(e),
                    "entity_type": e.entity_type,
                    "entity_id": e.entity_id,
                    "entity_label": e.entity_label,
                    "link": links[str(e.pk)],
                    "discipline": e.discipline_id,
                }
                for e in events
            ]
            args = (rows, *args[1:])
        return super().get_serializer(*args, **kwargs)

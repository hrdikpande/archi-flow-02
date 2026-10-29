from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action, require
from apps.accounts.request import acting_user
from apps.audit.services import record
from apps.core.pagination import DefaultCursorPagination
from apps.notifications import services
from apps.notifications.catalogue import EVENTS
from apps.notifications.email import send_templated_email
from apps.notifications.models import Notification, NotificationPreference, NotificationSettings

from .serializers import (
    MarkReadSerializer,
    NotificationSerializer,
    PreferencesSerializer,
    PreferencesUpdateSerializer,
)


class TestEmailView(APIView):
    """Admin check that outbound email works (S-14 Integrations)."""

    action_permissions = {"POST": Action.MANAGE_ORG_SETTINGS}

    @extend_schema(request=None, responses={202: None})
    def post(self, request: Request) -> Response:
        actor = acting_user(request)
        require(actor, Action.MANAGE_ORG_SETTINGS)
        send_templated_email(
            [actor.email],
            "test_email",
            {
                "name": actor.short_name,
                "organisation": actor.org.name,
            },
        )
        record(
            organisation_id=actor.org_pk,
            actor=actor,
            verb="email.test_sent",
            entity_type="accounts.user",
            entity_id=actor.pk,
            entity_label=actor.email,
        )
        return Response(status=status.HTTP_202_ACCEPTED)


class NotificationCursor(DefaultCursorPagination):
    ordering = "-created_at"


class NotificationListView(generics.ListAPIView):
    """S-13 notification centre: newest first; `?unread=1` for the bell."""

    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()
    pagination_class = NotificationCursor
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(parameters=[OpenApiParameter("unread", bool, required=False)])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Notification]:
        qs = Notification.objects.filter(user=acting_user(self.request))
        if self.request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        return qs


class MarkReadView(APIView):
    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(request=MarkReadSerializer, responses={200: None})
    def post(self, request: Request) -> Response:
        payload = MarkReadSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        updated = services.mark_read(acting_user(request), payload.validated_data.get("ids"))
        return Response({"updated": updated})


def _preferences(user: Any) -> dict[str, Any]:
    prefs = dict(NotificationPreference.objects.filter(user=user).values_list("event", "mode"))
    settings_row = NotificationSettings.objects.filter(user=user).first()
    return {
        "events": [
            {
                "event": e.key,
                "label": e.label,
                "mode": e.default if e.mandatory else prefs.get(e.key, e.default),
                "default": e.default,
                "mandatory": e.mandatory,
                "phase": e.phase,
            }
            for e in EVENTS.values()
        ],
        "quiet_from": settings_row.quiet_from if settings_row else None,
        "quiet_to": settings_row.quiet_to if settings_row else None,
        "unread": Notification.objects.filter(user=user, read_at__isnull=True).count(),
    }


class PreferencesView(APIView):
    """S-13 preferences: events × instant/digest/off; mandatory events locked (F-21)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "PUT": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=PreferencesSerializer)
    def get(self, request: Request) -> Response:
        return Response(PreferencesSerializer(_preferences(acting_user(request))).data)

    @extend_schema(request=PreferencesUpdateSerializer, responses=PreferencesSerializer)
    def put(self, request: Request) -> Response:
        payload = PreferencesUpdateSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        user = acting_user(request)
        services.set_preferences(user, payload.validated_data.get("modes", {}))
        if "quiet_from" in payload.validated_data or "quiet_to" in payload.validated_data:
            NotificationSettings.objects.update_or_create(
                user=user,
                defaults={
                    "quiet_from": payload.validated_data.get("quiet_from"),
                    "quiet_to": payload.validated_data.get("quiet_to"),
                },
            )
        return Response(PreferencesSerializer(_preferences(user)).data)

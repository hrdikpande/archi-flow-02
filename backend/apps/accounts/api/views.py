from typing import Any

from allauth.mfa.models import Authenticator
from django.db.models import Q, QuerySet
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.drf_permissions import mfa_setup_required
from apps.accounts.models import ApiToken, User
from apps.accounts.permissions import Action, can
from apps.accounts.request import acting_user
from apps.accounts.roles import ProjectRole
from apps.core.pagination import DefaultCursorPagination

from .serializers import (
    ApiTokenCreatedSerializer,
    ApiTokenCreateSerializer,
    ApiTokenSerializer,
    DirectoryEntrySerializer,
    MeSerializer,
    UserSerializer,
)


class CsrfView(APIView):
    """Sets the CSRF cookie for the SPA before its first POST."""

    public = True
    authentication_classes: list[Any] = []

    @extend_schema(responses={204: None})
    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    allow_without_mfa = True
    token_scopes: tuple[str, ...] = ()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(responses=MeSerializer)
    def get(self, request: Request) -> Response:
        user: User = acting_user(request)
        org = user.org
        memberships = [
            {"project_id": m.project_id, "project_code": m.project.code, "role": m.role}
            for m in user.memberships.select_related("project").order_by("project__code")
        ]
        data = {
            "id": user.pk,
            "email": user.email,
            "full_name": user.full_name,
            "short_name": user.short_name,
            "org_role": user.org_role,
            "organisation": {
                "id": org.pk,
                "name": org.name,
                "timezone": org.timezone,
                "work_week": org.work_week,
            },
            "memberships": memberships,
            "capabilities": {
                "manage_org_settings": can(user, Action.MANAGE_ORG_SETTINGS),
                "export_audit": can(user, Action.EXPORT_AUDIT),
                "manage_contacts": can(user, Action.MANAGE_CONTACTS),
                "create_project": can(user, Action.CREATE_PROJECT),
                "upload_files": can(user, Action.UPLOAD_FILES),
                "log_own_timesheet": can(user, Action.LOG_OWN_TIMESHEET),
                "manage_staff": can(user, Action.MANAGE_STAFF),
                "allocate_hours": any(
                    m["role"] in (ProjectRole.PL, ProjectRole.DL) for m in memberships
                ),
                "view_portfolio": can(user, Action.VIEW_PORTFOLIO),
                "view_baseline": can(user, Action.VIEW_BASELINE),
                "view_hours_report": can(user, Action.VIEW_HOURS_REPORT),
                "view_billing": can(user, Action.VIEW_BILLING),
                "mark_invoiced": can(user, Action.MARK_INVOICED),
                "view_forecasts": can(user, Action.VIEW_FORECASTS),
            },
            "mfa": {
                "totp_enabled": Authenticator.objects.filter(
                    user=user, type=Authenticator.Type.TOTP
                ).exists(),
                "setup_required": mfa_setup_required(request),
            },
        }
        return Response(MeSerializer(data).data)


class UserPagination(DefaultCursorPagination):
    ordering = "email"


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.none()  # schema hint; get_queryset() scopes
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]
    action_permissions = {
        "list": Action.MANAGE_ORG_SETTINGS,
        "retrieve": Action.MANAGE_ORG_SETTINGS,
        "partial_update": Action.MANAGE_ORG_SETTINGS,
    }
    pagination_class = UserPagination

    def get_queryset(self) -> QuerySet[User]:
        return User.objects.filter(organisation_id=acting_user(self.request).org_pk)

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_user(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )


class ApiTokenViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ApiToken.objects.none()  # schema hint; get_queryset() scopes
    serializer_class = ApiTokenSerializer
    action_permissions = {
        "list": Action.MANAGE_ORG_SETTINGS,
        "create": Action.MANAGE_ORG_SETTINGS,
        "revoke": Action.MANAGE_ORG_SETTINGS,
    }

    def get_queryset(self) -> QuerySet[ApiToken]:
        return ApiToken.objects.filter(
            organisation_id=acting_user(self.request).org_pk
        ).select_related("user")

    @extend_schema(request=ApiTokenCreateSerializer, responses={201: ApiTokenCreatedSerializer})
    def create(self, request: Request) -> Response:
        serializer = ApiTokenCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        token, plaintext = services.create_api_token(
            acting_user(request), **serializer.validated_data
        )
        data = ApiTokenSerializer(token).data
        data["token"] = plaintext
        return Response(data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=ApiTokenSerializer)
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str | None = None) -> Response:
        token = services.revoke_api_token(acting_user(request), self.get_object())
        return Response(ApiTokenSerializer(token).data)


class DirectoryView(APIView):
    """Active people in the firm, for team and owner pickers (read by any member)."""

    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        parameters=[OpenApiParameter("q", str, required=False)],
        responses=DirectoryEntrySerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        qs = User.objects.filter(organisation_id=acting_user(request).org_pk, is_active=True)
        if q := request.query_params.get("q", "").strip():
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q))
        return Response(
            DirectoryEntrySerializer(qs.order_by("full_name", "email")[:50], many=True).data
        )

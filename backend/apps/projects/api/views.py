from typing import Any

from django.db.models import Count, Prefetch, Q, QuerySet
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.pagination import DefaultCursorPagination
from apps.projects import services
from apps.projects.models import (
    Package,
    Project,
    ProjectMembership,
    Stage,
    StageTemplate,
)
from apps.projects.selectors import visible_projects

from .mixins import ProjectNestedMixin, ProjectObjectMixin
from .serializers import (
    ApplyTemplateSerializer,
    MembershipSerializer,
    MembershipUpdateSerializer,
    PackageSerializer,
    ProjectCreateSerializer,
    ProjectSerializer,
    StagePlanSerializer,
    StageSerializer,
    StageTemplateSerializer,
    StageTransitionRequestSerializer,
)


class CodeCursor(DefaultCursorPagination):
    ordering = "code"


def _project_qs(qs: QuerySet[Project]) -> QuerySet[Project]:
    return qs.select_related("client").prefetch_related(
        "stages", Prefetch("memberships", queryset=ProjectMembership.objects.select_related("user"))
    )


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("status", str, required=False),
        ]
    )
)
class ProjectViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """F-01. Lists only projects the user may see (F-38)."""

    queryset = Project.objects.none()
    serializer_class = ProjectSerializer
    pagination_class = CodeCursor
    http_method_names = ["get", "post", "patch", "head", "options"]
    action_permissions = {
        "list": Action.VIEW_ORG_REFERENCE,
        "retrieve": Action.VIEW_PROJECT,
        "create": Action.CREATE_PROJECT,
        "partial_update": Action.EDIT_STAGES,
    }

    def get_queryset(self) -> QuerySet[Project]:
        qs = _project_qs(visible_projects(acting_user(self.request)))
        params = self.request.query_params
        if q := params.get("q", "").strip():
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))
        if s := params.get("status"):
            qs = qs.filter(status=s)
        return qs

    def get_serializer_class(self) -> Any:
        return ProjectCreateSerializer if self.action == "create" else ProjectSerializer

    def object_project(self, obj: Project) -> Project:
        return obj

    def perform_create(self, serializer: Any) -> None:
        data = dict(serializer.validated_data)
        lead = data.pop("lead", None)
        serializer.instance = services.create_project(acting_user(self.request), lead=lead, **data)

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_project(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        response = super().create(request, *args, **kwargs)
        project = _project_qs(Project.objects.filter(pk=response.data["id"])).get()
        return Response(
            ProjectSerializer(project, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class StageListView(ProjectNestedMixin, generics.GenericAPIView):
    """S-11 stage plan editor: read the plan, save it whole (draft or final)."""

    serializer_class = StageSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT, "PUT": Action.EDIT_STAGES}

    def _stages(self) -> list[Stage]:
        return list(self.project.stages.annotate(sheet_count=Count("sheets")).order_by("seq"))

    @extend_schema(responses=StageSerializer(many=True))
    def get(self, request: Request, project_pk: str) -> Response:
        return Response(StageSerializer(self._stages(), many=True).data)

    @extend_schema(request=StagePlanSerializer, responses=StageSerializer(many=True))
    def put(self, request: Request, project_pk: str) -> Response:
        payload = StagePlanSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        services.save_stage_plan(acting_user(request), self.project, **payload.validated_data)
        return Response(StageSerializer(self._stages(), many=True).data)


class ApplyTemplateView(ProjectNestedMixin, generics.GenericAPIView):
    serializer_class = ApplyTemplateSerializer
    action_permissions = {"POST": Action.EDIT_STAGES}

    @extend_schema(request=ApplyTemplateSerializer, responses=StageSerializer(many=True))
    def post(self, request: Request, project_pk: str) -> Response:
        payload = ApplyTemplateSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        stages = services.apply_template(
            acting_user(request), self.project, payload.validated_data["template"]
        )
        return Response(StageSerializer(stages, many=True).data)


class StageTransitionView(ProjectObjectMixin, generics.GenericAPIView):
    serializer_class = StageSerializer
    queryset = Stage.objects.none()
    action_permissions = {"POST": Action.EDIT_STAGES}

    def get_queryset(self) -> QuerySet[Stage]:
        return Stage.objects.filter(project__in=visible_projects(acting_user(self.request)))

    @extend_schema(request=StageTransitionRequestSerializer, responses=StageSerializer)
    def post(self, request: Request, pk: str) -> Response:
        stage = self.get_object()
        payload = StageTransitionRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        stage = services.transition_stage(
            acting_user(request), stage, payload.validated_data["action"]
        )
        return Response(StageSerializer(stage).data)


class PackageListView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = PackageSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.EDIT_SHEETS}

    def get_queryset(self) -> QuerySet[Package]:
        return self.project.packages.annotate(sheet_count=Count("sheets")).select_related(
            "discipline"
        )

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_package(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class PackageDetailView(ProjectObjectMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PackageSerializer
    queryset = Package.objects.none()
    http_method_names = ["get", "patch", "delete", "head", "options"]
    action_permissions = {
        "GET": Action.VIEW_PROJECT,
        "PATCH": Action.EDIT_SHEETS,
        "DELETE": Action.EDIT_SHEETS,
    }

    def get_queryset(self) -> QuerySet[Package]:
        return Package.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).annotate(sheet_count=Count("sheets"))

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_package(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

    def perform_destroy(self, instance: Package) -> None:
        services.delete_package(acting_user(self.request), instance)


class MemberListView(ProjectNestedMixin, generics.ListCreateAPIView):
    serializer_class = MembershipSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.EDIT_STAGES}

    def get_queryset(self) -> QuerySet[ProjectMembership]:
        return self.project.memberships.select_related("user", "discipline").order_by(
            "role", "user__full_name"
        )

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.add_member(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class MemberDetailView(ProjectObjectMixin, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = MembershipUpdateSerializer
    queryset = ProjectMembership.objects.none()
    http_method_names = ["patch", "delete", "options"]
    action_permissions = {"PATCH": Action.EDIT_STAGES, "DELETE": Action.EDIT_STAGES}

    def get_queryset(self) -> QuerySet[ProjectMembership]:
        return ProjectMembership.objects.filter(
            project__in=visible_projects(acting_user(self.request))
        ).select_related("project", "user")

    @extend_schema(request=MembershipUpdateSerializer, responses=MembershipSerializer)
    def patch(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self.get_object()
        payload = MembershipUpdateSerializer(
            data=request.data, partial=True, context={"request": request}
        )
        payload.is_valid(raise_exception=True)
        membership = services.update_member(
            acting_user(request), membership, **payload.validated_data
        )
        return Response(MembershipSerializer(membership).data)

    def perform_destroy(self, instance: ProjectMembership) -> None:
        services.remove_member(acting_user(self.request), instance)


class StageTemplateViewSet(viewsets.ModelViewSet):
    """F-02 templates, edited in Admin settings (F-42)."""

    serializer_class = StageTemplateSerializer
    queryset = StageTemplate.objects.none()
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    action_permissions = {
        "list": Action.VIEW_ORG_REFERENCE,
        "retrieve": Action.VIEW_ORG_REFERENCE,
        "create": Action.MANAGE_ORG_SETTINGS,
        "partial_update": Action.MANAGE_ORG_SETTINGS,
        "destroy": Action.MANAGE_ORG_SETTINGS,
    }

    def get_queryset(self) -> QuerySet[StageTemplate]:
        return StageTemplate.objects.filter(
            organisation_id=acting_user(self.request).org_pk
        ).prefetch_related("items")

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_stage_template(
            acting_user(self.request), **serializer.validated_data
        )

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_stage_template(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

    def perform_destroy(self, instance: StageTemplate) -> None:
        services.delete_stage_template(acting_user(self.request), instance)


class UploadRefSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()


class FileLinkSerializer(serializers.Serializer):
    url = serializers.URLField()
    filename = serializers.CharField()


class AppointmentLetterView(ProjectNestedMixin, generics.GenericAPIView):
    serializer_class = UploadRefSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.EDIT_STAGES}

    @extend_schema(responses=FileLinkSerializer)
    def get(self, request: Request, project_pk: str) -> Response:
        from apps.files.services import download_url

        letter = self.project.appointment_letter
        if letter is None:
            raise Http404
        origin = request.build_absolute_uri("/").rstrip("/")
        return Response(
            {"url": download_url(letter, origin=origin), "filename": letter.original_name}
        )

    @extend_schema(request=UploadRefSerializer, responses=ProjectSerializer)
    def post(self, request: Request, project_pk: str) -> Response:
        payload = UploadRefSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        project = services.set_appointment_letter(
            acting_user(request), self.project, payload.validated_data["upload_id"]
        )
        project = _project_qs(Project.objects.filter(pk=project.pk)).get()
        return Response(ProjectSerializer(project, context={"request": request}).data)

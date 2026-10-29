from typing import Any

from django.db.models import Q, QuerySet
from django.http import Http404, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import Action, can
from apps.accounts.request import acting_user
from apps.projects.api.mixins import ProjectNestedMixin, ProjectObjectMixin
from apps.projects.selectors import visible_projects
from apps.register import imports, revisions, services
from apps.register.models import ImportJob, NamingRule, SavedView, Sheet, SheetRevision
from apps.register.selectors import open_flags, register_sheets, visible_sheets
from apps.workflow.api.serializers import AllowedActionSerializer

from .serializers import (
    BulkRequestSerializer,
    BulkResultSerializer,
    DownloadSerializer,
    ImportJobSerializer,
    ImportUpdateSerializer,
    ImportUploadSerializer,
    NamingRuleSerializer,
    NamingTestResultSerializer,
    NamingTestSerializer,
    RevisionSerializer,
    RevisionUploadSerializer,
    SavedViewSerializer,
    SheetSerializer,
)

LIST_FILTERS = ["discipline", "stage", "package", "owner", "checker", "state"]


def _filters(request: Request) -> dict[str, Any]:
    params = request.query_params
    data: dict[str, Any] = {k: params.getlist(k) for k in LIST_FILTERS if params.getlist(k)}
    data["q"] = params.get("q", "")
    return data


class SheetListView(ProjectNestedMixin, generics.ListCreateAPIView):
    """The register (S-05, F-04): all sheets of a project, unpaginated for the virtual grid."""

    serializer_class = SheetSerializer
    pagination_class = None
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.EDIT_SHEETS}

    @extend_schema(
        parameters=[OpenApiParameter(k, str, many=True, required=False) for k in LIST_FILTERS]
        + [OpenApiParameter("q", str, required=False)]
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Sheet]:
        return register_sheets(self.project, _filters(self.request))

    def perform_create(self, serializer: Any) -> None:
        serializer.instance = services.create_sheet(
            acting_user(self.request), self.project, **serializer.validated_data
        )


class SheetDetailView(ProjectObjectMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SheetSerializer
    queryset = Sheet.objects.none()
    http_method_names = ["get", "patch", "delete", "head", "options"]
    action_permissions = {
        "GET": Action.VIEW_PROJECT,
        "PATCH": Action.EDIT_SHEETS,
        "DELETE": Action.HOLD_CANCEL_SUPERSEDE,
    }

    def get_queryset(self) -> QuerySet[Sheet]:
        return visible_sheets(acting_user(self.request)).select_related(
            "project", "discipline", "stage", "package", "owner", "checker", "current_revision"
        )

    def object_is_own(self, obj: Sheet) -> bool:
        return obj.owner_id == acting_user(self.request).pk

    def perform_update(self, serializer: Any) -> None:
        serializer.instance = services.update_sheet(
            acting_user(self.request), serializer.instance, **serializer.validated_data
        )

    def perform_destroy(self, instance: Sheet) -> None:
        services.delete_sheet(acting_user(self.request), instance)


@extend_schema(parameters=[OpenApiParameter("project", str, required=False)])
class SavedViewViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = SavedViewSerializer
    queryset = SavedView.objects.none()
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    action_permissions = {
        "list": Action.VIEW_ORG_REFERENCE,
        "create": Action.VIEW_ORG_REFERENCE,
        "partial_update": Action.VIEW_ORG_REFERENCE,
        "destroy": Action.VIEW_ORG_REFERENCE,
    }

    def get_queryset(self) -> QuerySet[SavedView]:
        qs = SavedView.objects.filter(user=acting_user(self.request))
        if project := self.request.query_params.get("project"):
            qs = qs.filter(project_id=project)
        return qs

    def perform_create(self, serializer: Any) -> None:
        project = serializer.validated_data.get("project")
        if (
            project is not None
            and not visible_projects(acting_user(self.request)).filter(pk=project.pk).exists()
        ):
            project = None
        serializer.instance = services.create_saved_view(
            acting_user(self.request),
            name=serializer.validated_data["name"],
            config=serializer.validated_data.get("config", {}),
            project=project,
        )

    def perform_update(self, serializer: Any) -> None:
        data = {k: v for k, v in serializer.validated_data.items() if k in ("name", "config")}
        serializer.instance = services.update_saved_view(
            acting_user(self.request), serializer.instance, **data
        )

    def perform_destroy(self, instance: SavedView) -> None:
        services.delete_saved_view(acting_user(self.request), instance)


class ImportStartView(ProjectNestedMixin, APIView):
    parser_classes = [MultiPartParser]
    action_permissions = {"POST": Action.EDIT_SHEETS}

    @extend_schema(
        request={"multipart/form-data": ImportUploadSerializer},
        responses={201: ImportJobSerializer},
    )
    def post(self, request: Request, project_pk: str) -> Response:
        payload = ImportUploadSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        upload = payload.validated_data["file"]
        job = imports.start_import(
            acting_user(request), self.project, name=upload.name, content=upload.read()
        )
        return Response(ImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class _ImportObjectMixin(ProjectObjectMixin):
    def get_queryset(self) -> QuerySet[ImportJob]:
        return ImportJob.objects.filter(
            project__in=visible_projects(acting_user(self.request))  # type: ignore[attr-defined]
        ).select_related("project")


class ImportJobView(_ImportObjectMixin, generics.GenericAPIView):
    serializer_class = ImportJobSerializer
    queryset = ImportJob.objects.none()
    action_permissions = {"GET": Action.EDIT_SHEETS, "PATCH": Action.EDIT_SHEETS}

    @extend_schema(responses=ImportJobSerializer)
    def get(self, request: Request, pk: str) -> Response:
        return Response(ImportJobSerializer(self.get_object()).data)

    @extend_schema(request=ImportUpdateSerializer, responses=ImportJobSerializer)
    def patch(self, request: Request, pk: str) -> Response:
        job = self.get_object()
        payload = ImportUpdateSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        job = imports.update_import(acting_user(request), job, **payload.validated_data)
        return Response(ImportJobSerializer(job).data)


class ImportCommitView(_ImportObjectMixin, generics.GenericAPIView):
    serializer_class = ImportJobSerializer
    queryset = ImportJob.objects.none()
    action_permissions = {"POST": Action.EDIT_SHEETS}

    @extend_schema(request=None, responses=ImportJobSerializer)
    def post(self, request: Request, pk: str) -> Response:
        job = imports.commit_import(acting_user(request), self.get_object())
        return Response(ImportJobSerializer(job).data)


class ImportUndoView(_ImportObjectMixin, generics.GenericAPIView):
    serializer_class = ImportJobSerializer
    queryset = ImportJob.objects.none()
    action_permissions = {"POST": Action.EDIT_SHEETS}

    @extend_schema(request=None, responses=ImportJobSerializer)
    def post(self, request: Request, pk: str) -> Response:
        job = imports.undo_import(acting_user(request), self.get_object())
        return Response(ImportJobSerializer(job).data)


class ImportTemplateView(APIView):
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE}

    @extend_schema(
        responses={
            (
                200,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ): OpenApiResponse(OpenApiTypes.BINARY)
        }
    )
    def get(self, request: Request) -> HttpResponse:
        response = HttpResponse(
            imports.template_workbook(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="drawingops-template.xlsx"'
        return response


# --- S3: sheet detail, revisions, naming rules, bulk ----------------------------------------


class SheetDetailSerializer(SheetSerializer):
    project_code = serializers.CharField(source="project.code", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    stage_requires_senior_qc = serializers.BooleanField(
        source="stage.requires_senior_qc", read_only=True
    )
    allowed_actions = AllowedActionSerializer(many=True, read_only=True)
    editable_fields = serializers.ListField(child=serializers.CharField(), read_only=True)
    can_upload_draft = serializers.BooleanField(read_only=True)

    class Meta(SheetSerializer.Meta):
        fields = [
            *SheetSerializer.Meta.fields,
            "project_code",
            "project_name",
            "stage_requires_senior_qc",
            "allowed_actions",
            "editable_fields",
            "can_upload_draft",
        ]


def sheet_detail_payload(sheet: Sheet, request: Request) -> dict[str, Any]:
    from apps.workflow.services import allowed_actions

    user = acting_user(request)
    sheet = (
        Sheet.objects.select_related(
            "project", "discipline", "stage", "package", "owner", "checker", "current_revision"
        )
        .prefetch_related(open_flags())
        .get(pk=sheet.pk)
    )
    sheet.allowed_actions = [a.__dict__ for a in allowed_actions(sheet, user)]  # type: ignore[attr-defined]
    sheet.editable_fields = list(services.editable_fields(user, sheet))  # type: ignore[attr-defined]
    sheet.can_upload_draft = can(  # type: ignore[attr-defined]
        user, Action.UPLOAD_DRAFT, project=sheet.project, is_own=sheet.owner_id == user.pk
    )
    return dict(SheetDetailSerializer(sheet, context={"request": request}).data)


class _SheetObjectView(ProjectObjectMixin, generics.GenericAPIView):
    queryset = Sheet.objects.none()
    pagination_class = None

    def get_queryset(self) -> QuerySet[Sheet]:
        return visible_sheets(acting_user(self.request)).select_related("project", "stage")

    def object_is_own(self, obj: Sheet) -> bool:
        return obj.owner_id == acting_user(self.request).pk


class SheetFullView(_SheetObjectView):
    """S-06 header data: the sheet plus the user's allowed actions (DESIGN.md §6)."""

    serializer_class = SheetDetailSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses=SheetDetailSerializer)
    def get(self, request: Request, pk: str) -> Response:
        return Response(sheet_detail_payload(self.get_object(), request))


class RevisionListView(_SheetObjectView):
    serializer_class = RevisionSerializer
    action_permissions = {"GET": Action.VIEW_PROJECT, "POST": Action.UPLOAD_DRAFT}

    @extend_schema(responses=RevisionSerializer(many=True))
    def get(self, request: Request, pk: str) -> Response:
        revisions = (
            self.get_object()
            .revisions.select_related("uploaded_by", "issued_by", "file")
            .order_by("-seq")
        )
        return Response(RevisionSerializer(revisions, many=True).data)

    @extend_schema(request=RevisionUploadSerializer, responses={201: RevisionSerializer})
    def post(self, request: Request, pk: str) -> Response:
        payload = RevisionUploadSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        revision = revisions.upload_draft(
            acting_user(request), self.get_object(), **payload.validated_data
        )
        return Response(RevisionSerializer(revision).data, status=status.HTTP_201_CREATED)


class RevisionDownloadView(ProjectObjectMixin, generics.GenericAPIView):
    """Signed link to a revision's PDF; superseded revisions are watermarked (F-48)."""

    serializer_class = DownloadSerializer
    queryset = SheetRevision.objects.none()
    project_path = "sheet__project"
    action_permissions = {"GET": Action.VIEW_PROJECT}

    def get_queryset(self) -> QuerySet[SheetRevision]:
        return SheetRevision.objects.filter(
            sheet__in=visible_sheets(acting_user(self.request))
        ).select_related("sheet__project", "file")

    @extend_schema(responses=DownloadSerializer)
    def get(self, request: Request, pk: str) -> Response:
        revision = self.get_object()
        origin = request.build_absolute_uri("/").rstrip("/")
        return Response(revisions.download(revision, acting_user(request), origin=origin))


class NamingRuleViewSet(viewsets.ModelViewSet):
    serializer_class = NamingRuleSerializer
    queryset = NamingRule.objects.none()
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    action_permissions = {
        "list": Action.VIEW_ORG_REFERENCE,
        "retrieve": Action.VIEW_ORG_REFERENCE,
        "create": Action.VIEW_ORG_REFERENCE,  # org rules: Admin; project rules: PL (service)
        "partial_update": Action.VIEW_ORG_REFERENCE,
        "destroy": Action.VIEW_ORG_REFERENCE,
    }

    @extend_schema(parameters=[OpenApiParameter("project", str, required=False)])
    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().list(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[NamingRule]:
        user = acting_user(self.request)
        qs = NamingRule.objects.filter(organisation_id=user.org_pk).filter(
            Q(project__isnull=True) | Q(project__in=visible_projects(user))
        )
        if project := self.request.query_params.get("project"):
            qs = qs.filter(Q(project_id=project) | Q(project__isnull=True))
        elif self.action == "list":
            qs = qs.filter(project__isnull=True)
        return qs

    def perform_create(self, serializer: Any) -> None:
        data = dict(serializer.validated_data)
        project = data.pop("project", None)
        if (
            project is not None
            and not visible_projects(acting_user(self.request)).filter(pk=project.pk).exists()
        ):
            raise Http404
        serializer.instance = services.create_naming_rule(
            acting_user(self.request), project=project, **data
        )

    def perform_update(self, serializer: Any) -> None:
        data = {k: v for k, v in serializer.validated_data.items() if k != "project"}
        serializer.instance = services.update_naming_rule(
            acting_user(self.request), serializer.instance, **data
        )

    def perform_destroy(self, instance: NamingRule) -> None:
        services.delete_naming_rule(acting_user(self.request), instance)


class NamingTestView(APIView):
    """S-14 live tester: paste a file name or sheet number, see pass/fail."""

    action_permissions = {"POST": Action.VIEW_ORG_REFERENCE}

    @extend_schema(request=NamingTestSerializer, responses=NamingTestResultSerializer)
    def post(self, request: Request) -> Response:
        from apps.register.naming import test_value

        payload = NamingTestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        user = acting_user(request)
        project = None
        if pid := payload.validated_data.get("project"):
            project = visible_projects(user).filter(pk=pid).first()
        problems = test_value(
            project, payload.validated_data["target"], payload.validated_data["value"], user.org_pk
        )
        return Response({"passes": not problems, "problems": problems})


class SheetBulkView(ProjectNestedMixin, APIView):
    """F-46: one change to many sheets; reports what was skipped and why."""

    action_permissions = {"POST": Action.VIEW_PROJECT}

    @extend_schema(request=BulkRequestSerializer, responses=BulkResultSerializer)
    def post(self, request: Request, project_pk: str) -> Response:
        payload = BulkRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        result = services.bulk_update(acting_user(request), self.project, **payload.validated_data)
        return Response(result)

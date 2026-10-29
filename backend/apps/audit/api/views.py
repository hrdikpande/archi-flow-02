import csv
import json
from collections.abc import Iterator

from django.db.models import QuerySet
from django.http import StreamingHttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request

from apps.accounts.permissions import Action, require
from apps.accounts.request import acting_user
from apps.audit import services
from apps.audit.models import AuditEvent
from apps.audit.selectors import audit_events
from apps.core.pagination import DefaultCursorPagination

from .serializers import AuditEventSerializer, AuditFilterSerializer


class AuditCursor(DefaultCursorPagination):
    ordering = "-at"


def _cell(value: object) -> str:
    """Neutralise spreadsheet formulas in user-controlled text (CSV injection)."""
    text = "" if value is None else str(value)
    risky = len(text) > 1 and text[0] in ("=", "+", "-", "@", "\t", "\r")
    return f"'{text}" if risky else text


class _Echo:
    def write(self, value: str) -> str:
        return value


@extend_schema(parameters=[AuditFilterSerializer])
class AuditEventViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AuditEventSerializer
    pagination_class = AuditCursor
    action_permissions = {"list": Action.EXPORT_AUDIT, "export": Action.EXPORT_AUDIT}

    def _filters(self) -> dict:
        f = AuditFilterSerializer(data=self.request.query_params)
        f.is_valid(raise_exception=True)
        return dict(f.validated_data)

    def get_queryset(self) -> QuerySet[AuditEvent]:
        return audit_events(acting_user(self.request).org_pk, self._filters())

    @extend_schema(responses={(200, "text/csv"): OpenApiResponse(OpenApiTypes.BINARY)})
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request: Request) -> StreamingHttpResponse:
        """CSV of the filtered trail (F-39: Admin can export). The export is itself audited."""
        require(acting_user(request), Action.EXPORT_AUDIT)
        filters = self._filters()
        services.record(
            organisation_id=acting_user(request).org_pk,
            actor=acting_user(request),
            verb="audit.exported",
            entity_type="audit.auditevent",
            entity_id="-",
            after={k: str(v) for k, v in filters.items()},
        )
        rows = audit_events(acting_user(request).org_pk, filters).order_by("at").iterator()
        writer = csv.writer(_Echo())
        header = [
            "at",
            "actor",
            "verb",
            "entity_type",
            "entity_id",
            "entity",
            "before",
            "after",
            "ip",
            "request_id",
        ]

        def stream() -> Iterator[str]:
            yield writer.writerow(header)
            for e in rows:
                yield writer.writerow(
                    _cell(v)
                    for v in (
                        e.at.isoformat(),
                        e.actor_label,
                        e.verb,
                        e.entity_type,
                        e.entity_id,
                        e.entity_label,
                        json.dumps(e.before),
                        json.dumps(e.after),
                        e.ip,
                        e.request_id,
                    )
                )

        stamp = timezone.localtime().strftime("%Y%m%d-%H%M")
        response = StreamingHttpResponse(stream(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="audit-{stamp}.csv"'
        return response

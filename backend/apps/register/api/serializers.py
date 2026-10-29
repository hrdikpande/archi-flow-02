from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.models import Discipline
from apps.projects.api.serializers import UserMiniSerializer
from apps.projects.models import Package, Stage
from apps.register.imports import FIELDS
from apps.register.models import (
    ImportJob,
    NamingRule,
    NamingTarget,
    SavedView,
    Sheet,
    SheetRevision,
)
from apps.register.services import BULK_OPS


class SheetFlagSerializer(serializers.Serializer):
    """An open flag on a sheet (F-20). `days` is working days due-in (at_risk) or late."""

    kind = serializers.CharField()
    rule = serializers.CharField()
    raised_at = serializers.DateTimeField()
    days = serializers.IntegerField(allow_null=True)
    escalated = serializers.BooleanField()


class SheetSerializer(serializers.ModelSerializer):
    """Register row. Read fields are flat so 1,000 rows stay light (N-01)."""

    discipline_code = serializers.CharField(source="discipline.code", read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True)
    package_name = serializers.CharField(source="package.name", read_only=True, default=None)
    owner_detail = UserMiniSerializer(source="owner", read_only=True)
    checker_detail = UserMiniSerializer(source="checker", read_only=True)
    effective_planned_date = serializers.DateField(read_only=True)
    current_revision_code = serializers.CharField(
        source="current_revision.code", read_only=True, default=None
    )
    flags = serializers.SerializerMethodField()
    discipline = OrgPrimaryKeyRelatedField(queryset=Discipline.objects.all())
    stage = OrgPrimaryKeyRelatedField(queryset=Stage.objects.all())
    package = OrgPrimaryKeyRelatedField(
        queryset=Package.objects.all(), allow_null=True, required=False
    )
    owner = OrgPrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)
    checker = OrgPrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Sheet
        fields = [
            "id",
            "project",
            "number",
            "title",
            "aliases",
            "discipline",
            "discipline_code",
            "stage",
            "stage_name",
            "package",
            "package_name",
            "owner",
            "owner_detail",
            "checker",
            "checker_detail",
            "planned_issue_date",
            "effective_planned_date",
            "state",
            "current_revision",
            "current_revision_code",
            "cad_link",
            "notes",
            "replaced_by",
            "state_changed_at",
            "updated_at",
            "flags",
        ]
        read_only_fields = [
            "id",
            "project",
            "aliases",
            "state",
            "current_revision",
            "replaced_by",
            "state_changed_at",
            "updated_at",
            "flags",
        ]

    @extend_schema_field(SheetFlagSerializer(many=True))
    def get_flags(self, obj: Sheet) -> list[dict[str, Any]]:
        """Open flags, prefetched as `open_flags` by the register selector (S4)."""
        return [
            {
                "kind": f.kind,
                "rule": f.rule,
                "raised_at": f.raised_at,
                "days": f.data.get("days"),
                "escalated": bool(f.data.get("escalated_at")),
            }
            for f in getattr(obj, "open_flags", [])
        ]


class SavedViewSerializer(serializers.ModelSerializer):
    serializer_related_field = OrgPrimaryKeyRelatedField

    class Meta:
        model = SavedView
        fields = ["id", "name", "project", "config", "created_at"]
        read_only_fields = ["id", "created_at"]


class ImportFieldSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    required = serializers.BooleanField()  # type: ignore[assignment]


class ImportJobSerializer(serializers.ModelSerializer):
    fields_available = serializers.SerializerMethodField()

    class Meta:
        model = ImportJob
        fields = [
            "id",
            "project",
            "original_name",
            "headers",
            "mapping",
            "skip_rows",
            "overrides",
            "state",
            "report",
            "committed_at",
            "undo_until",
            "fields_available",
            "created_at",
            "created_sheet_ids",
        ]
        read_only_fields = fields

    @extend_schema_field(ImportFieldSerializer(many=True))
    def get_fields_available(self, obj: ImportJob) -> list[dict]:
        return [
            {"key": k, "label": v["label"], "required": v["required"]} for k, v in FIELDS.items()
        ]


class ImportUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class ImportUpdateSerializer(serializers.Serializer):
    mapping = serializers.DictField(child=serializers.IntegerField(min_value=0), required=False)
    skip_rows = serializers.ListField(child=serializers.IntegerField(min_value=0), required=False)
    overrides = serializers.DictField(
        child=serializers.DictField(child=serializers.CharField(allow_blank=True)), required=False
    )


class RevisionSerializer(serializers.ModelSerializer):
    uploaded_by = UserMiniSerializer(read_only=True)
    issued_by = UserMiniSerializer(read_only=True)
    page_count = serializers.IntegerField(source="file.page_count", read_only=True, default=None)
    size = serializers.IntegerField(source="file.size", read_only=True, default=None)
    has_file = serializers.SerializerMethodField()
    transmittal_number = serializers.SerializerMethodField()

    class Meta:
        model = SheetRevision
        fields = [
            "id",
            "code",
            "seq",
            "state",
            "purpose",
            "suitability",
            "original_name",
            "naming_status",
            "naming_message",
            "change_summary",
            "uploaded_by",
            "issued_at",
            "issued_by",
            "superseded_at",
            "is_historic",
            "page_count",
            "size",
            "has_file",
            "transmittal_number",
            "created_at",
        ]
        read_only_fields = fields

    def get_has_file(self, obj: SheetRevision) -> bool:
        return obj.file_id is not None

    def get_transmittal_number(self, obj: SheetRevision) -> str | None:
        transmittal = getattr(obj, "transmittal", None)
        return getattr(transmittal, "number", None)


class RevisionUploadSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()
    change_summary = serializers.CharField(required=False, allow_blank=True, max_length=500)
    series = serializers.CharField(required=False, allow_null=True, max_length=2)


class DownloadSerializer(serializers.Serializer):
    url = serializers.URLField()
    filename = serializers.CharField()
    watermarked = serializers.BooleanField()


class NamingRuleSerializer(serializers.ModelSerializer):
    serializer_related_field = OrgPrimaryKeyRelatedField

    class Meta:
        model = NamingRule
        fields = ["id", "project", "target", "regex", "example", "message", "is_active"]


class NamingTestSerializer(serializers.Serializer):
    target = serializers.ChoiceField(choices=NamingTarget.choices)
    value = serializers.CharField(max_length=300)
    project = serializers.UUIDField(required=False, allow_null=True)


class NamingTestResultSerializer(serializers.Serializer):
    passes = serializers.BooleanField()
    problems = serializers.ListField(child=serializers.CharField())


class BulkRequestSerializer(serializers.Serializer):
    sheet_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=2000)
    op = serializers.ChoiceField(choices=[(o, o) for o in BULK_OPS])
    value = serializers.JSONField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class BulkSkippedSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    reason = serializers.CharField()


class BulkResultSerializer(serializers.Serializer):
    updated = serializers.ListField(child=serializers.UUIDField())
    skipped = BulkSkippedSerializer(many=True)

from typing import Any

from rest_framework import serializers

from apps.projects.api.serializers import UserMiniSerializer
from apps.register.api.serializers import SheetSerializer
from apps.workflow.models import Review


class AllowedActionSerializer(serializers.Serializer):
    action = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    primary = serializers.BooleanField()
    needs_reason = serializers.BooleanField()
    hint = serializers.CharField(allow_blank=True)
    blocked_reason = serializers.CharField(allow_null=True)


class TransitionRequestSerializer(serializers.Serializer):
    action = serializers.CharField(max_length=32)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    redline_upload_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    checklist = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Pre-check items ticked (F-13), on submit",
    )


class ReviewActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    redline_upload_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class RedlineUploadSerializer(serializers.Serializer):
    upload_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserMiniSerializer(read_only=True)
    revision_code = serializers.CharField(source="revision.code", read_only=True, default=None)
    redline_files = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "kind",
            "round",
            "state",
            "reviewer",
            "revision",
            "revision_code",
            "opened_at",
            "closed_at",
            "comment",
            "redline_files",
        ]
        read_only_fields = fields

    def get_redline_files(self, obj: Review) -> list[dict]:
        return [
            {"id": str(f.pk), "name": f.original_name, "mime": f.mime} for f in obj.redlines.all()
        ]


class QueueItemSerializer(serializers.Serializer):
    kind = serializers.CharField()
    sheet = SheetSerializer()
    project_code = serializers.CharField(source="sheet.project.code")
    project_name = serializers.CharField(source="sheet.project.name")
    review_id = serializers.UUIDField(source="review.id", allow_null=True, default=None)
    senior_qc_needed = serializers.SerializerMethodField()
    waiting_since = serializers.DateTimeField()
    working_days_waiting = serializers.IntegerField()
    delegated_from = UserMiniSerializer(allow_null=True)

    def get_senior_qc_needed(self, obj: Any) -> bool:
        return bool(obj.sheet.stage.requires_senior_qc)


class TimelineEntrySerializer(serializers.Serializer):
    at = serializers.DateTimeField()
    kind = serializers.CharField()
    text = serializers.CharField()
    actor = serializers.CharField(allow_blank=True)
    detail = serializers.CharField(allow_blank=True)

from rest_framework import serializers

from apps.files.models import Upload, UploadKind


class PresignRequestSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=300)
    size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100)
    kind = serializers.ChoiceField(choices=UploadKind.choices, default=UploadKind.SHEET)


class UploadSerializer(serializers.ModelSerializer):
    file_id = serializers.UUIDField(source="file.id", read_only=True, allow_null=True)
    sha256 = serializers.CharField(source="file.sha256", read_only=True, allow_null=True)

    class Meta:
        model = Upload
        fields = [
            "id",
            "kind",
            "original_name",
            "declared_size",
            "state",
            "reason",
            "is_duplicate",
            "file_id",
            "sha256",
            "created_at",
        ]
        read_only_fields = fields


class PresignResponseSerializer(serializers.Serializer):
    upload = UploadSerializer()
    url = serializers.URLField()
    method = serializers.CharField()
    headers = serializers.DictField(child=serializers.CharField())
    expires_at = serializers.DateTimeField()

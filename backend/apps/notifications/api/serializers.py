from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "event", "title", "body", "link", "project", "created_at", "read_at"]
        read_only_fields = fields


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_null=True)


class PreferenceSerializer(serializers.Serializer):
    event = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    mode = serializers.CharField()
    default = serializers.CharField()
    mandatory = serializers.BooleanField()
    phase = serializers.CharField()


class PreferencesUpdateSerializer(serializers.Serializer):
    modes = serializers.DictField(
        child=serializers.ChoiceField(choices=["instant", "digest", "off"]),
        required=False,
        default=dict,
    )
    quiet_from = serializers.TimeField(required=False, allow_null=True)
    quiet_to = serializers.TimeField(required=False, allow_null=True)


class PreferencesSerializer(serializers.Serializer):
    events = PreferenceSerializer(many=True)
    quiet_from = serializers.TimeField(allow_null=True)
    quiet_to = serializers.TimeField(allow_null=True)
    unread = serializers.IntegerField()

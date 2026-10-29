from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "at",
            "actor",
            "actor_label",
            "verb",
            "entity_type",
            "entity_id",
            "entity_label",
            "before",
            "after",
            "ip",
            "request_id",
        ]
        read_only_fields = fields


class AuditFilterSerializer(serializers.Serializer):
    entity_type = serializers.CharField(required=False)
    entity_id = serializers.CharField(required=False)
    actor = serializers.UUIDField(required=False)
    verb = serializers.CharField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

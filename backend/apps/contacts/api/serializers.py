from rest_framework import serializers

from apps.contacts.models import Contact, ExternalOrg
from apps.core.api.fields import OrgPrimaryKeyRelatedField


class ExternalOrgSerializer(serializers.ModelSerializer):
    contact_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ExternalOrg
        fields = ["id", "name", "kind", "email", "phone", "address", "is_active", "contact_count"]


class ContactSerializer(serializers.ModelSerializer):
    serializer_related_field = OrgPrimaryKeyRelatedField

    external_org_name = serializers.CharField(source="external_org.name", read_only=True)
    confirm_duplicate = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text="Set after a duplicate_email warning to save anyway.",
    )

    class Meta:
        model = Contact
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "designation",
            "external_org",
            "external_org_name",
            "is_active",
            "confirm_duplicate",
        ]

    def validate_external_org(self, value: ExternalOrg | None) -> ExternalOrg | None:
        request = self.context.get("request")
        if (
            value is not None
            and request is not None
            and value.organisation_id != request.user.organisation_id
        ):
            raise serializers.ValidationError("Unknown organisation.")
        return value

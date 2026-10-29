from rest_framework import serializers

from apps.accounts.models import ApiToken, ApiTokenScope, User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.api.fields import OrgPrimaryKeyRelatedField


class OrganisationSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    timezone = serializers.CharField()
    work_week = serializers.CharField()


class MembershipSummarySerializer(serializers.Serializer):
    project_id = serializers.UUIDField()
    project_code = serializers.CharField()
    role = serializers.ChoiceField(choices=ProjectRole.choices)


class MfaStatusSerializer(serializers.Serializer):
    totp_enabled = serializers.BooleanField()
    setup_required = serializers.BooleanField()


class CapabilitiesSerializer(serializers.Serializer):
    manage_org_settings = serializers.BooleanField()
    export_audit = serializers.BooleanField()
    manage_contacts = serializers.BooleanField()
    create_project = serializers.BooleanField()
    upload_files = serializers.BooleanField()
    log_own_timesheet = serializers.BooleanField()
    manage_staff = serializers.BooleanField()
    allocate_hours = serializers.BooleanField(help_text="PL or DL on any active project")
    view_portfolio = serializers.BooleanField()
    view_baseline = serializers.BooleanField()
    view_hours_report = serializers.BooleanField()
    view_billing = serializers.BooleanField()
    mark_invoiced = serializers.BooleanField()
    view_forecasts = serializers.BooleanField()


class MeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    short_name = serializers.CharField()
    org_role = serializers.ChoiceField(choices=OrgRole.choices)
    organisation = OrganisationSummarySerializer()
    memberships = MembershipSummarySerializer(many=True)
    capabilities = CapabilitiesSerializer()
    mfa = MfaStatusSerializer()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "short_name",
            "org_role",
            "is_active",
            "can_lead_projects",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "email", "short_name", "date_joined", "last_login"]


class ApiTokenSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    is_usable = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApiToken
        fields = [
            "id",
            "name",
            "user",
            "user_email",
            "key_id",
            "scopes",
            "expires_at",
            "revoked_at",
            "last_used_at",
            "is_usable",
            "created_at",
        ]
        read_only_fields = fields


class ApiTokenCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    user = OrgPrimaryKeyRelatedField(queryset=User.objects.all())
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=ApiTokenScope.choices), min_length=1
    )
    expires_in_days = serializers.IntegerField(min_value=1, max_value=365, default=90)


class ApiTokenCreatedSerializer(ApiTokenSerializer):
    token = serializers.CharField(read_only=True, help_text="Shown once. Store it securely.")

    class Meta(ApiTokenSerializer.Meta):
        fields = [*ApiTokenSerializer.Meta.fields, "token"]
        read_only_fields = fields


class DirectoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "short_name", "email", "org_role", "can_lead_projects"]
        read_only_fields = fields

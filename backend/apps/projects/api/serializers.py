from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.permissions import Action, can
from apps.accounts.roles import ProjectRole
from apps.contacts.models import ExternalOrg
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.models import Discipline
from apps.projects.models import (
    Package,
    Project,
    ProjectMembership,
    Stage,
    StageState,
    StageTemplate,
    StageTemplateItem,
)
from apps.projects.stage_machine import STAGE_TRANSITIONS

PROJECT_CAPABILITIES = {
    "edit_project": Action.EDIT_STAGES,
    "edit_sheets": Action.EDIT_SHEETS,
    "review": Action.REVIEW_SHEET,
    "issue": Action.ISSUE_SHEETS,
    "hold_cancel": Action.HOLD_CANCEL_SUPERSEDE,
    "allocate": Action.ALLOCATE_HOURS,
    "approve_timesheets": Action.APPROVE_TIMESHEETS,
    "upload_draft": Action.UPLOAD_DRAFT,
    "log_comments": Action.LOG_CLIENT_COMMENTS,
    "record_approval": Action.RECORD_CLIENT_APPROVAL,
    "manage_ca": Action.MANAGE_CA,
    "review_submittal": Action.REVIEW_SUBMITTAL,
    "approve_change_order": Action.APPROVE_CHANGE_ORDER,
    "file_site_report": Action.FILE_SITE_REPORT,
    "manage_clashes": Action.MANAGE_CLASHES,
    "log_decisions": Action.LOG_DECISIONS,
    "view_forecasts": Action.VIEW_FORECASTS,
    "review_findings": Action.REVIEW_FINDINGS,
}


class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "short_name", "email"]
        read_only_fields = fields


class StageMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ["id", "seq", "name", "state", "planned_end"]
        read_only_fields = fields


class ProjectPermissionsSerializer(serializers.Serializer):
    """What the signed-in user may do on this project (keys of PROJECT_CAPABILITIES)."""

    edit_project = serializers.BooleanField()
    edit_sheets = serializers.BooleanField()
    review = serializers.BooleanField()
    issue = serializers.BooleanField()
    hold_cancel = serializers.BooleanField()
    allocate = serializers.BooleanField()
    approve_timesheets = serializers.BooleanField()
    upload_draft = serializers.BooleanField()
    log_comments = serializers.BooleanField()
    record_approval = serializers.BooleanField()
    manage_ca = serializers.BooleanField()
    review_submittal = serializers.BooleanField()
    approve_change_order = serializers.BooleanField()
    file_site_report = serializers.BooleanField()
    manage_clashes = serializers.BooleanField()
    log_decisions = serializers.BooleanField()
    view_forecasts = serializers.BooleanField()
    review_findings = serializers.BooleanField()


class ProjectSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True, default=None)
    current_stage = serializers.SerializerMethodField()
    lead = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    my_permissions = serializers.SerializerMethodField()
    inbound_address = serializers.SerializerMethodField(help_text="F-25: email comments here")
    client = OrgPrimaryKeyRelatedField(
        queryset=ExternalOrg.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "code",
            "name",
            "client",
            "client_name",
            "type",
            "location",
            "status",
            "start_date",
            "end_date",
            "cad_versions",
            "stage_plan_final",
            "appointment_letter",
            "current_stage",
            "lead",
            "my_role",
            "my_permissions",
            "inbound_address",
            "created_at",
        ]
        read_only_fields = ["id", "stage_plan_final", "created_at", "appointment_letter"]

    def get_inbound_address(self, obj: Project) -> str:
        from apps.comments.inbound import project_address

        return project_address(obj)

    def validate_client(self, value: ExternalOrg | None) -> ExternalOrg | None:
        request = self.context.get("request")
        if value is not None and request and value.organisation_id != request.user.organisation_id:
            raise serializers.ValidationError("Unknown client organisation.")
        return value

    def validate(self, attrs: dict) -> dict:
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date is before the start date."})
        return attrs

    @extend_schema_field(StageMiniSerializer(allow_null=True))
    def get_current_stage(self, obj: Project) -> dict | None:
        stages = list(obj.stages.all())
        current = next((s for s in stages if s.state == StageState.ACTIVE), None) or next(
            (s for s in stages if s.state not in (StageState.CLOSED, StageState.INVOICED)), None
        )
        return StageMiniSerializer(current).data if current else None

    @extend_schema_field(UserMiniSerializer(allow_null=True))
    def get_lead(self, obj: Project) -> dict | None:
        lead = next((m.user for m in obj.memberships.all() if m.role == ProjectRole.PL), None)
        return UserMiniSerializer(lead).data if lead else None

    @extend_schema_field(ProjectPermissionsSerializer)
    def get_my_permissions(self, obj: Project) -> dict[str, bool]:
        """What the signed-in user may do here; the UI shows only these (DESIGN.md §6)."""
        request = self.context.get("request")
        if request is None:
            return {}
        user = request.user
        return {key: can(user, action, project=obj) for key, action in PROJECT_CAPABILITIES.items()}

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_my_role(self, obj: Project) -> str | None:
        request = self.context.get("request")
        if request is None:
            return None
        return next((m.role for m in obj.memberships.all() if m.user_id == request.user.pk), None)


class ProjectCreateSerializer(ProjectSerializer):
    lead_id = OrgPrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        write_only=True,
        source="lead",
    )

    class Meta(ProjectSerializer.Meta):
        fields = [*ProjectSerializer.Meta.fields, "lead_id"]


class StageActionSerializer(serializers.Serializer):
    action = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]


class StageSerializer(serializers.ModelSerializer):
    allowed_actions = serializers.SerializerMethodField()
    sheet_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Stage
        fields = [
            "id",
            "seq",
            "name",
            "fee_pct",
            "fee_amount",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "state",
            "requires_senior_qc",
            "required_purposes",
            "allowed_actions",
            "sheet_count",
        ]
        read_only_fields = ["state", "actual_start", "actual_end"]

    @extend_schema_field(StageActionSerializer(many=True))
    def get_allowed_actions(self, obj: Stage) -> list[dict[str, str]]:
        return [
            {"action": a, "label": t.label}
            for a, t in STAGE_TRANSITIONS.items()
            if t.manual and obj.state in t.sources
        ]


class StagePlanItemSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, allow_null=True)
    seq = serializers.IntegerField(min_value=1, max_value=99)
    name = serializers.CharField(max_length=120)
    fee_pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)
    fee_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    planned_start = serializers.DateField(required=False, allow_null=True)
    planned_end = serializers.DateField(required=False, allow_null=True)
    requires_senior_qc = serializers.BooleanField(default=False)
    required_purposes = serializers.ListField(
        child=serializers.CharField(max_length=6), required=False, default=list
    )


class StagePlanSerializer(serializers.Serializer):
    stages = StagePlanItemSerializer(many=True)
    final = serializers.BooleanField(default=False)


class ApplyTemplateSerializer(serializers.Serializer):
    template = OrgPrimaryKeyRelatedField(queryset=StageTemplate.objects.all())


class StageTransitionRequestSerializer(serializers.Serializer):
    action = serializers.CharField(max_length=40)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class PackageSerializer(serializers.ModelSerializer):
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )
    sheet_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Package
        fields = ["id", "name", "discipline", "planned_date", "sheet_count"]


class MembershipSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)
    user_id = OrgPrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), write_only=True, source="user"
    )
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = ProjectMembership
        fields = ["id", "user", "user_id", "role", "discipline", "created_at"]
        read_only_fields = ["id", "created_at"]


class MembershipUpdateSerializer(serializers.ModelSerializer):
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = ProjectMembership
        fields = ["role", "discipline"]


class StageTemplateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageTemplateItem
        fields = ["seq", "name", "fee_pct", "required_purposes", "requires_senior_qc"]
        read_only_fields = ["seq"]


class StageTemplateSerializer(serializers.ModelSerializer):
    items = StageTemplateItemSerializer(many=True)
    fee_total = serializers.SerializerMethodField()

    class Meta:
        model = StageTemplate
        fields = ["id", "name", "is_default", "items", "fee_total"]

    @extend_schema_field(serializers.CharField())
    def get_fee_total(self, obj: StageTemplate) -> str:
        return str(sum((i.fee_pct for i in obj.items.all()), start=0))

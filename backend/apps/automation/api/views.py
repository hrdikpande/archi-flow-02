from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.permissions import Action, require
from apps.accounts.request import acting_user
from apps.audit.services import record_change, snapshot
from apps.automation import engine
from apps.automation.defaults import DEFAULT_RULES, SCHEDULES
from apps.automation.models import AutomationRule, AutomationRun
from apps.core.exceptions import DomainError
from apps.core.pagination import DefaultCursorPagination

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

RULE_LABELS = {
    "A-01": "At risk: planned date within N working days",
    "A-02": "Late: planned date passed; escalate after N working days",
    "A-05": "Over / under-allocated people (weekly)",
    "A-06": "Timesheet missing reminder (weekly)",
    "A-07": "Review open too long (P2)",
    "A-08": "Client comment unanswered (P2)",
    "A-10": "RFI due soon (P3)",
}


class AutomationRuleSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()  # type: ignore[assignment]
    schedule = serializers.SerializerMethodField()

    class Meta:
        model = AutomationRule
        fields = ["id", "key", "label", "enabled", "params", "schedule"]
        read_only_fields = ["id", "key", "label", "schedule"]

    def get_label(self, obj: AutomationRule) -> str:
        return RULE_LABELS.get(obj.key, obj.key)

    def get_schedule(self, obj: AutomationRule) -> str:
        spec = SCHEDULES.get(obj.key, {})
        if "daily" in spec:
            return f"Daily {spec['daily']}"
        if "weekly" in spec:
            day, at = spec["weekly"]
            return f"{WEEKDAYS[day]} {at}"
        return "On event"


class AutomationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRun
        fields = [
            "id",
            "rule",
            "run_date",
            "started_at",
            "finished_at",
            "raised",
            "cleared",
            "notified",
            "error",
        ]
        read_only_fields = fields


class RunCursor(DefaultCursorPagination):
    ordering = "-started_at"


class AutomationRuleViewSet(
    mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """F-42 automation thresholds (Admin). Rules are code; only params and on/off are data."""

    serializer_class = AutomationRuleSerializer
    queryset = AutomationRule.objects.none()
    pagination_class = None
    http_method_names = ["get", "patch", "post", "head", "options"]
    action_permissions = {
        "list": Action.VIEW_ORG_REFERENCE,
        "partial_update": Action.MANAGE_ORG_SETTINGS,
        "run": Action.MANAGE_ORG_SETTINGS,
    }

    def get_queryset(self) -> QuerySet[AutomationRule]:
        org = acting_user(self.request).org
        for key in DEFAULT_RULES:
            engine.rule_config(org, key)
        return AutomationRule.objects.filter(organisation=org)

    def perform_update(self, serializer: Any) -> None:
        actor = acting_user(self.request)
        require(actor, Action.MANAGE_ORG_SETTINGS)
        rule = serializer.instance
        params = serializer.validated_data.get("params")
        if params is not None:
            allowed = set(DEFAULT_RULES.get(rule.key, {}))
            unknown = set(params) - allowed
            if unknown:
                raise DomainError(
                    "unknown_params", f"Unknown settings: {', '.join(sorted(unknown))}."
                )
            for k, v in params.items():
                if isinstance(DEFAULT_RULES[rule.key][k], int) and (
                    not isinstance(v, int) or v < 0
                ):
                    raise DomainError("invalid_params", f"{k} must be a whole number of 0 or more.")
        before = snapshot(rule, ("enabled", "params"))
        serializer.save()
        record_change(
            rule,
            actor=actor,
            verb="automation_rule.updated",
            before=before,
            after=snapshot(rule, ("enabled", "params")),
        )

    @extend_schema(request=None, responses=AutomationRunSerializer)
    @action(detail=True, methods=["post"])
    def run(self, request: Request, pk: str | None = None) -> Response:
        """Run a sweep now (support use); still idempotent."""
        rule = self.get_object()
        if rule.key not in engine.RULES:
            raise DomainError("not_scheduled", "This rule runs on events, not as a sweep.")
        run = engine.run_rule(rule.organisation, rule.key)
        return Response(AutomationRunSerializer(run).data)


class AutomationRunViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AutomationRunSerializer
    queryset = AutomationRun.objects.none()
    pagination_class = RunCursor
    action_permissions = {"list": Action.MANAGE_ORG_SETTINGS}

    def get_queryset(self) -> QuerySet[AutomationRun]:
        return AutomationRun.objects.filter(organisation_id=acting_user(self.request).org_pk)

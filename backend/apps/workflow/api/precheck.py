"""S7 API: pre-check lists (F-13), the checklist builder (S-19) and review delegation (F-12)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import Action
from apps.accounts.request import acting_user
from apps.core.api.fields import OrgPrimaryKeyRelatedField
from apps.core.models import Discipline
from apps.projects.api.serializers import UserMiniSerializer
from apps.workflow import checklists, delegation
from apps.workflow.models import Checklist, Delegation

from .views import _SheetObject


class ChecklistItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    text = serializers.CharField(max_length=300)
    mandatory = serializers.BooleanField(default=True)


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True)
    discipline = OrgPrimaryKeyRelatedField(
        queryset=Discipline.objects.all(), allow_null=True, required=False
    )
    discipline_code = serializers.CharField(source="discipline.code", read_only=True, default=None)

    class Meta:
        model = Checklist
        fields = [
            "id",
            "name",
            "discipline",
            "discipline_code",
            "stage_names",
            "is_active",
            "items",
        ]
        read_only_fields = ["id"]


class PrecheckItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    checklist = serializers.CharField()
    text = serializers.CharField()
    mandatory = serializers.BooleanField()
    ticked = serializers.BooleanField()


class PrecheckSerializer(serializers.Serializer):
    round = serializers.IntegerField(help_text="The round the ticks belong to")
    items = PrecheckItemSerializer(many=True)
    submitted_at = serializers.DateTimeField(allow_null=True)


class SheetPrecheckView(_SheetObject):
    """Items to tick before submit, or the ticks given for the round under review."""

    action_permissions = {"GET": Action.VIEW_PROJECT}

    @extend_schema(responses=PrecheckSerializer)
    def get(self, request: Request, pk: str) -> Response:
        sheet = self.get_object()
        stored = checklists.response_for(sheet, sheet.review_round)
        reviewing = sheet.state in ("ready_for_check", "in_check")
        if stored is not None and reviewing:
            data = {"round": stored.round, "items": stored.items, "submitted_at": stored.created_at}
        else:
            data = {
                "round": sheet.review_round + 1,
                "items": [
                    {
                        "id": i.pk,
                        "checklist": i.checklist.name,
                        "text": i.text,
                        "mandatory": i.mandatory,
                        "ticked": False,
                    }
                    for i in checklists.items_for(sheet)
                ],
                "submitted_at": None,
            }
        return Response(PrecheckSerializer(data).data)


class ChecklistListView(generics.ListCreateAPIView):
    serializer_class = ChecklistSerializer
    pagination_class = None
    queryset = Checklist.objects.none()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "POST": Action.MANAGE_ORG_SETTINGS}

    def get_queryset(self) -> QuerySet[Checklist]:
        return checklists.org_checklists(acting_user(self.request)).select_related("discipline")

    def perform_create(self, serializer: Any) -> None:
        data = dict(serializer.validated_data)
        serializer.instance = checklists.save_checklist(
            acting_user(self.request), None, items=data.pop("items"), **data
        )


class ChecklistDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChecklistSerializer
    queryset = Checklist.objects.none()
    action_permissions = {
        "GET": Action.VIEW_ORG_REFERENCE,
        "PUT": Action.MANAGE_ORG_SETTINGS,
        "PATCH": Action.MANAGE_ORG_SETTINGS,
        "DELETE": Action.MANAGE_ORG_SETTINGS,
    }

    def get_queryset(self) -> QuerySet[Checklist]:
        return checklists.org_checklists(acting_user(self.request))

    def perform_update(self, serializer: Any) -> None:
        data = dict(serializer.validated_data)
        items = data.pop("items", None)
        if items is None:
            items = [
                {"text": i.text, "mandatory": i.mandatory} for i in serializer.instance.items.all()
            ]
        serializer.instance = checklists.save_checklist(
            acting_user(self.request), serializer.instance, items=items, **data
        )

    def perform_destroy(self, instance: Checklist) -> None:
        checklists.delete_checklist(acting_user(self.request), instance)


class DelegationSerializer(serializers.ModelSerializer):
    user = OrgPrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    delegate = OrgPrimaryKeyRelatedField(queryset=User.objects.all())
    user_detail = UserMiniSerializer(source="user", read_only=True)
    delegate_detail = UserMiniSerializer(source="delegate", read_only=True)

    class Meta:
        model = Delegation
        fields = [
            "id",
            "user",
            "user_detail",
            "delegate",
            "delegate_detail",
            "start",
            "end",
            "note",
        ]
        read_only_fields = ["id"]


class DelegationListView(generics.ListCreateAPIView):
    """F-12: mine, the ones to me, and (Admin/DL) everyone's."""

    serializer_class = DelegationSerializer
    pagination_class = None
    queryset = Delegation.objects.none()
    action_permissions = {"GET": Action.VIEW_ORG_REFERENCE, "POST": Action.VIEW_ORG_REFERENCE}

    def get_queryset(self) -> QuerySet[Delegation]:
        return delegation.visible_delegations(acting_user(self.request))

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        payload = DelegationSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        actor = acting_user(request)
        d = dict(payload.validated_data)
        person = d.pop("user", None) or actor
        for who in (person, d["delegate"]):
            if who.organisation_id != actor.organisation_id:
                raise serializers.ValidationError({"delegate": "Unknown person."})
        obj = delegation.set_delegation(actor, user=person, **d)
        return Response(DelegationSerializer(obj).data, status=status.HTTP_201_CREATED)


class DelegationDetailView(generics.DestroyAPIView):
    serializer_class = DelegationSerializer
    queryset = Delegation.objects.none()
    action_permissions = {"DELETE": Action.VIEW_ORG_REFERENCE}

    def get_queryset(self) -> QuerySet[Delegation]:
        return delegation.visible_delegations(acting_user(self.request))

    def perform_destroy(self, instance: Delegation) -> None:
        delegation.remove_delegation(acting_user(self.request), instance)

"""Request bodies can only reference the caller's own firm (OrgPrimaryKeyRelatedField)."""

import contextlib
import importlib

import pytest
from django.conf import settings
from rest_framework import serializers
from rest_framework.test import APIRequestFactory

from apps.accounts.models import User
from apps.core.api.fields import OrgPrimaryKeyRelatedField


class PickUsers(serializers.Serializer):
    user = OrgPrimaryKeyRelatedField(queryset=User.objects.all())
    users = OrgPrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)


def context_for(user):
    request = APIRequestFactory().post("/")
    request.user = user
    return {"request": request}


@pytest.mark.django_db
class TestOrgPrimaryKeyRelatedField:
    def test_own_firm_resolves(self, make_user):
        me, colleague = make_user(), make_user()
        s = PickUsers(data={"user": colleague.pk, "users": [colleague.pk]}, context=context_for(me))
        assert s.is_valid(), s.errors

    def test_another_firm_reads_as_missing(self, make_user, other_org):
        me, outsider = make_user(), make_user(organisation=other_org)
        s = PickUsers(data={"user": outsider.pk}, context=context_for(me))
        assert not s.is_valid()
        assert "does not exist" in str(s.errors["user"])

    def test_one_foreign_id_in_a_list_fails(self, make_user, other_org):
        me, outsider = make_user(), make_user(organisation=other_org)
        s = PickUsers(data={"user": me.pk, "users": [me.pk, outsider.pk]}, context=context_for(me))
        assert not s.is_valid()
        assert "users" in s.errors

    def test_without_a_request_nothing_resolves(self, make_user):
        me = make_user()
        assert not PickUsers(data={"user": me.pk}).is_valid()


def _all_serializers() -> set[type]:
    for app in settings.INSTALLED_APPS:
        if app.startswith("apps."):
            for module in ("api", "api.views", "api.serializers"):
                with contextlib.suppress(ModuleNotFoundError):
                    importlib.import_module(f"{app}.{module}")
    importlib.import_module(settings.ROOT_URLCONF)
    seen, todo = set(), [serializers.BaseSerializer]
    while todo:
        for sub in todo.pop().__subclasses__():
            if sub not in seen:
                seen.add(sub)
                todo.append(sub)
    return {s for s in seen if s.__module__.startswith("apps.")}


def test_every_writable_relation_to_firm_data_is_scoped():
    unscoped = []
    for cls in _all_serializers():
        try:
            fields = cls().fields
        except Exception:  # noqa: S112 - serializers that need arguments are skipped
            continue
        for name, field in fields.items():
            relation = getattr(field, "child_relation", field)
            if not isinstance(relation, serializers.PrimaryKeyRelatedField) or field.read_only:
                continue
            model = relation.queryset.model
            if any(f.name == "organisation" for f in model._meta.get_fields()) and not isinstance(
                relation, OrgPrimaryKeyRelatedField
            ):
                unscoped.append(f"{cls.__module__}.{cls.__name__}.{name}")
    assert not unscoped, "Use OrgPrimaryKeyRelatedField: " + ", ".join(sorted(unscoped))

from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers


class OrgPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """A related id from the caller's own organisation (DD-030). Another firm's id reads as
    "does not exist", so a request body can never point at foreign rows (services still check
    projects). Needs the request in the serializer context; without one, nothing resolves."""

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        assert queryset is not None, "writable relations always declare a queryset"  # noqa: S101
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return queryset.none()
        return queryset.filter(organisation_id=user.org_pk)

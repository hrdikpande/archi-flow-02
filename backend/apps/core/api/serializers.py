import re
import zoneinfo
from urllib.parse import urlsplit

from rest_framework import serializers

from apps.core import net
from apps.core.models import Discipline, Holiday, Organisation, OrgSettings

CODE_RE = re.compile(r"^[A-Z0-9]{1,6}$")


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = ["id", "name", "timezone", "currency", "work_week"]
        read_only_fields = ["id", "currency"]
        # Only ever written through PATCH /org/settings, so every field is optional.
        extra_kwargs = {"name": {"required": False}}

    def validate_timezone(self, value: str) -> str:
        if value not in zoneinfo.available_timezones():
            raise serializers.ValidationError("Unknown timezone.")
        return value


class CodeLabelSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)
    label = serializers.CharField(max_length=80)  # type: ignore[assignment]
    active = serializers.BooleanField(default=True)

    def validate_code(self, value: str) -> str:
        value = value.upper()
        if not CODE_RE.match(value):
            raise serializers.ValidationError("Use 1–6 capital letters or digits.")
        if value == "IFC":
            # F-08: "IFC" also means a BIM file format; spell the purpose out.
            raise serializers.ValidationError(
                "Do not use the bare code IFC. Use GFC or spell out 'Issued for Construction'."
            )
        return value


class RevisionSeriesSerializer(serializers.Serializer):
    prefix = serializers.RegexField(r"^[A-Z]{1,2}$")
    label = serializers.CharField(max_length=40)  # type: ignore[assignment]


class RevisionSchemeSerializer(serializers.Serializer):
    digits = serializers.IntegerField(min_value=1, max_value=4)
    series = RevisionSeriesSerializer(many=True, min_length=1)  # type: ignore[call-arg]


def _unique_codes(items: list[dict], key: str) -> list[dict]:
    codes = [item[key] for item in items]
    if len(codes) != len(set(codes)):
        raise serializers.ValidationError("Codes must be unique.")
    return items


class OrgSettingsSerializer(serializers.ModelSerializer):
    organisation = OrganisationSerializer(required=False)
    revision_scheme = RevisionSchemeSerializer(required=False)
    purpose_codes = CodeLabelSerializer(many=True, required=False)
    suitability_codes = CodeLabelSerializer(many=True, required=False)

    class Meta:
        model = OrgSettings
        fields = [
            "organisation",
            "revision_scheme",
            "purpose_codes",
            "suitability_codes",
            "digest_time",
            "transmittal_link_days",
            "project_code_format",
            "default_weekly_capacity_h",
            "acknowledge_within_days",
            "billing_csv_columns",
            "billing_webhook_url",
            "billing_webhook_secret",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "transmittal_link_days": {"min_value": 1, "max_value": 365},
            "default_weekly_capacity_h": {"min_value": 1, "max_value": 80},
            "acknowledge_within_days": {"min_value": 1, "max_value": 60},
            "billing_webhook_secret": {"write_only": True},
        }

    def validate_billing_csv_columns(self, value: list[dict]) -> list[dict]:
        from apps.core.models import BILLING_FIELDS

        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Choose at least one column.")
        for c in value:
            if not isinstance(c, dict) or c.get("field") not in BILLING_FIELDS:
                raise serializers.ValidationError(
                    f"Columns use these fields: {', '.join(BILLING_FIELDS)}."
                )
        return [
            {"field": c["field"], "header": str(c.get("header") or BILLING_FIELDS[c["field"]])[:60]}
            for c in value
        ]

    def validate_billing_webhook_url(self, value: str) -> str:
        from django.conf import settings

        if value and settings.ENVIRONMENT == "production" and not value.startswith("https://"):
            raise serializers.ValidationError("Use an https:// address.")
        if value:
            parts = urlsplit(value)
            try:
                net.public_address(parts.hostname or "", parts.port or 443)
            except net.UnsafeURL as exc:
                raise serializers.ValidationError(f"{exc}.") from exc
        return value

    def validate_purpose_codes(self, value: list[dict]) -> list[dict]:
        return _unique_codes(value, "code")

    def validate_suitability_codes(self, value: list[dict]) -> list[dict]:
        return _unique_codes(value, "code")

    def validate_revision_scheme(self, value: dict) -> dict:
        _unique_codes(value["series"], "prefix")
        return value


class DisciplineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discipline
        fields = ["id", "code", "name", "sheet_prefix_regex", "sort_order", "is_active"]

    def validate_code(self, value: str) -> str:
        value = value.upper()
        if not re.match(r"^[A-Z]{1,3}$", value):
            raise serializers.ValidationError("Use 1–3 capital letters, e.g. A or M.")
        return value


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name"]

"""Short-lived download links for stored files, shared by every API that lists attachments."""

from typing import Any

from rest_framework import serializers

from . import storage


class AttachmentLinkSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    mime = serializers.CharField()
    url = serializers.CharField()


class SheetRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    title = serializers.CharField()


def link(request: Any, f: Any) -> dict[str, Any] | None:
    if f is None:
        return None
    origin = request.build_absolute_uri("/").rstrip("/") if request else None
    return {
        "id": f.pk,
        "name": f.original_name,
        "mime": f.mime,
        "url": storage.presign_get(f.storage_key, f.original_name, origin=origin),
    }


def links(request: Any, files: Any) -> list[dict[str, Any]]:
    return [x for f in files if (x := link(request, f)) is not None]

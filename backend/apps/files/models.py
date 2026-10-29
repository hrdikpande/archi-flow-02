"""Stored files (F-41). An Upload is one attempt; a FileObject is verified, deduplicated content."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class FileObject(OrgScopedModel):
    """Immutable once created. Stored once per organisation by SHA-256 (02 §5)."""

    storage_key = models.CharField(max_length=300, unique=True)
    sha256 = models.CharField(max_length=64)
    size = models.BigIntegerField()
    mime = models.CharField(max_length=100)
    original_name = models.CharField(max_length=255)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    thumbnail_key = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "file_object"
        constraints = [
            models.UniqueConstraint(fields=["organisation", "sha256"], name="file_sha256_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.original_name} ({self.sha256[:12]})"


class UploadState(models.TextChoices):
    PENDING = "pending", "Waiting for upload"
    UPLOADED = "uploaded", "Uploaded, checking"
    READY = "ready", "Ready"
    REJECTED = "rejected", "Rejected"


class UploadKind(models.TextChoices):
    """What the file is for; each kind has its own checks (N-03)."""

    SHEET = "sheet", "Sheet PDF (one page)"
    DOCUMENT = "document", "Document PDF"
    IMAGE = "image", "Image (JPEG or PNG)"
    DATA = "data", "Coordination data (BCF zip or XML report)"  # DD-024


class Upload(OrgScopedModel):
    kind = models.CharField(max_length=10, choices=UploadKind.choices, default=UploadKind.SHEET)
    original_name = models.CharField(max_length=255)
    declared_size = models.BigIntegerField()
    content_type = models.CharField(max_length=100)
    staging_key = models.CharField(max_length=300, unique=True)
    state = models.CharField(
        max_length=10, choices=UploadState.choices, default=UploadState.PENDING
    )
    reason = models.CharField(max_length=300, blank=True)
    file = models.ForeignKey(
        FileObject, on_delete=models.PROTECT, null=True, blank=True, related_name="uploads"
    )
    is_duplicate = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        db_table = "upload"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.original_name} [{self.state}]"

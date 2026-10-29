"""Transmittals (M04: F-14, F-15) and the external links recipients use (02 §9)."""

import hashlib
import secrets
import uuid

from django.conf import settings
from django.contrib.postgres.search import SearchVectorField
from django.db import models

from apps.core.models import OrgScopedModel


class Transmittal(OrgScopedModel):
    """The numbered record of sending revisions to people. Never edited after it is sent;
    corrections are a new transmittal referencing the old one (03 §8)."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.PROTECT, related_name="transmittals"
    )
    seq = models.PositiveIntegerField()
    number = models.CharField(max_length=60)
    # F-44: maintained by a database trigger (apps/search migrations); GIN-indexed.
    search_vector = SearchVectorField(null=True, editable=False)
    purpose = models.CharField(max_length=6)
    suitability = models.CharField(max_length=6, blank=True)
    note = models.TextField(blank=True)
    sent_at = models.DateTimeField()
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    cover_file = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    supersedes = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="corrections"
    )
    override_reason = models.TextField(blank=True)

    class Meta:
        db_table = "transmittal"
        ordering = ["-seq"]
        constraints = [
            models.UniqueConstraint(fields=["project", "seq"], name="transmittal_seq_unique"),
            models.UniqueConstraint(fields=["project", "number"], name="transmittal_number_unique"),
        ]

    def __str__(self) -> str:
        return self.number


class TransmittalItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transmittal = models.ForeignKey(Transmittal, on_delete=models.CASCADE, related_name="items")
    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.PROTECT, related_name="transmittal_items"
    )

    class Meta:
        db_table = "transmittal_item"
        constraints = [
            models.UniqueConstraint(
                fields=["transmittal", "revision"], name="transmittal_item_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.transmittal} · {self.revision}"


class LinkKind(models.TextChoices):
    TRANSMITTAL = "transmittal", "Transmittal"
    NOTICE = "notice", "New-revision notice (A-03)"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ExternalLink(OrgScopedModel):
    """A tokenised, expiring download link for one contact (02 §9). Only the hash is stored."""

    kind = models.CharField(max_length=12, choices=LinkKind.choices)
    contact = models.ForeignKey("contacts.Contact", on_delete=models.PROTECT, related_name="+")
    transmittal = models.ForeignKey(Transmittal, on_delete=models.CASCADE, related_name="links")
    revisions = models.ManyToManyField("register.SheetRevision", blank=True, related_name="+")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "external_link"

    def __str__(self) -> str:
        return f"{self.get_kind_display()} for {self.contact}"

    @staticmethod
    def new_token() -> str:
        return secrets.token_urlsafe(32)


class Delivery(models.TextChoices):
    EMAIL = "email", "Email"
    HAND = "hand", "By hand"


class TransmittalRecipient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transmittal = models.ForeignKey(
        Transmittal, on_delete=models.CASCADE, related_name="recipients"
    )
    contact = models.ForeignKey("contacts.Contact", on_delete=models.PROTECT, related_name="+")
    delivery = models.CharField(max_length=8, choices=Delivery.choices, default=Delivery.EMAIL)
    link = models.OneToOneField(
        ExternalLink, on_delete=models.SET_NULL, null=True, blank=True, related_name="recipient"
    )
    delivered_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    bounce_reason = models.CharField(max_length=300, blank=True)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)  # F-15 (P2)

    class Meta:
        db_table = "transmittal_recipient"
        constraints = [
            models.UniqueConstraint(fields=["transmittal", "contact"], name="recipient_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.transmittal} → {self.contact}"


class DownloadLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    """Every external download, per recipient (02 §9). Insert-only by convention."""

    link = models.ForeignKey(ExternalLink, on_delete=models.CASCADE, related_name="downloads")
    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    what = models.CharField(max_length=20, default="revision")  # revision|zip|cover|acknowledge
    at = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "download_log"
        ordering = ["-at"]

    def __str__(self) -> str:
        return f"{self.link} {self.what} {self.at:%d-%b-%Y %H:%M}"


class SiteLink(OrgScopedModel):
    """F-51 site view (P2): a magic link for a site user to see the project's current issued
    set on a phone. Only the token hash is stored; revocable; expires."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="site_links"
    )
    contact = models.ForeignKey("contacts.Contact", on_delete=models.PROTECT, related_name="+")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        db_table = "site_link"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Site link for {self.contact} on {self.project}"


class SiteDownload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    link = models.ForeignKey(SiteLink, on_delete=models.CASCADE, related_name="downloads")
    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.PROTECT, related_name="+"
    )
    at = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "site_download"

    def __str__(self) -> str:
        return f"{self.link} {self.revision}"

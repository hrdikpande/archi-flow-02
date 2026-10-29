"""External organisations and contacts (F-43): transmittal recipients, clients, consultants."""

from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.db.models.functions import Lower

from apps.core.models import OrgScopedModel


class ExternalOrgKind(models.TextChoices):
    CLIENT = "client", "Client"
    CONSULTANT = "consultant", "Consultant"
    CONTRACTOR = "contractor", "Contractor"
    AUTHORITY = "authority", "Authority"
    OTHER = "other", "Other"


class ExternalOrg(OrgScopedModel):
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=ExternalOrgKind.choices)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "external_org"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"), "organisation", name="external_org_name_unique_ci"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Contact(OrgScopedModel):
    """A person. Email is optional: recipients of paper issues have none (03 §8)."""

    external_org = models.ForeignKey(
        ExternalOrg, on_delete=models.PROTECT, null=True, blank=True, related_name="contacts"
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    # F-44: maintained by a database trigger (apps/search migrations); GIN-indexed.
    search_vector = SearchVectorField(null=True, editable=False)

    class Meta:
        db_table = "contact"
        ordering = ["full_name"]
        indexes = [models.Index(Lower("email"), name="contact_email_ci")]

    def __str__(self) -> str:
        return f"{self.full_name} <{self.email}>" if self.email else self.full_name

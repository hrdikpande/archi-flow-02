"""M09 billing signal (P2, F-27/F-28): the moment a stage is billable, Accounts know.
No invoicing, GST or ledger here (F-29 is out of scope: it stays in the accounting tool)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class BillingSignal(OrgScopedModel):
    stage = models.OneToOneField("projects.Stage", on_delete=models.CASCADE, related_name="billing")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="+")
    fee_pct = models.DecimalField(max_digits=5, decimal_places=2)
    fee_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    ready_at = models.DateTimeField()
    invoiced_at = models.DateTimeField(null=True, blank=True)
    invoiced_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    invoice_ref = models.CharField(max_length=100, blank=True)
    exported_at = models.DateTimeField(null=True, blank=True)
    webhook_delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "billing_signal"
        ordering = ["ready_at"]

    def __str__(self) -> str:
        return f"{self.stage} ready {self.ready_at:%d-%b-%Y}"

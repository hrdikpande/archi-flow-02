"""F-58 project knowledge base (P3): a decision log; search runs across it and the other logs."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models

from apps.core.models import OrgScopedModel


class Decision(OrgScopedModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="decisions"
    )
    seq = models.PositiveIntegerField()
    number = models.CharField(max_length=60)
    title = models.CharField(max_length=300)
    text = models.TextField()
    decided_on = models.DateField()
    decided_by = models.CharField(max_length=200, blank=True)  # e.g. "Client meeting, Dr Rao"
    tags = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    sheets = models.ManyToManyField("register.Sheet", blank=True, related_name="decisions")
    discipline = models.ForeignKey(
        "core.Discipline", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    logged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        db_table = "decision"
        ordering = ["-decided_on", "-seq"]
        constraints = [models.UniqueConstraint(fields=["project", "seq"], name="decision_seq")]

    def __str__(self) -> str:
        return f"{self.number} {self.title}"

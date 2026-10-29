"""M08 client comments and approvals (P2): F-24 comment log, F-25 email capture, F-26 stage
approval with evidence (03 §12)."""

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel


class CommentSource(models.TextChoices):
    EMAIL = "email", "Email"
    MEETING = "meeting", "Meeting"
    CALL = "call", "Phone call"
    WHATSAPP = "whatsapp", "WhatsApp"
    LETTER = "letter", "Letter"
    OTHER = "other", "Other"


class CommentStatus(models.TextChoices):
    NEW = "new", "New"
    ASSIGNED = "assigned", "Assigned"
    RESPONDED = "responded", "Responded"
    CLOSED = "closed", "Closed"
    REJECTED = "rejected", "Rejected"


OPEN_STATUSES = (CommentStatus.NEW, CommentStatus.ASSIGNED)


class ClientComment(OrgScopedModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="client_comments"
    )
    seq = models.PositiveIntegerField()
    number = models.CharField(max_length=60)  # 2026-014-CC-0007
    source = models.CharField(max_length=10, choices=CommentSource.choices)
    received_on = models.DateField()
    from_contact = models.ForeignKey(
        "contacts.Contact", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    from_name = models.CharField(max_length=200, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    sheets = models.ManyToManyField("register.Sheet", blank=True, related_name="client_comments")
    stage = models.ForeignKey(
        "projects.Stage", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    revision = models.ForeignKey(
        "register.SheetRevision", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    status = models.CharField(
        max_length=10, choices=CommentStatus.choices, default=CommentStatus.NEW
    )
    response = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reject_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    attachments = models.ManyToManyField("files.FileObject", blank=True, related_name="+")
    logged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "client_comment"
        ordering = ["-received_on", "-seq"]
        constraints = [
            models.UniqueConstraint(fields=["project", "seq"], name="client_comment_seq"),
            models.CheckConstraint(
                condition=~models.Q(status="closed") | ~models.Q(response=""),
                name="closed_comment_has_response",
            ),
        ]

    def __str__(self) -> str:
        return self.number


class InboundState(models.TextChoices):
    PROCESSED = "processed", "Comment created"
    REVIEW = "review", "Unknown sender: needs review"
    DISCARDED = "discarded", "Discarded"
    UNROUTED = "unrouted", "No project for this address"


class InboundEmail(OrgScopedModel):
    """F-25 / I-09: an email sent or forwarded to a project address (p-<code>@…)."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    message_id = models.CharField(max_length=300)
    to_address = models.CharField(max_length=300)
    from_address = models.CharField(max_length=300)
    from_name = models.CharField(max_length=200, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    text = models.TextField(blank=True)
    received_at = models.DateTimeField()
    raw = models.ForeignKey(
        "files.FileObject", on_delete=models.PROTECT, null=True, related_name="+"
    )
    attachments = models.ManyToManyField("files.FileObject", blank=True, related_name="+")
    state = models.CharField(max_length=10, choices=InboundState.choices)
    comment = models.OneToOneField(
        ClientComment, on_delete=models.SET_NULL, null=True, blank=True, related_name="email"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "inbound_email"
        ordering = ["-received_at"]
        constraints = [
            # Re-delivery of the same message (webhook retry, IMAP re-poll) is a no-op.
            models.UniqueConstraint(
                fields=["organisation", "message_id"], name="inbound_email_once"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.from_address}: {self.subject}"


class ClientApproval(OrgScopedModel):
    """F-26: who approved the stage on the client side, when, and the evidence."""

    stage = models.ForeignKey("projects.Stage", on_delete=models.CASCADE, related_name="approvals")
    approved_by = models.CharField(max_length=200)
    approved_contact = models.ForeignKey(
        "contacts.Contact", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    approved_on = models.DateField()
    evidence = models.ForeignKey("files.FileObject", on_delete=models.PROTECT, related_name="+")
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        db_table = "client_approval"
        ordering = ["-approved_on"]

    def __str__(self) -> str:
        return f"{self.stage} approved by {self.approved_by}"

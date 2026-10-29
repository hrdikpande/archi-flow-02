"""F-25 / I-09: email sent or forwarded to a project address (p-<code>@INBOUND_EMAIL_DOMAIN)
becomes a `new` client comment with its attachments. Mail from people the firm does not know
waits in a review queue. Delivery is by webhook (the mail provider forwards raw MIME) or by
the IMAP poller; both call `ingest`, which is idempotent per Message-ID."""

import hashlib
import imaplib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from email import message_from_bytes, policy
from email.message import EmailMessage
from email.utils import getaddresses, parsedate_to_datetime
from html import unescape
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.contacts.models import Contact
from apps.files import storage
from apps.files.models import FileObject
from apps.projects.models import Project

from . import services
from .models import CommentSource, InboundEmail, InboundState

logger = logging.getLogger(__name__)
ATTACHMENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_ATTACHMENT = 50 * 1024 * 1024


@dataclass
class Parsed:
    message_id: str
    to: list[str]
    from_address: str
    from_name: str
    subject: str
    text: str
    received_at: datetime
    attachments: list[tuple[str, str, bytes]] = field(default_factory=list)


def _text_of(msg: EmailMessage) -> str:
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    content = part.get_content()
    if part.get_content_type() == "text/html":
        content = unescape(
            re.sub(r"<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", "", content))
        )
        content = re.sub(r"[ \t]+", " ", content)
    return content.strip()


def parse(raw: bytes) -> Parsed:
    msg: EmailMessage = message_from_bytes(raw, policy=policy.default)
    to = [
        a.lower()
        for _, a in getaddresses(
            msg.get_all("to", []) + msg.get_all("cc", []) + msg.get_all("delivered-to", [])
        )
        if a
    ]
    from_name, from_address = (getaddresses(msg.get_all("from", [])) or [("", "")])[0]
    try:
        received = parsedate_to_datetime(msg["date"]) if msg["date"] else timezone.now()
    except (TypeError, ValueError):
        received = timezone.now()
    attachments = []
    for part in msg.iter_attachments():
        ctype = part.get_content_type()
        payload = part.get_payload(decode=True)
        if not isinstance(payload, bytes):
            continue
        if ctype in ATTACHMENT_TYPES and 0 < len(payload) <= MAX_ATTACHMENT:
            attachments.append((part.get_filename() or "attachment", ctype, payload))
    message_id = (msg["message-id"] or "").strip() or f"<sha256-{hashlib.sha256(raw).hexdigest()}>"
    return Parsed(
        message_id[:300],
        to,
        from_address.lower(),
        from_name,
        str(msg["subject"] or "")[:300],
        _text_of(msg),
        received,
        attachments,
    )


def project_address(project: Project) -> str:
    return f"p-{project.code.lower()}@{settings.INBOUND_EMAIL_DOMAIN}"


def route(addresses: list[str]) -> Project | None:
    domain = settings.INBOUND_EMAIL_DOMAIN.lower()
    for a in addresses:
        local, _, d = a.partition("@")
        if d == domain and local.startswith("p-"):
            project = Project.objects.filter(code__iexact=local[2:]).first()
            if project is not None:
                return project
    return None


def _store(org_id: Any, name: str, mime: str, data: bytes) -> FileObject:
    sha = hashlib.sha256(data).hexdigest()
    existing = FileObject.objects.filter(organisation_id=org_id, sha256=sha).first()
    if existing:
        return existing
    ext = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "message/rfc822": "eml",
    }[mime]
    key = f"inbound/{org_id}/{sha}.{ext}"
    storage.put_bytes(key, data, mime)
    return FileObject.objects.create(
        organisation_id=org_id,
        storage_key=key,
        sha256=sha,
        size=len(data),
        mime=mime,
        original_name=name[:255],
    )


def _original_sender(text: str) -> str:
    """For forwarded mail, the first 'From:' line of the forwarded part."""
    m = re.search(r"^\s*From:\s*(.+)$", text, re.MULTILINE)
    return m.group(1).strip()[:200] if m else ""


def known_sender(project: Project, address: str) -> tuple[bool, Contact | None, User | None]:
    user = User.objects.filter(
        organisation_id=project.organisation_id, email__iexact=address, is_active=True
    ).first()
    contact = Contact.objects.filter(
        organisation_id=project.organisation_id, email__iexact=address, is_active=True
    ).first()
    return (user is not None or contact is not None), contact, user


@transaction.atomic
def ingest(raw: bytes) -> InboundEmail | None:
    p = parse(raw)
    project = route(p.to)
    if project is None:
        logger.warning("inbound email for no project", extra={"to": p.to[:5]})
        return None
    org_id = project.organisation_id
    if InboundEmail.objects.filter(organisation_id=org_id, message_id=p.message_id).exists():
        return None  # already received (webhook retry or IMAP re-poll)
    raw_file = _store(org_id, f"{p.subject or 'email'}.eml", "message/rfc822", raw)
    files = [_store(org_id, n, m, d) for n, m, d in p.attachments]
    known, contact, user = known_sender(project, p.from_address)
    try:
        with transaction.atomic():
            email = InboundEmail.objects.create(
                organisation_id=org_id,
                project=project,
                message_id=p.message_id,
                to_address=project_address(project),
                from_address=p.from_address,
                from_name=p.from_name,
                subject=p.subject,
                text=p.text,
                received_at=p.received_at,
                raw=raw_file,
                state=InboundState.PROCESSED if known else InboundState.REVIEW,
            )
    except IntegrityError:
        return None
    email.attachments.set(files)
    if known:
        email.comment = comment_from(email, contact=contact, forwarded_by=user)
        email.save(update_fields=["comment", "updated_at"])
    return email


def comment_from(
    email: InboundEmail, *, contact: Contact | None = None, forwarded_by: User | None = None
) -> Any:
    if email.project is None:
        raise ValueError("an unrouted email cannot become a comment")
    who = _original_sender(email.text) if forwarded_by else ""
    from_name = who or email.from_name or email.from_address
    if forwarded_by:
        from_name = f"{from_name} (forwarded by {forwarded_by.short_name})"
    return services.log_comment(
        None,
        email.project,
        source=CommentSource.EMAIL,
        received_on=timezone.localtime(email.received_at).date(),
        body=email.text or email.subject or "(no text)",
        subject=email.subject,
        from_name=from_name,
        from_contact=contact,
        attachments=list(email.attachments.all()),
    )


@transaction.atomic
def review(actor: User, email: InboundEmail, accept: bool) -> InboundEmail:
    """Unknown-sender queue: a PL/DL/DC accepts (creates the comment) or discards it."""
    from apps.accounts.permissions import Action, require
    from apps.core.exceptions import ConflictError

    email = InboundEmail.objects.select_for_update().get(pk=email.pk)
    require(actor, Action.LOG_CLIENT_COMMENTS, project=email.project)
    if email.state != InboundState.REVIEW:
        raise ConflictError("already_reviewed", "This email has already been handled.")
    email.reviewed_by = actor
    if accept:
        email.comment = comment_from(email)
        email.state = InboundState.PROCESSED
    else:
        email.state = InboundState.DISCARDED
    email.save()
    return email


def poll_imap() -> int:
    """Fetch unseen messages from the inbound mailbox (INBOUND_IMAP_*). No-op if unset."""
    host = settings.INBOUND_IMAP_HOST
    if not host:
        return 0
    count = 0
    with imaplib.IMAP4_SSL(host, settings.INBOUND_IMAP_PORT) as imap:
        imap.login(settings.INBOUND_IMAP_USER, settings.INBOUND_IMAP_PASSWORD)
        imap.select(settings.INBOUND_IMAP_FOLDER)
        _, data = imap.search(None, "UNSEEN")
        for num in (data[0] or b"").split():
            _, msg = imap.fetch(num.decode(), "(RFC822)")
            raw = msg[0][1] if msg and isinstance(msg[0], tuple) else None
            if raw:
                try:
                    if ingest(raw):
                        count += 1
                except Exception:
                    logger.exception("inbound email failed")
                    continue
            imap.store(num.decode(), "+FLAGS", "\\Seen")
    return count

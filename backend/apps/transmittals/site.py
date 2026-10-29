"""F-51 site view (S-18): read-only, phone-first list of the project's current issued set,
reached by a magic link (no login). Superseded revisions are never shown."""

import secrets
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.db.models import Q, QuerySet
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record
from apps.contacts.models import Contact
from apps.core.context import get_context
from apps.core.exceptions import DomainError
from apps.files import storage
from apps.notifications.email import send_templated_email
from apps.projects.models import Project
from apps.register.models import RevisionState, SheetRevision

from .models import SiteDownload, SiteLink, hash_token
from .public import _limited, _secure
from .services import display_date, link_days, purpose_label


def current_set(project: Project, q: str = "") -> QuerySet[SheetRevision]:
    """One issued revision per sheet (partial unique index), never superseded ones."""
    qs = SheetRevision.objects.filter(
        sheet__project=project, state=RevisionState.ISSUED, file__isnull=False
    ).select_related("sheet__discipline", "file")
    if q := q.strip():
        qs = qs.filter(Q(sheet__number__icontains=q) | Q(sheet__title__icontains=q))
    return qs.order_by("sheet__discipline__code", "sheet__number")


@transaction.atomic
def create_link(
    actor: User, project: Project, contact: Contact, frontend_url: str
) -> tuple[SiteLink, str]:
    require(actor, Action.ISSUE_SHEETS, project=project)
    if contact.organisation_id != project.organisation_id:
        raise DomainError("invalid_contact", "Unknown contact.")
    if not contact.email:
        raise DomainError("no_email", f"{contact.full_name} has no email address for the link.")
    token = secrets.token_urlsafe(32)
    link = SiteLink.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        contact=contact,
        token_hash=hash_token(token),
        created_by=actor,
        expires_at=timezone.now() + timedelta(days=link_days(project.organisation_id)),
    )
    record(
        organisation_id=project.organisation_id,
        actor=actor,
        verb="site_link.created",
        entity_type="transmittals.sitelink",
        entity_id=link.pk,
        entity_label=str(link),
        project_id=project.pk,
    )
    url = f"{frontend_url.rstrip('/')}/site/{token}/"
    org = project.organisation
    ctx = {
        "name": contact.full_name,
        "firm": org.name,
        "project": f"{project.code} {project.name}",
        "url": url,
        "expires": display_date(link.expires_at, org.timezone),
        "sender": actor.full_name or actor.email,
    }
    send_templated_email([contact.email], "site_link", ctx)
    return link, token


def revoke(actor: User, link: SiteLink) -> SiteLink:
    require(actor, Action.ISSUE_SHEETS, project=link.project)
    link.revoked_at = timezone.now()
    link.save(update_fields=["revoked_at", "updated_at"])
    record(
        organisation_id=link.organisation_id,
        actor=actor,
        verb="site_link.revoked",
        entity_type="transmittals.sitelink",
        entity_id=link.pk,
        entity_label=str(link),
        project_id=link.project_id,
    )
    return link


def _resolve(request: HttpRequest, token: str) -> SiteLink | HttpResponse:
    if _limited(request):
        return _secure(HttpResponse("Too many requests. Try again in a minute.", status=429))  # type: ignore[return-value]
    link = (
        SiteLink.objects.select_related("project__organisation", "contact", "created_by")
        .filter(token_hash=hash_token(token), revoked_at__isnull=True)
        .first()
    )
    if link is None:
        return _secure(render(request, "transmittals/public_invalid.html", status=404))  # type: ignore[return-value]
    if link.expires_at <= timezone.now():
        sender = link.created_by
        return _secure(
            render(
                request,
                "transmittals/public_expired.html",
                {  # type: ignore[return-value]
                    "firm": link.project.organisation.name,
                    "sender": sender.full_name or sender.email,
                    "sender_email": sender.email,
                },
                status=410,
            )
        )
    SiteLink.objects.filter(pk=link.pk).update(last_used_at=timezone.now())
    return link


@require_GET
def site_page(request: HttpRequest, token: str) -> Any:
    link = _resolve(request, token)
    if not isinstance(link, SiteLink):
        return link
    project, org = link.project, link.project.organisation
    q = request.GET.get("q", "")[:60]
    rows = [
        {"revision": r, "purpose": purpose_label(org.pk, r.purpose)}
        for r in current_set(project, q)
    ]
    return _secure(
        render(
            request,
            "transmittals/site.html",
            {
                "firm": org.name,
                "project": project,
                "rows": rows,
                "q": q,
                "contact": link.contact,
                "expires": display_date(link.expires_at, org.timezone),
            },
        )
    )


@require_GET
def site_download(request: HttpRequest, token: str, revision_id: str) -> Any:
    link = _resolve(request, token)
    if not isinstance(link, SiteLink):
        return link
    revision = current_set(link.project).filter(pk=revision_id).first()
    if revision is None or revision.file is None:
        raise Http404  # superseded or another project's revision: not available here
    SiteDownload.objects.create(link=link, revision=revision, ip=get_context().ip)
    url = storage.presign_get(
        revision.file.storage_key,
        f"{revision.sheet.number} {revision.code}.pdf",
        expires_in=120,
        origin=request.build_absolute_uri("/").rstrip("/"),
    )
    return _secure(HttpResponseRedirect(url))

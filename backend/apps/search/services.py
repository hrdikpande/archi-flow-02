"""F-44 global search: sheets (number, title, alias), projects, transmittals, contacts.

Prefix full-text on the trigger-maintained `search_vector` plus a trigram-indexed ILIKE on
numbers and codes, so "A-101", "101" and "OT duct" all match. Every query goes through
`visible_projects`, so results respect project access (F-38).
"""

import re
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import Case, F, IntegerField, Q, Value, When

from apps.accounts.models import User
from apps.contacts.models import Contact
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet
from apps.transmittals.models import Transmittal

TOKEN = re.compile(r"[\w]+(?:-[\w]+)*", re.UNICODE)
MAX_TERMS = 6


def ts_query(q: str) -> SearchQuery | None:
    """'OT duct' → 'ot':* & 'duct':* (every word, as a prefix)."""
    terms = [t.lower() for t in TOKEN.findall(q)][:MAX_TERMS]
    if not terms:
        return None
    raw = " & ".join(f"'{t}':*" for t in terms)
    return SearchQuery(raw, search_type="raw", config="simple")


def search(user: User, q: str, limit: int = 8) -> dict[str, list[Any]]:
    q = q.strip()[:100]
    empty: dict[str, list[Any]] = {"sheets": [], "projects": [], "transmittals": [], "contacts": []}
    query = ts_query(q)
    if query is None or len(q) < 2:
        return empty
    projects = visible_projects(user)

    sheets = (
        Sheet.objects.filter(project__in=projects)
        .filter(Q(search_vector=query) | Q(number__icontains=q))
        .annotate(
            exact=Case(
                When(number__iexact=q, then=Value(2)),
                When(number__istartswith=q, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            rank=SearchRank(F("search_vector"), query),
        )
        .select_related("project", "discipline", "current_revision")
        .order_by("-exact", "-rank", "project__code", "number")[:limit]
    )
    project_hits = (
        projects.filter(Q(search_vector=query) | Q(code__icontains=q))
        .annotate(rank=SearchRank(F("search_vector"), query))
        .order_by("-rank", "code")[:limit]
    )
    transmittals = (
        Transmittal.objects.filter(project__in=projects)
        .filter(Q(search_vector=query) | Q(number__icontains=q))
        .select_related("project")
        .order_by("-sent_at")[:limit]
    )
    contacts = (
        Contact.objects.filter(organisation_id=user.org_pk, is_active=True)
        .filter(Q(search_vector=query) | Q(email__icontains=q))
        .select_related("external_org")
        .annotate(rank=SearchRank(F("search_vector"), query))
        .order_by("-rank", "full_name")[:limit]
    )
    return {
        "sheets": list(sheets),
        "projects": list(project_hits),
        "transmittals": list(transmittals),
        "contacts": list(contacts),
    }

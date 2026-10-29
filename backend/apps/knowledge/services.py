"""F-58: decision log, and knowledge search across decisions, client comments, RFIs, review
comments, site observations, change orders and clash issues of every project the user can see.
'OT ceiling HEPA' finds 'OT ceilings need HEPA filters' (English stemming, every word, prefixes)."""

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import transaction
from django.db.models import F, Q, QuerySet

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record_change, snapshot
from apps.ca.common import lock_project, next_number
from apps.core.exceptions import DomainError
from apps.projects.models import Project
from apps.projects.selectors import visible_projects
from apps.register.models import Sheet

from .models import Decision

TOKEN = re.compile(r"[\w]+", re.UNICODE)


@transaction.atomic
def log_decision(
    actor: User,
    project: Project,
    *,
    title: str,
    text: str,
    decided_on: date,
    decided_by: str = "",
    tags: list[str] | None = None,
    sheets: list[Sheet] | None = None,
    discipline: Any = None,
) -> Decision:
    require(actor, Action.LOG_DECISIONS, project=project)
    if not title.strip() or not text.strip():
        raise DomainError("required", "Give the decision a title and say what was decided.")
    sheets = sheets or []
    if any(s.project_id != project.pk for s in sheets):
        raise DomainError("invalid_sheet", "A linked sheet belongs to another project.")
    project = lock_project(project)
    seq, number = next_number(project, Decision, "DEC")
    d = Decision.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        seq=seq,
        number=number,
        title=title.strip(),
        text=text,
        decided_on=decided_on,
        decided_by=decided_by,
        tags=[t.strip()[:40] for t in (tags or []) if t.strip()][:12],
        discipline=discipline,
        logged_by=actor,
    )
    d.sheets.set(sheets)
    record_change(
        d,
        actor=actor,
        verb="decision.logged",
        before=None,
        after=snapshot(d, ("title", "decided_on", "decided_by")),
    )
    return d


def query(q: str) -> SearchQuery | None:
    terms = [t.lower() for t in TOKEN.findall(q)][:8]
    if not terms:
        return None
    return SearchQuery(" & ".join(f"{t}:*" for t in terms), search_type="raw", config="english")


@dataclass
class Source:
    kind: str
    label: str
    model: Any
    fields: tuple[str, ...]
    title: str
    text: str
    project_path: str
    link: str
    sheets_path: str | None
    discipline_q: str | None


def _sources() -> list[Source]:
    from apps.ca.models import ChangeOrder, Rfi, SiteObservation
    from apps.comments.models import ClientComment
    from apps.coordination.models import ClashIssue
    from apps.workflow.models import Review

    return [
        Source(
            "decision",
            "Decision",
            Decision,
            ("title", "text", "decided_by"),
            "title",
            "text",
            "project",
            "/projects/{p}/decisions?open={id}",
            "sheets",
            "discipline",
        ),
        Source(
            "comment",
            "Client comment",
            ClientComment,
            ("subject", "body", "response"),
            "subject",
            "body",
            "project",
            "/projects/{p}/comments?open={id}",
            "sheets",
            "sheets__discipline",
        ),
        Source(
            "rfi",
            "RFI",
            Rfi,
            ("subject", "question", "response"),
            "subject",
            "question",
            "project",
            "/projects/{p}/construction/rfis?open={id}",
            "sheets",
            "sheets__discipline",
        ),
        Source(
            "review",
            "Review comment",
            Review,
            ("comment",),
            "sheet__number",
            "comment",
            "sheet__project",
            "/projects/{p}/sheets/{sheet}",
            None,
            "sheet__discipline",
        ),
        Source(
            "observation",
            "Site observation",
            SiteObservation,
            ("text", "action"),
            "report__number",
            "text",
            "report__project",
            "/projects/{p}/construction/site?open={report}",
            None,
            "sheet__discipline",
        ),
        Source(
            "change_order",
            "Change order",
            ChangeOrder,
            ("title", "description", "decision_note"),
            "title",
            "description",
            "project",
            "/projects/{p}/construction/changes?open={id}",
            "sheets",
            "sheets__discipline",
        ),
        Source(
            "clash",
            "Clash issue",
            ClashIssue,
            ("title", "description"),
            "title",
            "description",
            "project",
            "/projects/{p}/construction/clashes?open={id}",
            "sheets",
            "discipline",
        ),
    ]


def search(
    user: User,
    q: str,
    *,
    project: Any = None,
    discipline: Any = None,
    kinds: list[str] | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    sq = query(q)
    if sq is None or len(q.strip()) < 2:
        return []
    projects: QuerySet[Project] = visible_projects(user)
    if project:
        projects = projects.filter(pk=project)
    results: list[dict[str, Any]] = []
    for src in _sources():
        if kinds and src.kind not in kinds:
            continue
        qs = src.model.objects.filter(**{f"{src.project_path}__in": projects})
        if discipline and src.discipline_q:
            qs = qs.filter(Q(**{f"{src.discipline_q}": discipline})).distinct()
        vector = SearchVector(*src.fields, config="english")
        qs = (
            qs.annotate(_v=vector, _rank=SearchRank(vector, sq))
            .filter(_v=sq)
            .annotate(
                _title=F(src.title),
                _text=F(src.text),
                _project=F(src.project_path),
                _code=F(f"{src.project_path}__code"),
            )
            .order_by("-_rank")[:20]
        )
        for obj in qs:
            sheets: list[dict[str, Any]] = []
            if src.sheets_path:
                sheets = [
                    {"id": s.pk, "number": s.number}
                    for s in getattr(obj, src.sheets_path).all()[:10]
                ]
            elif getattr(obj, "sheet_id", None):
                sheets = [{"id": obj.sheet_id, "number": obj.sheet.number}]
            link = src.link.format(
                p=obj._project,
                id=obj.pk,
                sheet=getattr(obj, "sheet_id", ""),
                report=getattr(obj, "report_id", ""),
            )
            results.append(
                {
                    "kind": src.kind,
                    "kind_label": src.label,
                    "id": str(obj.pk),
                    "project": obj._project,
                    "project_code": obj._code,
                    "title": str(obj._title or src.label)[:300],
                    "snippet": _snippet(str(obj._text or ""), q),
                    "sheets": sheets,
                    "link": link,
                    "rank": float(obj._rank),
                }
            )
    results.sort(key=lambda r: -r["rank"])
    return results[:limit]


def _snippet(text: str, q: str, width: int = 220) -> str:
    text = " ".join(text.split())
    first = TOKEN.findall(q.lower())
    pos = min((i for t in first if (i := text.lower().find(t[:4])) >= 0), default=0)
    start = max(0, pos - 60)
    out = text[start : start + width]
    return ("…" if start else "") + out + ("…" if start + width < len(text) else "")

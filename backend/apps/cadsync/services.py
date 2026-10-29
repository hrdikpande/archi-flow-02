"""CAD sync proposals (F-09) and storage-connector file activity (I-02)."""

import re
from datetime import datetime
from pathlib import PurePosixPath, PureWindowsPath
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import Discipline
from apps.projects.models import Project, Stage
from apps.register import services as register
from apps.register.models import Sheet
from apps.register.naming import contains_sheet_number

from .models import CadFileEvent, ProposalKind, ProposalState, SyncBatch, SyncProposal

MAX_SHEETS = 5000


def _project(actor: User, code: str) -> Project:
    project = Project.objects.filter(
        organisation_id=actor.org_pk, code__iexact=code.strip()
    ).first()
    if project is None:
        raise DomainError("unknown_project", f"No project with code {code}.", status_code=404)
    require(actor, Action.VIEW_PROJECT, project=project)
    return project


def guess_discipline(org_id: Any, number: str) -> Discipline | None:
    for d in Discipline.objects.filter(organisation_id=org_id).order_by("sort_order"):
        if d.sheet_prefix_regex and re.search(d.sheet_prefix_regex, number):
            return d
    return None


@transaction.atomic
def receive_sync(
    actor: User,
    *,
    project_code: str,
    source: str,
    sheets: list[dict[str, str]],
    model_path: str = "",
    app_version: str = "",
    plugin_version: str = "",
) -> SyncBatch:
    """Compare the model's sheet list with the register; propose, never create."""
    project = _project(actor, project_code)
    if len(sheets) > MAX_SHEETS:
        raise DomainError("too_many", f"Send at most {MAX_SHEETS} sheets per sync.")
    batch = SyncBatch.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        source=source,
        model_path=model_path[:500],
        app_version=app_version[:60],
        plugin_version=plugin_version[:30],
        sent_by=actor,
    )
    register_sheets = {
        s.number: s
        for s in Sheet.objects.filter(project=project).select_related("current_revision")
    }
    counts = {"matched": 0, "new": 0, "title": 0, "revision": 0}
    seen: set[str] = set()
    for row in sheets:
        number = (row.get("number") or "").strip()
        title = (row.get("title") or "").strip()[:300]
        revision = (row.get("revision") or "").strip().upper()[:20]
        if not number or number in seen:
            continue
        seen.add(number)
        kinds: list[str] = []
        existing = register_sheets.get(number)
        if existing is None:
            kinds.append(ProposalKind.NEW)
        else:
            if title and title.casefold() != existing.title.casefold():
                kinds.append(ProposalKind.TITLE)
            current = existing.current_revision.code if existing.current_revision else ""
            if revision and current and revision != current:
                kinds.append(ProposalKind.REVISION)
        if not kinds:
            counts["matched"] += 1
            continue
        # A newer sync replaces open proposals for the same sheet number.
        SyncProposal.objects.filter(
            project=project, number=number, state=ProposalState.OPEN
        ).update(state=ProposalState.SUPERSEDED)
        for kind in kinds:
            counts[kind] += 1
            SyncProposal.objects.create(
                organisation_id=project.organisation_id,
                batch=batch,
                project=project,
                kind=kind,
                number=number,
                cad_title=title,
                cad_revision=revision,
                sheet=existing,
                register_title=existing.title if existing else "",
                register_revision=(
                    existing.current_revision.code if existing and existing.current_revision else ""
                ),
                discipline=guess_discipline(project.organisation_id, number)
                if existing is None
                else existing.discipline,
            )
    batch.counts = counts
    batch.save(update_fields=["counts", "updated_at"])
    record(
        organisation_id=project.organisation_id,
        actor=actor,
        verb="cad_sync.received",
        entity_type="cadsync.syncbatch",
        entity_id=batch.pk,
        entity_label=f"{source}: {counts}",
        after=counts,
        project_id=project.pk,
    )
    return batch


@transaction.atomic
def decide(
    actor: User,
    proposal: SyncProposal,
    accept: bool,
    *,
    stage: Stage | None = None,
    discipline: Discipline | None = None,
) -> SyncProposal:
    proposal = (
        SyncProposal.objects.select_for_update(of=("self",))
        .select_related("project", "sheet")
        .get(pk=proposal.pk)
    )
    require(actor, Action.EDIT_SHEETS, project=proposal.project)
    if proposal.state != ProposalState.OPEN:
        raise ConflictError("decided", "This proposal has already been handled.")
    if accept:
        if proposal.kind == ProposalKind.NEW:
            discipline = discipline or proposal.discipline
            if discipline is None or stage is None:
                raise DomainError(
                    "needs_details", "Choose the discipline and stage for the new sheet."
                )
            if stage.project_id != proposal.project_id:
                raise DomainError("invalid_stage", "That stage belongs to another project.")
            proposal.sheet = register.create_sheet(
                actor,
                proposal.project,
                number=proposal.number,
                title=proposal.cad_title or proposal.number,
                discipline=discipline,
                stage=stage,
            )
        elif proposal.kind == ProposalKind.TITLE and proposal.sheet is not None:
            register.update_sheet(actor, proposal.sheet, title=proposal.cad_title)
        # REVISION is advisory: a revision comes from uploading its PDF (F-06), not the model.
    proposal.state = ProposalState.ACCEPTED if accept else ProposalState.REJECTED
    proposal.decided_by, proposal.decided_at = actor, timezone.now()
    proposal.save()
    return proposal


def _norm(path: str) -> str:
    return str(PureWindowsPath(path)).lower() if "\\" in path else str(PurePosixPath(path)).lower()


@transaction.atomic
def receive_file_events(
    actor: User, *, project_code: str, events: list[dict[str, Any]], connector: str = ""
) -> dict[str, int]:
    """I-02: match each file to a sheet by its CAD link, else by the sheet number in the name."""
    project = _project(actor, project_code)
    sheets = list(Sheet.objects.filter(project=project).only("id", "number", "cad_link"))
    by_link = {_norm(s.cad_link): s for s in sheets if s.cad_link}
    matched = unmatched = 0
    rows = []
    for e in events[:2000]:
        path = str(e.get("path") or "")[:500]
        if not path:
            continue
        name = PureWindowsPath(path).name if "\\" in path else PurePosixPath(path).name
        sheet = by_link.get(_norm(path)) or next(
            (s for s in sheets if contains_sheet_number(name, s.number)), None
        )
        at = e.get("at")
        try:
            when = datetime.fromisoformat(at) if isinstance(at, str) else timezone.now()
        except ValueError:
            when = timezone.now()
        if timezone.is_naive(when):
            when = timezone.make_aware(when)
        raw_kind = str(e.get("event") or "")
        kind = raw_kind if raw_kind in ("created", "modified", "deleted", "renamed") else "modified"
        rows.append(
            CadFileEvent(
                organisation_id=project.organisation_id,
                project=project,
                sheet=sheet,
                path=path,
                event=kind,
                at=when,
                by=str(e.get("by") or "")[:200],
                connector=connector[:60],
            )
        )
        matched += sheet is not None
        unmatched += sheet is None
    CadFileEvent.objects.bulk_create(rows)
    return {"matched": matched, "unmatched": unmatched}

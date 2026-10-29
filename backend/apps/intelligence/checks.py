"""F-57 drawing checks (P4, exploratory): rule checks on issued PDFs first (02 §17). No model,
no outside service: the PDF never leaves the firm's storage. Findings are advisory, never block
an issue, and each is accepted or rejected by a reviewer. Rollout needs ≥ 200 labelled sheets."""

import re
from typing import Any

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record
from apps.core.exceptions import ConflictError, DomainError
from apps.core.models import Discipline, OrgSettings
from apps.files import storage
from apps.register.models import Sheet, SheetRevision
from apps.register.titleblock import read_pdf

from .models import Finding, FindingStatus

ROLLOUT_LABELLED_SHEETS = 200
MONTH = r"(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*"
DATE = re.compile(rf"\b(\d{{1,2}}[-/. ]{MONTH}[-/. ]\d{{2,4}}|\d{{4}}-\d{{2}}-\d{{2}})\b", re.I)
SCALE = re.compile(r"\b(scale|nts|n\.t\.s\.|1\s*:\s*\d{1,4})\b", re.I)
WORDS = re.compile(r"[a-z0-9]+")


def _words(text: str) -> set[str]:
    return {w for w in WORDS.findall(text.lower()) if len(w) > 2}


def run_checks(revision: SheetRevision) -> list[tuple[str, str]]:
    """(rule, message) problems on one issued revision."""
    if revision.file is None:
        return []
    sheet = revision.sheet
    reading = read_pdf(storage.get_bytes(revision.file.storage_key))
    if reading.method == "none":
        return [
            (
                "TB-UNREADABLE",
                "The PDF has no readable text, so its title block could not be checked.",
            )
        ]
    text, corner = reading.text, reading.corner or reading.text
    problems = []
    if not re.search(rf"(?<![A-Za-z0-9]){re.escape(sheet.number)}(?![A-Za-z0-9])", text, re.I):
        problems.append(
            ("TB-NUMBER", f"The title block does not show the sheet number {sheet.number}.")
        )
    if not re.search(rf"\b{re.escape(revision.code)}\b", text, re.I):
        problems.append(("TB-REVISION", f"The title block does not show revision {revision.code}."))
    want = _words(sheet.title)
    if want and len(want & _words(text)) < max(1, len(want) // 2):
        problems.append(
            ("TB-TITLE", f"The drawing title does not match the register title “{sheet.title}”.")
        )
    if not DATE.search(corner):
        problems.append(("TB-DATE", "No date found in the title block."))
    if not SCALE.search(text):
        problems.append(("TB-SCALE", "No scale (e.g. 1:100 or NTS) found on the drawing."))
    problems.extend(_references(sheet, text))
    return problems


def _references(sheet: Sheet, text: str) -> list[tuple[str, str]]:
    """Sheet numbers mentioned on the drawing that are not in the register or never issued."""
    patterns = [
        d.sheet_prefix_regex.strip("^$")
        for d in Discipline.objects.filter(organisation_id=sheet.organisation_id).exclude(
            sheet_prefix_regex=""
        )
    ]
    if not patterns:
        return []
    found: set[str] = set()
    for pat in patterns:
        try:
            for m in re.finditer(rf"(?<![A-Za-z0-9])(?:{pat})(?![A-Za-z0-9])", text):
                found.add(m.group(0))
        except re.error:
            continue
    found.discard(sheet.number)
    if not found:
        return []
    register = {
        s.number: s for s in Sheet.objects.filter(project_id=sheet.project_id, number__in=found)
    }
    issued = set(
        SheetRevision.objects.filter(
            sheet__in=register.values(), issued_at__isnull=False
        ).values_list("sheet__number", flat=True)
    )
    out = []
    for number in sorted(found):
        if number not in register:
            out.append(
                ("REF-MISSING", f"Refers to {number}, which is not in this project's register.")
            )
        elif number not in issued:
            out.append(("REF-UNISSUED", f"Refers to {number}, which has not been issued yet."))
    return out


def check_revision(revision_id: Any) -> int:
    revision = SheetRevision.objects.select_related("sheet", "file").filter(pk=revision_id).first()
    if revision is None:
        return 0
    mode = OrgSettings.objects.get(organisation_id=revision.organisation_id).drawing_checks
    if mode == "off":
        return 0
    created = 0
    for rule, message in run_checks(revision):
        _, new = Finding.objects.get_or_create(
            revision=revision,
            rule=rule,
            message=message[:500],
            defaults={
                "organisation_id": revision.organisation_id,
                "sheet": revision.sheet,
                "project_id": revision.sheet.project_id,
            },
        )
        created += new
    return created


@transaction.atomic
def review_finding(actor: User, finding: Finding, accept: bool, note: str = "") -> Finding:
    finding = (
        Finding.objects.select_for_update(of=("self",)).select_related("project").get(pk=finding.pk)
    )
    require(actor, Action.REVIEW_FINDINGS, project=finding.project)
    finding.status = FindingStatus.ACCEPTED if accept else FindingStatus.REJECTED
    finding.reviewed_by, finding.reviewed_at, finding.note = actor, timezone.now(), note[:500]
    finding.save()
    record(
        organisation_id=finding.organisation_id,
        actor=actor,
        verb="finding.reviewed",
        entity_type="intelligence.finding",
        entity_id=finding.pk,
        entity_label=finding.message[:300],
        after={"status": finding.status, "rule": finding.rule},
        project_id=finding.project_id,
    )
    return finding


def evaluation(org_id: Any) -> dict[str, Any]:
    """Precision per rule from reviewed findings. A sheet is labelled once all its findings are."""
    findings = Finding.objects.filter(organisation_id=org_id)
    per_rule: list[dict[str, Any]] = []
    for row in (
        findings.values("rule")
        .annotate(
            accepted=Count("pk", filter=Q(status=FindingStatus.ACCEPTED)),
            rejected=Count("pk", filter=Q(status=FindingStatus.REJECTED)),
            open=Count("pk", filter=Q(status=FindingStatus.OPEN)),
        )
        .order_by("rule")
    ):
        reviewed = row["accepted"] + row["rejected"]
        per_rule.append(
            {**row, "precision": round(row["accepted"] / reviewed, 2) if reviewed else None}
        )
    checked = findings.values("sheet_id").distinct().count()
    unlabelled = findings.filter(status=FindingStatus.OPEN).values("sheet_id").distinct().count()
    accepted = sum(int(r["accepted"]) for r in per_rule)
    reviewed = accepted + sum(int(r["rejected"]) for r in per_rule)
    return {
        "labelled_sheets": checked - unlabelled,
        "needed_sheets": ROLLOUT_LABELLED_SHEETS,
        "precision": round(accepted / reviewed, 2) if reviewed else None,
        "rules": per_rule,
        "mode": OrgSettings.objects.get(organisation_id=org_id).drawing_checks,
    }


def set_mode(actor: User, mode: str) -> dict[str, Any]:
    require(actor, Action.MANAGE_ORG_SETTINGS)
    if mode not in ("off", "evaluation", "on"):
        raise DomainError("invalid_mode", "Choose off, evaluation or on.")
    ev = evaluation(actor.org_pk)
    if mode == "on" and ev["labelled_sheets"] < ROLLOUT_LABELLED_SHEETS:
        raise ConflictError(
            "not_evaluated",
            f"Label findings on at least {ROLLOUT_LABELLED_SHEETS} sheets first "
            f"({ev['labelled_sheets']} so far), and agree the precision target with the owner.",
        )
    OrgSettings.objects.filter(organisation_id=actor.org_pk).update(drawing_checks=mode)
    record(
        organisation_id=actor.org_pk,
        actor=actor,
        verb="drawing_checks.mode",
        entity_type="core.orgsettings",
        entity_id=actor.org_pk,
        after={"mode": mode, "precision": ev["precision"]},
    )
    return evaluation(actor.org_pk)

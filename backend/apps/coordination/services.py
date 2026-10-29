"""F-34 / I-07 clash import. BCF: one issue per topic with title, status, viewpoint snapshot and
assignee; Navisworks: one per clash result. Re-importing updates by GUID. XML is parsed with
defusedxml (no entities, no external DTDs) and the zip is size- and count-limited."""

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from xml.etree.ElementTree import Element

from defusedxml import ElementTree as SafeET
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.audit.services import record, record_change, snapshot
from apps.core.exceptions import DomainError
from apps.core.models import Discipline
from apps.files import storage
from apps.files.models import FileObject, UploadKind
from apps.files.services import ready_upload
from apps.projects.models import Project, ProjectMembership
from apps.register.models import Sheet

from .models import ClashImport, ClashIssue, ClashSource, ClashStatus

MAX_ENTRIES = 20_000
MAX_UNCOMPRESSED = 300 * 1024 * 1024
MAX_SNAPSHOT = 5 * 1024 * 1024
MAX_XML = 50 * 1024 * 1024
STATUS_WORDS = {
    "open": ClashStatus.OPEN,
    "new": ClashStatus.OPEN,
    "active": ClashStatus.IN_PROGRESS,
    "in progress": ClashStatus.IN_PROGRESS,
    "reviewed": ClashStatus.IN_PROGRESS,
    "approved": ClashStatus.RESOLVED,
    "resolved": ClashStatus.RESOLVED,
    "closed": ClashStatus.CLOSED,
    "done": ClashStatus.CLOSED,
}


@dataclass
class Topic:
    guid: str
    title: str
    description: str = ""
    status: str = ""
    priority: str = ""
    topic_type: str = ""
    labels: list[str] = field(default_factory=list)
    assigned_to: str = ""
    modified: datetime | None = None
    snapshot: bytes | None = None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(el: Element | None, name: str) -> Element | None:
    if el is None:
        return None
    return next((c for c in el if _local(c.tag) == name), None)


def _text(el: Element | None, name: str) -> str:
    c = _child(el, name)
    return (c.text or "").strip() if c is not None else ""


def _dt(text: str) -> datetime | None:
    d = parse_datetime(text) if text else None
    if d is not None and timezone.is_naive(d):
        d = timezone.make_aware(d, UTC)
    return d


def _guard(zf: zipfile.ZipFile) -> None:
    infos = zf.infolist()
    if len(infos) > MAX_ENTRIES or sum(i.file_size for i in infos) > MAX_UNCOMPRESSED:
        raise DomainError("too_large", "The BCF file is too large once unpacked.")
    for i in infos:
        if i.filename.startswith("/") or ".." in i.filename.split("/"):
            raise DomainError("bad_zip", "The BCF file contains unsafe paths.")


def parse_bcf(data: bytes) -> list[Topic]:
    """BCF 2.1 and 3.0: <topic guid>/markup.bcf (+ snapshot.png / viewpoints)."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise DomainError("not_bcf", "That is not a .bcfzip file.") from exc
    _guard(zf)
    names = set(zf.namelist())
    topics = []
    for name in sorted(names):
        if not name.lower().endswith("markup.bcf"):
            continue
        folder = name.rsplit("/", 1)[0] + "/" if "/" in name else ""
        info = zf.getinfo(name)
        if info.file_size > MAX_XML:
            raise DomainError("too_large", f"{name} is too large.")
        try:
            root = SafeET.fromstring(zf.read(name))
        except Exception as exc:
            raise DomainError("bad_bcf", f"{name} is not valid BCF XML.") from exc
        topic = _child(root, "Topic")
        if topic is None:
            continue
        guid = topic.get("Guid") or folder.strip("/")
        labels = [(c.text or "").strip() for c in topic if _local(c.tag) == "Labels" and c.text]
        labels += [
            (c.text or "").strip()
            for lbl in topic
            if _local(lbl.tag) == "Labels"
            for c in lbl
            if c.text
        ]
        t = Topic(
            guid=guid[:120],
            title=(_text(topic, "Title") or "Untitled clash")[:300],
            description=_text(topic, "Description"),
            status=topic.get("TopicStatus") or _text(topic, "TopicStatus"),
            priority=_text(topic, "Priority"),
            topic_type=topic.get("TopicType") or _text(topic, "TopicType"),
            labels=[x for x in labels if x][:20],
            assigned_to=_text(topic, "AssignedTo"),
            modified=_dt(_text(topic, "ModifiedDate") or _text(topic, "CreationDate")),
        )
        # Snapshot: BCF 3.0 lists it in Topic/Viewpoints/ViewPoint/Snapshot, BCF 2.1 in
        # Markup/Viewpoints/Snapshot; older files just ship snapshot.png in the topic folder.
        vps = _child(topic, "Viewpoints")
        vps = (_child(vps, "ViewPoint") or vps) if vps is not None else _child(root, "Viewpoints")
        snap_name = _text(vps, "Snapshot")
        if not snap_name:
            snap_name = next(
                (c for c in ("snapshot.png", "snapshot.jpg") if folder + c in names), ""
            )
        path = folder + snap_name if snap_name else ""
        if path and path in names and zf.getinfo(path).file_size <= MAX_SNAPSHOT:
            t.snapshot = zf.read(path)
        topics.append(t)
    if not topics:
        raise DomainError("empty_bcf", "No BCF topics found in the file.")
    return topics


def parse_navisworks(data: bytes) -> list[Topic]:
    """Navisworks Manage XML clash report: exchange/batchtest/clashtests/clashtest/...."""
    if len(data) > MAX_XML:
        raise DomainError("too_large", "The clash report is too large.")
    try:
        root = SafeET.fromstring(data)
    except Exception as exc:
        raise DomainError("bad_xml", "That is not a Navisworks XML clash report.") from exc
    topics = []
    for test in root.iter():
        if _local(test.tag) != "clashtest":
            continue
        test_name = test.get("name", "")
        for result in test.iter():
            if _local(result.tag) != "clashresult":
                continue
            name = result.get("name", "Clash")
            guid = result.get("guid") or f"{test_name}:{name}"
            topics.append(
                Topic(
                    guid=guid[:120],
                    title=f"{test_name} · {name}"[:300] if test_name else name[:300],
                    description=_text(result, "description"),
                    status=result.get("status", ""),
                    topic_type="Clash",
                    labels=[test_name] if test_name else [],
                )
            )
    if not topics:
        raise DomainError("empty_report", "No clash results found in the report.")
    return topics


def guess_discipline(org_id: Any, topic: Topic) -> Discipline | None:
    text = " ".join([topic.title, *topic.labels, topic.topic_type]).lower()
    for d in Discipline.objects.filter(organisation_id=org_id):
        if d.name.lower() in text or re.search(rf"\b{re.escape(d.code.lower())}\b", text):
            return d
    return None


def _store_snapshot(org_id: Any, data: bytes) -> FileObject | None:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime, ext = "image/png", "png"
    elif data[:3] == b"\xff\xd8\xff":
        mime, ext = "image/jpeg", "jpg"
    else:
        return None
    sha = hashlib.sha256(data).hexdigest()
    existing = FileObject.objects.filter(organisation_id=org_id, sha256=sha).first()
    if existing:
        return existing
    key = f"clashes/{org_id}/{sha}.{ext}"
    storage.put_bytes(key, data, mime)
    return FileObject.objects.create(
        organisation_id=org_id,
        storage_key=key,
        sha256=sha,
        size=len(data),
        mime=mime,
        original_name=f"viewpoint.{ext}",
    )


@transaction.atomic
def import_clashes(actor: User, project: Project, upload_id: Any) -> ClashImport:
    require(actor, Action.MANAGE_CLASHES, project=project)
    upload = ready_upload(actor, upload_id, UploadKind.DATA)
    if upload.file is None:
        raise DomainError("upload_not_ready", "The file is not ready yet.")
    data = storage.get_bytes(upload.file.storage_key)
    name = upload.original_name.lower()
    if name.endswith((".bcfzip", ".bcf")):
        source, topics = ClashSource.BCF, parse_bcf(data)
    elif name.endswith(".xml"):
        source, topics = ClashSource.NAVISWORKS, parse_navisworks(data)
    else:
        raise DomainError(
            "unsupported", "Import a .bcfzip (BCF 2.1/3.0) or a Navisworks XML clash report."
        )
    job = ClashImport.objects.create(
        organisation_id=project.organisation_id,
        project=project,
        source=source,
        original_name=upload.original_name,
        file=upload.file,
        imported_by=actor,
    )
    created = updated = 0
    for t in topics:
        mapped = STATUS_WORDS.get(t.status.strip().lower(), ClashStatus.OPEN)
        issue = ClashIssue.objects.filter(project=project, source=source, guid=t.guid).first()
        fields: dict[str, Any] = {
            "title": t.title,
            "description": t.description,
            "source_status": t.status[:60],
            "priority": t.priority[:60],
            "topic_type": t.topic_type[:60],
            "labels": t.labels,
            "assigned_to_text": t.assigned_to[:200],
            "source_modified": t.modified,
            "last_import": job,
        }
        if t.snapshot:
            fields["snapshot"] = _store_snapshot(project.organisation_id, t.snapshot)
        if issue is None:
            ClashIssue.objects.create(
                organisation_id=project.organisation_id,
                project=project,
                source=source,
                guid=t.guid,
                status=mapped,
                discipline=guess_discipline(project.organisation_id, t),
                **fields,
            )
            created += 1
        else:
            for k, v in fields.items():
                setattr(issue, k, v)
            if not issue.status_locked:
                issue.status = mapped  # the tool's status wins until someone sets it here
            issue.save()
            updated += 1
    job.counts = {"topics": len(topics), "created": created, "updated": updated}
    job.save(update_fields=["counts", "updated_at"])
    record(
        organisation_id=project.organisation_id,
        actor=actor,
        verb="clashes.imported",
        entity_type="coordination.clashimport",
        entity_id=job.pk,
        entity_label=f"{upload.original_name}: {created} new, {updated} updated",
        after=job.counts,
        project_id=project.pk,
    )
    return job


@transaction.atomic
def update_issue(actor: User, issue: ClashIssue, **data: Any) -> ClashIssue:
    issue = (
        ClashIssue.objects.select_for_update(of=("self",))
        .select_related("project")
        .get(pk=issue.pk)
    )
    require(actor, Action.MANAGE_CLASHES, project=issue.project)
    before = snapshot(issue, ("status", "assignee", "discipline"))
    if "sheets" in data:
        sheets: list[Sheet] = data.pop("sheets")
        if any(s.project_id != issue.project_id for s in sheets):
            raise DomainError("invalid_sheet", "A linked sheet belongs to another project.")
        issue.sheets.set(sheets)
    if (
        data.get("assignee") is not None
        and not ProjectMembership.objects.filter(
            project=issue.project, user=data["assignee"]
        ).exists()
    ):
        raise DomainError("not_member", f"{data['assignee']} is not on this project's team.")
    if (
        "discipline" in data
        and data["discipline"] is not None
        and data["discipline"].organisation_id != issue.organisation_id
    ):
        raise DomainError("invalid_discipline", "Unknown discipline.")
    for k in ("status", "assignee", "discipline"):
        if k in data:
            setattr(issue, k, data[k])
    if "status" in data:
        issue.status_locked = True
    issue.save()
    record_change(
        issue,
        actor=actor,
        verb="clash.updated",
        before=before,
        after=snapshot(issue, ("status", "assignee", "discipline")),
    )
    return issue

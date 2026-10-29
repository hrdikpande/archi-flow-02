"""N-06: a full project export — every record as JSON plus every stored file — for the client
on request or when a project leaves the system. Written to a temporary file (projects can hold
gigabytes of PDFs), then streamed to storage."""

import json
import tempfile
import zipfile
from datetime import date, datetime
from decimal import Decimal
from typing import IO, Any
from uuid import UUID

from django.db.models import QuerySet

from apps.audit.models import AuditEvent
from apps.files import storage
from apps.files.models import FileObject
from apps.projects.models import Package, Project, ProjectMembership, Stage
from apps.register.models import Sheet, SheetRevision
from apps.transmittals.models import Transmittal, TransmittalItem, TransmittalRecipient
from apps.workflow.models import Review, StatusTransition


def _json(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal | UUID):
        return str(value)
    raise TypeError(type(value))


def _rows(qs: QuerySet[Any], exclude: tuple[str, ...] = ("search_vector",)) -> list[dict[str, Any]]:
    fields = [f.attname for f in qs.model._meta.concrete_fields if f.name not in exclude]
    return list(qs.values(*fields))


def project_records(project: Project) -> dict[str, Any]:
    sheets = Sheet.objects.filter(project=project)
    revisions = SheetRevision.objects.filter(sheet__project=project)
    transmittals = Transmittal.objects.filter(project=project)
    emails = dict(
        ProjectMembership.objects.filter(project=project).values_list("user_id", "user__email")
    )
    return {
        "format": "drawingops-project-export/1",
        "project": _rows(Project.objects.filter(pk=project.pk))[0],
        "stages": _rows(Stage.objects.filter(project=project)),
        "packages": _rows(Package.objects.filter(project=project)),
        "team": [
            {**m, "email": emails.get(m["user_id"], "")}
            for m in _rows(ProjectMembership.objects.filter(project=project))
        ],
        "sheets": _rows(sheets),
        "revisions": _rows(revisions),
        "state_changes": _rows(StatusTransition.objects.filter(sheet__project=project)),
        "reviews": _rows(Review.objects.filter(sheet__project=project)),
        "transmittals": _rows(transmittals),
        "transmittal_items": _rows(TransmittalItem.objects.filter(transmittal__project=project)),
        "transmittal_recipients": _rows(
            TransmittalRecipient.objects.filter(transmittal__project=project)
        ),
        "audit": _rows(AuditEvent.objects.filter(project_id=project.pk).order_by("at")),
    }


def project_files(project: Project) -> QuerySet[FileObject]:
    ids: set[Any] = set(
        SheetRevision.objects.filter(sheet__project=project, file__isnull=False).values_list(
            "file_id", flat=True
        )
    )
    ids |= set(
        Transmittal.objects.filter(project=project, cover_file__isnull=False).values_list(
            "cover_file_id", flat=True
        )
    )
    ids |= set(
        Review.redlines.through.objects.filter(review__sheet__project=project).values_list(
            "fileobject_id", flat=True
        )
    )
    if project.appointment_letter_id:
        ids.add(project.appointment_letter_id)
    return FileObject.objects.filter(pk__in=ids)


def write_archive(project: Project, out: IO[bytes]) -> int:
    """Write the zip to `out`; returns the number of files included."""
    files = list(project_files(project))
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
        records = project_records(project)
        records["files"] = [
            {
                "id": str(f.pk),
                "sha256": f.sha256,
                "name": f.original_name,
                "path": f"files/{f.sha256}-{f.original_name}",
            }
            for f in files
        ]
        zf.writestr("project.json", json.dumps(records, default=_json, indent=1))
        for f in files:
            with tempfile.TemporaryFile() as tmp:
                storage.download_to(f.storage_key, tmp)
                tmp.seek(0)
                with zf.open(f"files/{f.sha256}-{f.original_name}", "w", force_zip64=True) as dst:
                    while chunk := tmp.read(1 << 20):
                        dst.write(chunk)
    return len(files)


def count(project: Project) -> int:
    return project_files(project).count()

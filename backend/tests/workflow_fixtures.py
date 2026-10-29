"""A small project team for workflow, issue and dashboard tests."""

from dataclasses import dataclass
from typing import Any

import pytest

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.models import Discipline, Organisation
from apps.files.models import FileObject, Upload, UploadKind, UploadState
from apps.projects.models import Project, Stage
from apps.register.models import NamingStatus, Sheet, SheetRevision

from .conftest import make_pdf


@dataclass
class Team:
    org: Organisation
    project: Project
    stage: Stage
    arch: Discipline
    pl: User
    dl: User
    designer: User
    checker: User
    senior: User
    dc: User
    outsider: User


@pytest.fixture
def team(org, project, make_user, add_member) -> Team:
    people = {}
    for key, role, name in [
        ("pl", ProjectRole.PL, "Priya Lead"),
        ("dl", ProjectRole.DL, "Dev Lead"),
        ("designer", ProjectRole.DESIGNER, "Rahul Kumar"),
        ("checker", ProjectRole.DL, "Anil Kapoor"),
        ("senior", ProjectRole.SENIOR_REVIEWER, "Sunita Rao"),
        ("dc", ProjectRole.DC, "Deepa Chandra"),
    ]:
        user = make_user(OrgRole.STAFF, email=f"{key}@firm.example", name=name)
        add_member(user, role)
        people[key] = user
    outsider = make_user(OrgRole.STAFF, email="outsider@firm.example")
    stage = Stage.objects.create(organisation=org, project=project, seq=4, name="Working drawings")
    arch = Discipline.objects.create(
        organisation=org, code="A", name="Architecture", sheet_prefix_regex=r"^A-\d{3}$"
    )
    return Team(org=org, project=project, stage=stage, arch=arch, outsider=outsider, **people)


def new_sheet(team: Team, number: str = "A-101", **extra: Any) -> Sheet:
    data: dict[str, Any] = {
        "organisation": team.org,
        "project": team.project,
        "stage": team.stage,
        "discipline": team.arch,
        "number": number,
        "title": "Ground Floor Plan",
        "owner": team.designer,
        "checker": team.checker,
    }
    data.update(extra)
    return Sheet.objects.create(**data)


def ready_upload_for(
    user: User,
    name: str = "A-101.pdf",
    pages: int = 1,
    sha: str | None = None,
    kind: str = UploadKind.SHEET,
) -> Upload:
    """An upload already verified by the pipeline (skips storage)."""
    import hashlib

    content = make_pdf(pages) + (sha or name).encode()
    digest = hashlib.sha256(content).hexdigest()
    file, _ = FileObject.objects.get_or_create(  # deduplicated by SHA-256, like the pipeline
        organisation_id=user.organisation_id,
        sha256=digest,
        defaults={
            "storage_key": f"files/{digest}.pdf",
            "size": len(content),
            "mime": "application/pdf",
            "original_name": name,
            "page_count": pages,
        },
    )
    return Upload.objects.create(
        organisation_id=user.organisation_id,
        uploaded_by=user,
        kind=kind,
        original_name=name,
        declared_size=len(content),
        content_type="application/pdf",
        staging_key=f"staging/{digest}-{Upload.objects.count()}.pdf",
        state=UploadState.READY,
        file=file,
    )


def draft_with_pdf(
    team: Team, sheet: Sheet, code: str = "P01", name: str | None = None
) -> SheetRevision:
    upload = ready_upload_for(team.designer, name or f"{sheet.number}.pdf", sha=f"{sheet.pk}{code}")
    return SheetRevision.objects.create(
        organisation=team.org,
        sheet=sheet,
        code=code,
        seq=SheetRevision.objects.filter(sheet=sheet).count() + 1,
        file=upload.file,
        original_name=upload.original_name,
        naming_status=NamingStatus.OK,
        stage=sheet.stage,
    )

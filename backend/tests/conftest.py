import io
from collections.abc import Callable
from typing import Any

import pikepdf
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.models import Organisation, OrgSettings
from apps.files import storage
from apps.projects.models import Project, ProjectMembership


@pytest.fixture
def org(db: Any) -> Organisation:
    organisation = Organisation.objects.create(name="Demo Design Studio")
    OrgSettings.objects.create(organisation=organisation)
    return organisation


@pytest.fixture
def other_org(db: Any) -> Organisation:
    organisation = Organisation.objects.create(name="Another Firm")
    OrgSettings.objects.create(organisation=organisation)
    return organisation


@pytest.fixture
def make_user(org: Organisation) -> Callable[..., User]:
    counter = {"n": 0}

    def _make(
        role: str = OrgRole.STAFF,
        *,
        organisation: Organisation | None = None,
        email: str | None = None,
        name: str = "Test Person",
    ) -> User:
        counter["n"] += 1
        return User.objects.create_user(
            email or f"user{counter['n']}@firm.example",
            "a-strong-password-123",
            full_name=name,
            organisation=organisation or org,
            org_role=role,
        )

    return _make


@pytest.fixture
def project(org: Organisation) -> Project:
    return Project.objects.create(organisation=org, code="2026-014", name="HSR Block B")


@pytest.fixture
def add_member(project: Project) -> Callable[[User, str], ProjectMembership]:
    def _add(user: User, role: str = ProjectRole.DESIGNER) -> ProjectMembership:
        return ProjectMembership.objects.create(
            organisation=project.organisation, project=project, user=user, role=role
        )

    return _add


@pytest.fixture
def client_for() -> Callable[[User | None], APIClient]:
    def _client(user: User | None) -> APIClient:
        client = APIClient()
        if user is not None:
            client.force_login(user)
        return client

    return _client


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    return make_user(OrgRole.ADMIN, email="admin@firm.example", name="Asha Admin")


@pytest.fixture
def admin_client(client_for: Callable[[User | None], APIClient], admin: User) -> APIClient:
    return client_for(admin)


def make_pdf(pages: int = 1) -> bytes:
    pdf = pikepdf.new()
    for _ in range(pages):
        pdf.add_blank_page(page_size=(2384, 3370))  # A0 in points
    buf = io.BytesIO()
    pdf.save(buf, static_id=True)  # the default /ID mixes in the clock: same input, same bytes
    return buf.getvalue()


class FakeStorage:
    """In-memory stand-in for the S3 wrapper (apps.files.storage)."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def presign_put(
        self, key: str, content_type: str, expires_in: int, origin: str | None = None
    ) -> str:
        return f"http://storage.test/{key}?signed=1"

    def head(self, key: str) -> dict[str, Any] | None:
        return {"ContentLength": len(self.objects[key])} if key in self.objects else None

    def download_to(self, key: str, fileobj: Any) -> None:
        fileobj.write(self.objects[key])

    def copy(self, src_key: str, dst_key: str, content_type: str) -> None:
        self.objects[dst_key] = self.objects[src_key]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    def put_file(self, key: str, fileobj: Any, content_type: str) -> None:
        self.objects[key] = fileobj.read()

    def get_bytes(self, key: str) -> bytes:
        return self.objects[key]

    def presign_get(
        self,
        key: str,
        filename: str,
        expires_in: int = 300,
        origin: str | None = None,
        attachment: bool = False,
    ) -> str:
        return f"http://storage.test/{key}?download=1"


@pytest.fixture
def fake_storage(monkeypatch: pytest.MonkeyPatch) -> FakeStorage:
    fake = FakeStorage()
    for name in (
        "presign_put",
        "head",
        "download_to",
        "copy",
        "delete",
        "put_bytes",
        "put_file",
        "get_bytes",
        "presign_get",
    ):
        monkeypatch.setattr(storage, name, getattr(fake, name))
    return fake


def pytest_collection_modifyitems(config: Any, items: list[Any]) -> None:
    """WeasyPrint needs Pango: those tests run in the Docker test image (make test-backend)."""
    try:
        import weasyprint  # noqa: F401
    except OSError:
        skip = pytest.mark.skip(reason="Pango not installed; run `make test-backend`")
        for item in items:
            if "requires_weasyprint" in item.keywords:
                item.add_marker(skip)


# Shared fixtures defined in helper modules.
from .workflow_fixtures import team  # noqa: E402, F401

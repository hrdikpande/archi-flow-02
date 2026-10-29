"""F-41, N-03: presigned uploads, PDF validation, SHA-256 dedupe, immutable stored files."""

import pytest

from apps.files.models import FileObject, Upload, UploadState
from apps.files.services import clean_filename, process_upload
from apps.files.validators import validate_cad_link
from apps.outbox.services import dispatch_pending

from .conftest import make_pdf

PRESIGN = "/api/v1/uploads/presign"


@pytest.fixture
def designer_client(make_user, client_for):
    return client_for(make_user("staff"))


def _upload(client, fake_storage, content: bytes, name: str = "A-101.pdf") -> dict:
    body = {"filename": name, "size": len(content), "content_type": "application/pdf"}
    presigned = client.post(PRESIGN, body)
    assert presigned.status_code == 201, presigned.content
    upload = presigned.json()["upload"]
    assert presigned.json()["method"] == "PUT"
    staging_key = Upload.objects.get(pk=upload["id"]).staging_key
    fake_storage.objects[staging_key] = content  # the browser's PUT
    return upload


def _complete(client, upload_id: str, captured) -> dict:
    with captured(execute=True):
        response = client.post(f"/api/v1/uploads/{upload_id}/complete")
    assert response.status_code == 202, response.content
    with captured(execute=True):
        dispatch_pending()  # outbox → file.uploaded handler → process_upload (eager)
    return client.get(f"/api/v1/uploads/{upload_id}").json()


def test_one_page_pdf_becomes_ready(
    designer_client, fake_storage, django_capture_on_commit_callbacks
) -> None:
    upload = _upload(designer_client, fake_storage, make_pdf(1))
    result = _complete(designer_client, upload["id"], django_capture_on_commit_callbacks)
    assert result["state"] == UploadState.READY
    stored = FileObject.objects.get()
    assert stored.page_count == 1
    assert (
        stored.storage_key
        == f"files/{stored.organisation_id}/{stored.sha256[:2]}/{stored.sha256}.pdf"
    )
    assert stored.storage_key in fake_storage.objects
    assert not any(k.startswith("staging/") for k in fake_storage.objects)


def test_same_file_twice_is_stored_once(
    designer_client, fake_storage, django_capture_on_commit_callbacks
) -> None:
    content = make_pdf(1)
    first = _complete(
        designer_client,
        _upload(designer_client, fake_storage, content)["id"],
        django_capture_on_commit_callbacks,
    )
    second = _complete(
        designer_client,
        _upload(designer_client, fake_storage, content)["id"],
        django_capture_on_commit_callbacks,
    )
    assert FileObject.objects.count() == 1
    assert first["file_id"] == second["file_id"]
    assert second["is_duplicate"] is True


@pytest.mark.parametrize(
    ("content", "reason"),
    [
        (make_pdf(2), "has 2 pages"),
        (b"GIF89a not a pdf at all", "not a PDF"),
        (b"%PDF-1.7 truncated garbage", "damaged"),
    ],
)
def test_bad_files_are_rejected_with_a_reason(
    designer_client, fake_storage, django_capture_on_commit_callbacks, content, reason
) -> None:
    upload = _upload(designer_client, fake_storage, content)
    result = _complete(designer_client, upload["id"], django_capture_on_commit_callbacks)
    assert result["state"] == UploadState.REJECTED
    assert reason in result["reason"]
    assert FileObject.objects.count() == 0
    assert fake_storage.objects == {}


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"filename": "A-101.dwg", "size": 10, "content_type": "application/acad"}, "not_pdf"),
        (
            {"filename": "A-101.pdf", "size": 300 * 1024 * 1024, "content_type": "application/pdf"},
            "too_large",
        ),
    ],
)
def test_presign_validates_before_upload(designer_client, fake_storage, body, code) -> None:
    response = designer_client.post(PRESIGN, body)
    assert response.status_code == 400
    assert response.json()["code"] == code


def test_complete_before_put_is_a_conflict(designer_client, fake_storage) -> None:
    body = {"filename": "A-101.pdf", "size": 10, "content_type": "application/pdf"}
    upload = designer_client.post(PRESIGN, body).json()["upload"]
    response = designer_client.post(f"/api/v1/uploads/{upload['id']}/complete")
    assert response.status_code == 409


def test_cannot_see_or_complete_someone_elses_upload(
    designer_client, fake_storage, make_user, client_for
) -> None:
    upload = _upload(designer_client, fake_storage, make_pdf(1))
    other = client_for(make_user("staff"))
    assert other.get(f"/api/v1/uploads/{upload['id']}").status_code == 404
    assert other.post(f"/api/v1/uploads/{upload['id']}/complete").status_code == 404


def test_process_upload_is_idempotent(
    designer_client, fake_storage, django_capture_on_commit_callbacks
) -> None:
    upload = _upload(designer_client, fake_storage, make_pdf(1))
    _complete(designer_client, upload["id"], django_capture_on_commit_callbacks)
    again = process_upload(upload["id"])
    assert again.state == UploadState.READY
    assert FileObject.objects.count() == 1


def test_filename_is_cleaned() -> None:
    assert clean_filename("..\\..\\etc/passwd\x00.pdf") == "passwd_.pdf"
    assert clean_filename("  A-101 Ground Floor.pdf ") == "A-101 Ground Floor.pdf"


@pytest.mark.parametrize(
    "link",
    [
        r"\\fileserver\2026-014\ARCH\A-101.dwg",
        r"P:\2026-014\ARCH\A-101.dwg",
        "https://firm.sharepoint.com/sites/2026-014/A-101.dwg",
        "https://drive.google.com/file/d/abc/view",
        "https://acc.autodesk.com/docs/files/projects/xyz",
    ],
)
def test_cad_link_accepts_firm_locations(link: str) -> None:
    assert validate_cad_link(link) == link


@pytest.mark.parametrize(
    "link",
    ["http://firm.sharepoint.com/x", "https://evil.example/A-101.dwg", "javascript:alert(1)"],
)
def test_cad_link_rejects_other_locations(link: str) -> None:
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError):
        validate_cad_link(link)

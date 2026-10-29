"""Thin S3 API wrapper. The same code runs against SeaweedFS on-prem or cloud S3 (ADR-005)."""

from functools import cache
from typing import IO, Any

import boto3
from botocore.client import Config
from django.conf import settings


def _client(endpoint_url: str | None) -> Any:
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        # Path style for SeaweedFS/MinIO-like endpoints; AWS S3 itself uses virtual-hosted URLs.
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path" if endpoint_url else "virtual"},
        ),
    )


@cache
def internal_client() -> Any:
    return _client(settings.S3_ENDPOINT_URL)


@cache
def public_client(origin: str | None = None) -> Any:
    """Presigns URLs against an endpoint the browser can reach.

    With S3_PRESIGN_VIA_APP_ORIGIN the URL is signed for the app's own origin (validated by
    ALLOWED_HOSTS), so it works the same from Caddy (:8080) and the Vite dev server (:5173).
    """
    if settings.S3_PRESIGN_VIA_APP_ORIGIN and origin:
        return _client(origin)
    return _client(settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL)


def _sse() -> dict[str, str]:
    sse = settings.S3_SERVER_SIDE_ENCRYPTION
    return {"ServerSideEncryption": sse} if sse else {}


def presign_put(key: str, content_type: str, expires_in: int, origin: str | None = None) -> str:
    return public_client(origin).generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def presign_get(
    key: str,
    filename: str,
    expires_in: int = 300,
    origin: str | None = None,
    attachment: bool = False,
) -> str:
    """PDFs open in the browser (inline); exports download with their real name (attachment)."""
    safe = filename.replace('"', "")
    disposition = "attachment" if attachment else "inline"
    return public_client(origin).generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ResponseContentDisposition": f'{disposition}; filename="{safe}"',
        },
        ExpiresIn=expires_in,
    )


def head(key: str) -> dict[str, Any] | None:
    try:
        return internal_client().head_object(Bucket=settings.S3_BUCKET, Key=key)
    except internal_client().exceptions.ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    internal_client().put_object(
        Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type, **_sse()
    )


def put_file(key: str, fileobj: IO[bytes], content_type: str) -> None:
    """Streamed (multipart) upload for large files such as project archives (N-06)."""
    extra = {"ContentType": content_type, **_sse()}
    internal_client().upload_fileobj(fileobj, settings.S3_BUCKET, key, ExtraArgs=extra)


def get_bytes(key: str) -> bytes:
    return internal_client().get_object(Bucket=settings.S3_BUCKET, Key=key)["Body"].read()


def download_to(key: str, fileobj: IO[bytes]) -> None:
    internal_client().download_fileobj(settings.S3_BUCKET, key, fileobj)


def copy(src_key: str, dst_key: str, content_type: str) -> None:
    internal_client().copy_object(
        Bucket=settings.S3_BUCKET,
        Key=dst_key,
        CopySource={"Bucket": settings.S3_BUCKET, "Key": src_key},
        ContentType=content_type,
        MetadataDirective="REPLACE",
        **_sse(),
    )


def delete(key: str) -> None:
    internal_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)


def ensure_bucket() -> None:
    client = internal_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if settings.S3_BUCKET not in existing:
        client.create_bucket(Bucket=settings.S3_BUCKET)

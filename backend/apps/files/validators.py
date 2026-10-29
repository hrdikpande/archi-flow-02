"""File and link validation (N-03, F-41)."""

import re

from django.core.exceptions import ValidationError

PDF_MAGIC = b"%PDF-"

_UNC = re.compile(r"^\\\\[^\\/:*?\"<>|]+\\[^\\/:*?\"<>|]+(\\[^\\/:*?\"<>|]+)*\\?$")
_DRIVE_PATH = re.compile(r"^[A-Za-z]:\\[^/:*?\"<>|]*$")
_ALLOWED_URL_HOSTS = re.compile(
    r"^https://([a-z0-9-]+\.)*("
    r"sharepoint\.com|onedrive\.live\.com|1drv\.ms|drive\.google\.com|docs\.google\.com"
    r"|autodesk\.com|autodesk360\.com|acc\.autodesk\.com"
    r")(/|$)",
    re.IGNORECASE,
)


def is_pdf_header(head: bytes) -> bool:
    """A PDF must start with %PDF- within its first 1,024 bytes (ISO 32000 tolerance)."""
    return PDF_MAGIC in head[:1024]


def validate_cad_link(value: str) -> str:
    """F-41: CAD files are linked, never copied. Accepts UNC paths, mapped-drive paths,
    SharePoint/OneDrive/Google Drive URLs and Autodesk links."""
    value = value.strip()
    if _UNC.match(value) or _DRIVE_PATH.match(value) or _ALLOWED_URL_HOSTS.match(value):
        return value
    raise ValidationError(
        "Use a network path such as \\\\fileserver\\2026-014\\ARCH\\A-101.dwg, "
        "or a SharePoint, Google Drive or Autodesk link starting with https://."
    )

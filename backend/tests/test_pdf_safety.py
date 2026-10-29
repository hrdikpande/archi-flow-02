"""Generated PDFs never fetch external resources (SSRF / local file disclosure)."""

import base64
from unittest import mock

import pytest

from apps.core.pdf import render_pdf

PIXEL = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154"
        "789c6360000002000154a24f5d0000000049454e44ae426082"
    )
).decode()


@pytest.mark.requires_weasyprint
def test_only_data_uris_are_loaded():
    from urllib.request import OpenerDirector

    opened = []
    real_open = OpenerDirector.open

    def spy(self, url, *args, **kwargs):
        opened.append(url if isinstance(url, str) else url.full_url)
        return real_open(self, url, *args, **kwargs)

    html = (
        '<link rel="stylesheet" href="file:///etc/passwd">'
        '<img src="http://169.254.169.254/latest/meta-data/">'
        '<img src="file:///etc/hosts">'
        f'<img src="data:image/png;base64,{PIXEL}"><p>ok</p>'
    )
    with mock.patch.object(OpenerDirector, "open", spy):
        pdf = render_pdf(html)
    assert pdf.startswith(b"%PDF")
    assert all(u.startswith("data:") for u in opened), opened

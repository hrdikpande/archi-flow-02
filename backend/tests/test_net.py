"""SSRF guard for Admin-configured outbound URLs (I-08 billing webhook)."""

import socket
from unittest import mock

import pytest

from apps.core import net
from apps.core.api.serializers import OrgSettingsSerializer


def resolves_to(*addresses):
    infos = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, 443)) for a in addresses]
    return mock.patch("apps.core.net.socket.getaddrinfo", return_value=infos)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.5",
        "172.16.1.1",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",  # noqa: S104 - an address under test, not a bind
        "::1",
        "fd00::1",
        "::ffff:10.0.0.1",
    ],
)
def test_non_public_addresses_are_refused(address):
    with resolves_to(address), pytest.raises(net.UnsafeURL):
        net.public_address("hook.example", 443)


def test_one_private_answer_among_public_ones_is_refused():
    with resolves_to("93.184.216.34", "10.0.0.5"), pytest.raises(net.UnsafeURL):
        net.public_address("hook.example", 443)


def test_public_address_is_returned():
    with resolves_to("93.184.216.34"):
        assert net.public_address("hook.example", 443) == "93.184.216.34"


@pytest.mark.parametrize(
    "url", ["file:///etc/passwd", "gopher://x/", "ftp://hook.example/", "https:///nohost"]
)
def test_only_http_urls(url):
    with pytest.raises(net.UnsafeURL):
        net.post(url, b"{}", {})


def test_connection_is_pinned_to_the_checked_address(settings):
    settings.ENVIRONMENT = "development"
    seen = {}

    def connect(address, timeout):
        seen["address"] = address
        raise OSError("stop")

    with (
        resolves_to("93.184.216.34"),
        mock.patch("apps.core.net.socket.create_connection", connect),
        pytest.raises(OSError, match="stop"),
    ):
        net.post("http://hook.example:8081/in?x=1", b"{}", {})
    assert seen["address"] == ("93.184.216.34", 8081)


def test_plain_http_is_refused_in_production(settings):
    settings.ENVIRONMENT = "production"
    with pytest.raises(net.UnsafeURL):
        net.post("http://hook.example/", b"{}", {})


@pytest.mark.django_db
def test_settings_reject_an_internal_webhook_host():
    with resolves_to("169.254.169.254"):
        s = OrgSettingsSerializer(
            data={"billing_webhook_url": "https://metadata.example/hook"}, partial=True
        )
        assert not s.is_valid()
    assert "non-public" in str(s.errors["billing_webhook_url"])

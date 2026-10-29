"""Outbound HTTP to Admin-configured URLs (the I-08 billing webhook) without SSRF (DD-029).

The host must resolve only to public addresses; the connection is pinned to the address that was
checked, so a second DNS answer cannot swap in an internal one; redirects are never followed.
`OUTBOUND_ALLOW_PRIVATE` lifts the address check for local development only."""

import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit

from django.conf import settings


class UnsafeURL(ValueError):
    pass


def public_address(host: str, port: int) -> str:
    """Resolve `host` and return one address, refusing loopback, private, link-local, etc."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeURL(f"{host} does not resolve") from exc
    addresses = sorted({str(info[4][0]) for info in infos})
    if not settings.OUTBOUND_ALLOW_PRIVATE:
        for address in addresses:
            ip = ipaddress.ip_address(address)
            mapped = getattr(ip, "ipv4_mapped", None)
            if not (mapped or ip).is_global:
                raise UnsafeURL(f"{host} resolves to a non-public address")
    return addresses[0]


class _PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, host: str, port: int, address: str, timeout: float) -> None:
        super().__init__(host, port, timeout=timeout)
        self._address = address

    def connect(self) -> None:
        self.sock = socket.create_connection((self._address, self.port), self.timeout)


class _PinnedHTTPS(_PinnedHTTP):
    default_port = 443

    def connect(self) -> None:
        super().connect()
        context = ssl.create_default_context()
        self.sock = context.wrap_socket(self.sock, server_hostname=self.host)


def post(url: str, body: bytes, headers: dict[str, str], timeout: float = 10) -> int:
    """POST `body` to `url` and return the HTTP status (3xx is returned, not followed)."""
    parts = urlsplit(url)
    if parts.scheme not in ("https", "http") or not parts.hostname:
        raise UnsafeURL("Only http(s) URLs are allowed")
    if parts.scheme == "http" and settings.ENVIRONMENT == "production":
        raise UnsafeURL("Use an https:// address")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    address = public_address(parts.hostname, port)
    cls = _PinnedHTTPS if parts.scheme == "https" else _PinnedHTTP
    conn = cls(parts.hostname, port, address, timeout)
    path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
    try:
        conn.request("POST", path, body=body, headers=headers)
        return conn.getresponse().status
    finally:
        conn.close()

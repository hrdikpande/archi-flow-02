"""F-40, I-11: local sign-in with TOTP for admins, SSO restricted to firm domains, API tokens."""

from datetime import timedelta
from types import SimpleNamespace

import pyotp
import pytest
from allauth.mfa.totp.internal.auth import TOTP
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.adapters import SocialAccountAdapter, email_domain_allowed
from apps.accounts.models import ApiToken, User
from apps.accounts.roles import OrgRole
from apps.accounts.services import create_api_token

LOGIN = "/_allauth/browser/v1/auth/login"
MFA = "/_allauth/browser/v1/auth/2fa/authenticate"
SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"


def _browser() -> APIClient:
    client = APIClient(enforce_csrf_checks=False)
    client.get("/api/v1/auth/csrf")
    return client


def test_admin_with_totp_needs_second_step(admin) -> None:
    TOTP.activate(admin, SECRET)
    client = _browser()
    first = client.post(LOGIN, {"email": admin.email, "password": "a-strong-password-123"})
    assert first.status_code == 401
    flows = {f["id"]: f for f in first.json()["data"]["flows"]}
    assert flows["mfa_authenticate"].get("is_pending") is True
    assert client.get("/api/v1/me").status_code in (401, 403)

    second = client.post(MFA, {"code": pyotp.TOTP(SECRET).now()})
    assert second.status_code == 200
    me = client.get("/api/v1/me").json()
    assert me["email"] == admin.email
    assert me["mfa"] == {"totp_enabled": True, "setup_required": False}


def test_admin_without_totp_must_set_it_up_before_anything_else(admin) -> None:
    client = _browser()
    assert (
        client.post(LOGIN, {"email": admin.email, "password": "a-strong-password-123"}).status_code
        == 200
    )
    me = client.get("/api/v1/me").json()
    assert me["mfa"]["setup_required"] is True
    blocked = client.get("/api/v1/disciplines")
    assert blocked.status_code == 403
    TOTP.activate(admin, SECRET)
    assert client.get("/api/v1/disciplines").status_code == 200


def test_staff_password_login_needs_no_totp(make_user) -> None:
    user = make_user(OrgRole.STAFF)
    client = _browser()
    assert (
        client.post(LOGIN, {"email": user.email, "password": "a-strong-password-123"}).status_code
        == 200
    )
    assert client.get("/api/v1/me").json()["mfa"]["setup_required"] is False


def test_wrong_password_is_rejected(admin) -> None:
    response = _browser().post(LOGIN, {"email": admin.email, "password": "nope-nope-nope"})
    assert response.status_code == 400


def test_local_self_signup_is_closed(db) -> None:
    response = _browser().post(
        "/_allauth/browser/v1/auth/signup", {"email": "x@firm.example", "password": "p-a-s-s-1234!"}
    )
    assert response.status_code == 403
    assert not User.objects.filter(email="x@firm.example").exists()


@pytest.mark.parametrize(
    ("email", "allowed"),
    [
        ("priya@firm.example", True),
        ("PRIYA@FIRM.EXAMPLE", True),
        ("x@gmail.com", False),
        ("", False),
    ],
)
def test_sso_signup_limited_to_firm_domains(email: str, allowed: bool) -> None:
    assert email_domain_allowed(email) is allowed


def test_sso_user_joins_the_org_as_staff_with_no_projects(org, rf) -> None:
    user = User(email="Priya@Firm.Example")
    sociallogin = SimpleNamespace(user=user, account=SimpleNamespace(provider="google"))
    adapter = SocialAccountAdapter()
    adapter.populate_user.__func__  # noqa: B018 (exists)
    # populate_user calls the base implementation which reads `data`; give it the claims.
    populated = SocialAccountAdapter.populate_user(
        adapter, rf.get("/"), sociallogin, {"email": "Priya@Firm.Example", "name": "Priya Sharma"}
    )
    assert populated.organisation == org
    assert populated.org_role == OrgRole.STAFF
    assert populated.full_name == "Priya Sharma"
    assert populated.email == "priya@firm.example"


class TestApiTokens:
    def test_plaintext_shown_once_and_hashed_at_rest(self, admin, admin_client) -> None:
        response = admin_client.post(
            "/api/v1/api-tokens",
            {"name": "Revit add-in", "user": str(admin.pk), "scopes": ["cad_sync:write"]},
        )
        assert response.status_code == 201
        plaintext = response.json()["token"]
        token = ApiToken.objects.get()
        assert plaintext.startswith(f"dop_{token.key_id}_")
        assert plaintext.split("_", 2)[2] not in token.secret_hash
        listed = admin_client.get("/api/v1/api-tokens").json()["results"][0]
        assert "token" not in listed

    def test_token_reaches_only_opted_in_endpoints(self, admin) -> None:
        _, plaintext = create_api_token(admin, user=admin, name="t", scopes=["cad_sync:write"])
        client = APIClient(HTTP_AUTHORIZATION=f"Bearer {plaintext}")
        assert client.get("/api/v1/me").status_code == 200
        assert client.get("/api/v1/disciplines").status_code == 403

    def test_revoked_and_expired_tokens_fail(self, admin) -> None:
        token, plaintext = create_api_token(admin, user=admin, name="t", scopes=["cad_sync:write"])
        client = APIClient(HTTP_AUTHORIZATION=f"Bearer {plaintext}")
        ApiToken.objects.filter(pk=token.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        assert client.get("/api/v1/me").status_code == 401
        ApiToken.objects.filter(pk=token.pk).update(
            expires_at=timezone.now() + timedelta(days=1), revoked_at=timezone.now()
        )
        assert client.get("/api/v1/me").status_code == 401

    @pytest.mark.parametrize("header", ["Bearer nonsense", "Bearer dop_unknown_secret"])
    def test_malformed_or_unknown_tokens_fail(self, admin, header: str) -> None:
        assert APIClient(HTTP_AUTHORIZATION=header).get("/api/v1/me").status_code == 401

    def test_revoke_endpoint(self, admin, admin_client) -> None:
        token, _ = create_api_token(admin, user=admin, name="t", scopes=["accounting:read"])
        response = admin_client.post(f"/api/v1/api-tokens/{token.pk}/revoke")
        assert response.json()["is_usable"] is False


class TestLoginRateLimitsUseTheRealClient:
    """allauth limits by the client our proxies saw, not the proxy address every user shares
    (DD-038). With one trusted proxy the client is the last X-Forwarded-For entry."""

    @pytest.fixture(autouse=True)
    def _clean_cache(self):
        from django.core.cache import cache

        cache.clear()
        yield
        cache.clear()

    def _fail(self, ip: str, n: int, *, forwarded: str | None = None) -> list[str]:
        codes = []
        for i in range(n):
            client = _browser()
            response = client.post(
                LOGIN,
                {"email": f"nobody{i}@{ip}.example", "password": "wrong-password-1"},
                HTTP_X_FORWARDED_FOR=forwarded or ip,
            )
            codes.append(response.json()["errors"][0]["code"])
        return codes

    def test_one_office_failing_does_not_lock_out_another(self, db) -> None:
        assert self._fail("203.0.113.7", 21)[-1] == "too_many_login_attempts"
        assert self._fail("198.51.100.9", 1) == ["email_password_mismatch"]

    def test_forged_leading_entries_are_ignored(self, db) -> None:
        self._fail("203.0.113.7", 20)
        # The attacker prepends a fresh address; the proxy-appended one still counts.
        codes = self._fail("x", 1, forwarded="192.0.2.55, 203.0.113.7")
        assert codes == ["too_many_login_attempts"]

    def test_a_client_cannot_set_the_resolved_ip_header(self, db) -> None:
        self._fail("203.0.113.7", 20)
        response = _browser().post(
            LOGIN,
            {"email": "nobody@x.example", "password": "wrong-password-1"},
            HTTP_X_FORWARDED_FOR="203.0.113.7",
            HTTP_X_DRAWINGOPS_CLIENT_IP="192.0.2.99",
        )
        assert response.json()["errors"][0]["code"] == "too_many_login_attempts"

"""Users with an organisation role (03 §1) and API tokens for plugins and integrations (02 §11)."""

import hashlib
import secrets
import uuid
from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.core.models import Organisation, OrgScopedModel

from .roles import OrgRole


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra: Any) -> "User":
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra: Any) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("org_role", OrgRole.ADMIN)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    organisation = models.ForeignKey(
        "core.Organisation", on_delete=models.PROTECT, null=True, related_name="users"
    )
    org_role = models.CharField(max_length=16, choices=OrgRole.choices, default=OrgRole.STAFF)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False, help_text="Can open the Django support admin.")
    can_lead_projects = models.BooleanField(
        default=False, help_text="May create projects and lead them (03 §5 'PL-eligible staff')."
    )
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        db_table = "user"
        ordering = ["full_name", "email"]

    def __str__(self) -> str:
        return self.full_name or self.email

    @property
    def org(self) -> "Organisation":
        """The user's organisation; every signed-in API user has one (IsActiveOrgMember)."""
        if self.organisation is None:
            raise PermissionError("User has no organisation")
        return self.organisation

    @property
    def org_pk(self) -> uuid.UUID:
        return self.org.pk

    @property
    def short_name(self) -> str:
        """First name + last initial, as tables show people (DESIGN.md §7)."""
        parts = self.full_name.split()
        if len(parts) >= 2:
            return f"{parts[0]} {parts[-1][0]}"
        return self.full_name or self.email.split("@")[0]


class ApiTokenScope(models.TextChoices):
    CAD_SYNC_WRITE = "cad_sync:write", "CAD sync (write)"
    ACCOUNTING_READ = "accounting:read", "Accounting (read)"
    ACCOUNTING_WRITE = "accounting:write", "Accounting (mark invoiced)"
    FILE_EVENTS_WRITE = "file_events:write", "Storage connector (CAD file activity)"


TOKEN_PREFIX = "dop"  # noqa: S105 (public prefix, not a secret)


def hash_token_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


class ApiToken(OrgScopedModel):
    """Hashed at rest, scoped, expiring, revocable. Plaintext is shown once at creation."""

    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="api_tokens")
    name = models.CharField(max_length=100)
    key_id = models.CharField(max_length=16, unique=True, editable=False)
    secret_hash = models.CharField(max_length=64, editable=False)
    scopes = ArrayField(
        models.CharField(max_length=40, choices=ApiTokenScope.choices), default=list
    )
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "api_token"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({TOKEN_PREFIX}_{self.key_id}_…)"

    @staticmethod
    def generate() -> tuple[str, str, str]:
        """Returns (key_id, secret, plaintext token)."""
        key_id = secrets.token_hex(6)
        secret = secrets.token_urlsafe(32)
        return key_id, secret, f"{TOKEN_PREFIX}_{key_id}_{secret}"

    @property
    def is_usable(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now()

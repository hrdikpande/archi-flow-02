import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import User
from apps.accounts.roles import OrgRole
from apps.core.models import Discipline, Organisation


@pytest.mark.django_db
def test_bootstrap_is_idempotent_and_prints_password_once() -> None:
    out = io.StringIO()
    call_command("bootstrap_org", name="Firm", admin_email="IT@firm.example", stdout=out)
    assert "Password (shown once)" in out.getvalue()
    admin = User.objects.get(email="it@firm.example")
    assert admin.org_role == OrgRole.ADMIN
    assert Discipline.objects.count() == 9
    again = io.StringIO()
    call_command("bootstrap_org", name="Firm", admin_email="it@firm.example", stdout=again)
    assert "already exists" in again.getvalue()
    assert Organisation.objects.count() == 1
    with pytest.raises(CommandError):
        call_command("bootstrap_org", name="Other Firm", admin_email="x@firm.example")


@pytest.mark.django_db
def test_seed_e2e_refuses_production(settings) -> None:
    settings.ENVIRONMENT = "production"
    with pytest.raises(CommandError):
        call_command("seed_e2e")

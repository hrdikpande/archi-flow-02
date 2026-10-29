"""Create the firm's organisation, default settings and disciplines, and a local admin.

    manage.py bootstrap_org --name "Firm Name" --admin-email it@firm.example

The admin gets a random password printed once and must set up TOTP at first sign-in.
"""

import secrets
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.roles import OrgRole
from apps.core.models import Organisation
from apps.core.setup import ensure_org_defaults


class Command(BaseCommand):
    help = "Create the organisation, its settings and first admin (idempotent)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--name", required=True)
        parser.add_argument("--admin-email", required=True)
        parser.add_argument("--admin-name", default="System admin")
        parser.add_argument("--password", default=None, help="Defaults to a random one.")

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        org = Organisation.objects.order_by("created_at").first()
        if org is None:
            org = Organisation.objects.create(name=opts["name"])
            self.stdout.write(f"Created organisation {org.name}")
        elif org.name != opts["name"]:
            raise CommandError(f"An organisation already exists: {org.name}")
        ensure_org_defaults(org)
        email = opts["admin_email"].lower()
        if User.objects.filter(email=email).exists():
            self.stdout.write(f"Admin {email} already exists")
            return
        password = opts["password"] or secrets.token_urlsafe(18)
        User.objects.create_user(
            email,
            password,
            full_name=opts["admin_name"],
            organisation=org,
            org_role=OrgRole.ADMIN,
        )
        self.stdout.write(self.style.SUCCESS(f"Created admin {email}"))
        if not opts["password"]:
            self.stdout.write(f"Password (shown once): {password}")

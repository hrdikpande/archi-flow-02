"""Fixed users for Playwright. Refuses to run in production or staging."""

from typing import Any

from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import TOTP
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.models import Organisation
from apps.core.setup import ensure_org_defaults
from apps.projects.models import Project, ProjectMembership, Stage, StageTemplate

E2E_PASSWORD = "e2e-Password-123!"  # noqa: S105 (refuses to run in staging/production)
# Base32 secret used only by the e2e suite (frontend/e2e/support.ts).
E2E_ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"  # noqa: S105


class Command(BaseCommand):
    help = "Seed deterministic users for end-to-end tests (development and test only)."

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        if settings.ENVIRONMENT in {"production", "staging"}:
            raise CommandError("seed_e2e must never run in production or staging.")
        if not Organisation.objects.exists():
            call_command(
                "bootstrap_org",
                name="Demo Design Studio",
                admin_email="admin@firm.example",
                admin_name="Asha Admin",
                password=E2E_PASSWORD,
            )
        org = Organisation.objects.order_by("created_at").first()
        if org is None:
            raise CommandError("bootstrap_org did not create an organisation.")
        ensure_org_defaults(org)
        admin = User.objects.get(email="admin@firm.example")
        if not Authenticator.objects.filter(user=admin, type=Authenticator.Type.TOTP).exists():
            TOTP.activate(admin, E2E_ADMIN_TOTP_SECRET)
        people = [
            ("owner@firm.example", "Nikhil Prasad", OrgRole.OWNER, None),
            ("lead@firm.example", "Priya Sharma", OrgRole.STAFF, ProjectRole.PL),
            ("designer@firm.example", "Rahul Kumar", OrgRole.STAFF, ProjectRole.DESIGNER),
            ("checker@firm.example", "Anil Kapoor", OrgRole.STAFF, ProjectRole.DL),
            ("senior@firm.example", "Sunita Rao", OrgRole.STAFF, ProjectRole.SENIOR_REVIEWER),
            ("dc@firm.example", "Deepa Chandra", OrgRole.STAFF, ProjectRole.DC),
            ("accounts@firm.example", "Meera Thomas", OrgRole.ACCOUNTS, None),
        ]
        project, _ = Project.objects.get_or_create(
            organisation=org, code="2026-014", defaults={"name": "HSR Block B"}
        )
        for email, name, role, project_role in people:
            user = User.objects.filter(email=email).first() or User.objects.create_user(
                email, E2E_PASSWORD, full_name=name, organisation=org, org_role=role
            )
            if email == "lead@firm.example" and not user.can_lead_projects:
                user.can_lead_projects = True
                user.save(update_fields=["can_lead_projects"])
            if project_role:
                ProjectMembership.objects.get_or_create(
                    organisation=org, project=project, user=user, defaults={"role": project_role}
                )
        if not project.stages.exists():
            template = StageTemplate.objects.filter(organisation=org, is_default=True).first()
            for item in template.items.all() if template else []:
                Stage.objects.create(
                    organisation=org,
                    project=project,
                    seq=item.seq,
                    name=item.name,
                    fee_pct=item.fee_pct,
                )
        self.stdout.write(self.style.SUCCESS("e2e seed ready"))

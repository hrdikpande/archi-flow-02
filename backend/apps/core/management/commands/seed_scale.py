"""Synthetic data for the load test (N-01) and capacity check (N-09). Development only.

Creates a separate organisation "Scale Test Firm" so the e2e organisation is untouched:
  python manage.py seed_scale          # N-01: 200 users, 60 projects, one 1,000-sheet register
  python manage.py seed_scale --projects 100 --sheets 1000 --revisions 5
                                       # N-09: 100k sheets, 500k revisions
Bulk inserts, no audit rows or events (this is test data, not history).
"""

import random
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.automation.models import Flag, FlagKind
from apps.core.models import Discipline, Organisation
from apps.core.setup import ensure_org_defaults
from apps.projects.models import Project, ProjectMembership, Stage, StageState
from apps.register.models import RevisionState, Sheet, SheetRevision, SheetState

PASSWORD = "scale-Password-123!"  # noqa: S105 (refuses to run in staging/production)
ORG_NAME = "Scale Test Firm"
TITLES = [
    "Ground Floor Plan",
    "OT Ductwork",
    "Lighting Layout",
    "Plumbing Riser",
    "Section A-A",
    "Fire Alarm Layout",
    "Reflected Ceiling Plan",
    "Elevation North",
    "Chilled Water Schematic",
]


class Command(BaseCommand):
    help = "Seed a large synthetic firm for load and capacity tests (development only)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--users", type=int, default=200)
        parser.add_argument("--projects", type=int, default=60)
        parser.add_argument("--sheets", type=int, default=120, help="sheets per project")
        parser.add_argument("--big-register", type=int, default=1000, help="sheets on project 1")
        parser.add_argument("--revisions", type=int, default=2, help="issued revisions per sheet")

    def handle(self, *args: Any, **o: Any) -> None:
        if settings.ENVIRONMENT in {"production", "staging"}:
            raise CommandError("seed_scale must never run in production or staging.")
        if Organisation.objects.filter(name=ORG_NAME).exists():
            raise CommandError(f"{ORG_NAME} already exists; drop the database volume to reseed.")
        rng = random.Random(42)  # noqa: S311 - reproducible test data, not security
        with transaction.atomic():
            org = Organisation.objects.create(name=ORG_NAME)
            ensure_org_defaults(org)
            users = self._users(org, o["users"])
        disciplines = list(Discipline.objects.filter(organisation=org))
        today = timezone.localdate()
        for p in range(o["projects"]):
            with transaction.atomic():
                self._project(
                    org,
                    p,
                    users,
                    disciplines,
                    rng,
                    today,
                    o["big_register"] if p == 0 else o["sheets"],
                    o["revisions"],
                )
            if p % 10 == 0:
                self.stdout.write(f"  project {p + 1}/{o['projects']}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{ORG_NAME}: {User.objects.filter(organisation=org).count()} users, "
                f"{Project.objects.filter(organisation=org).count()} projects, "
                f"{Sheet.objects.filter(organisation=org).count()} sheets, "
                f"{SheetRevision.objects.filter(organisation=org).count()} revisions. "
                f"Sign in as scale-user-0@scale.example … with {PASSWORD}"
            )
        )

    def _users(self, org: Organisation, n: int) -> list[User]:
        users = [
            User(
                email=f"scale-user-{i}@scale.example",
                full_name=f"Scale User {i}",
                organisation=org,
                org_role=OrgRole.OWNER if i == 0 else OrgRole.STAFF,
            )
            for i in range(n)
        ]
        probe = User()
        probe.set_password(PASSWORD)  # hash once; every scale user shares the test password
        for u in users:
            u.password = probe.password
        return User.objects.bulk_create(users)

    def _project(
        self,
        org: Organisation,
        p: int,
        users: list[User],
        disciplines: list[Discipline],
        rng: random.Random,
        today: date,
        n_sheets: int,
        n_revs: int,
    ) -> None:
        project = Project.objects.create(
            organisation=org, code=f"S{p:03d}", name=f"Scale project {p}"
        )
        stages = Stage.objects.bulk_create(
            [
                Stage(
                    organisation=org,
                    project=project,
                    seq=i + 1,
                    name=f"Stage {i + 1}",
                    state=StageState.ACTIVE if i == 3 else StageState.PLANNED,
                )
                for i in range(6)
            ]
        )
        team = rng.sample(users[1:], k=min(12, len(users) - 1))
        roles = [ProjectRole.PL, ProjectRole.DL, ProjectRole.DL, ProjectRole.DC] + [
            ProjectRole.DESIGNER
        ] * 8
        ProjectMembership.objects.bulk_create(
            [
                ProjectMembership(organisation=org, project=project, user=u, role=r)
                for u, r in zip(team, roles, strict=False)
            ]
        )
        designers = team[4:] or team
        sheets = []
        for i in range(n_sheets):
            d = disciplines[i % len(disciplines)]
            planned = today + timedelta(days=rng.randint(-30, 90))
            state = rng.choice(
                [
                    SheetState.PLANNED,
                    SheetState.IN_PROGRESS,
                    SheetState.IN_CHECK,
                    SheetState.ISSUED,
                    SheetState.ISSUED,
                ]
            )
            sheets.append(
                Sheet(
                    organisation=org,
                    project=project,
                    stage=stages[3],
                    discipline=d,
                    number=f"{d.code}-{i + 100:03d}" if i < 900 else f"{d.code}-{i + 100}",
                    title=f"{rng.choice(TITLES)} L{i % 9}",
                    owner=rng.choice(designers),
                    checker=team[1],
                    planned_issue_date=planned,
                    state=state,
                    state_changed_at=timezone.now(),
                )
            )
        sheets = Sheet.objects.bulk_create(sheets, batch_size=2000)
        revisions = []
        for s in sheets:
            if s.state != SheetState.ISSUED:
                continue
            for r in range(n_revs):
                revisions.append(
                    SheetRevision(
                        organisation=org,
                        sheet=s,
                        code=f"C{r + 1:02d}",
                        seq=r + 1,
                        stage=s.stage,
                        purpose="GFC",
                        state=RevisionState.ISSUED if r == n_revs - 1 else RevisionState.SUPERSEDED,
                        issued_at=timezone.now() - timedelta(days=(n_revs - r) * 7),
                    )
                )
        SheetRevision.objects.bulk_create(revisions, batch_size=5000)
        with connection.cursor() as cursor:
            cursor.execute(
                """UPDATE sheet s SET current_revision_id = r.id FROM sheet_revision r
                   WHERE r.sheet_id = s.id AND r.state = 'issued' AND s.project_id = %s""",
                [project.pk],
            )
        Flag.objects.bulk_create(
            [
                Flag(
                    organisation=org,
                    entity_type="sheet",
                    entity_id=str(s.pk),
                    kind=FlagKind.LATE,
                    rule="A-02",
                    project=project,
                    sheet=s,
                    raised_at=timezone.now(),
                    data={"days": (today - s.planned_issue_date).days},
                )
                for s in sheets
                if s.state != SheetState.ISSUED
                and s.planned_issue_date
                and s.planned_issue_date < today
            ],
            batch_size=2000,
        )

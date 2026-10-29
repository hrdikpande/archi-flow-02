"""Run the P4 weekly job now: `--force` trains before gate G3 for evaluation (never production)."""

from typing import Any

from django.core.management.base import BaseCommand

from apps.core.models import Organisation
from apps.intelligence import services


class Command(BaseCommand):
    help = "Snapshot features and (after G3) train late-risk and workload models."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--force", action="store_true", help="Train even if G3 is not met (evaluation only)."
        )

    def handle(self, *args: Any, **opts: Any) -> None:
        for org in Organisation.objects.all():
            self.stdout.write(f"{org.name}: {services.weekly(org, force=opts['force'])}")

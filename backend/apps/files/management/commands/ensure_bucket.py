import time
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from django.core.management.base import BaseCommand, CommandError

from apps.files import storage


class Command(BaseCommand):
    help = "Create the object-storage bucket if it does not exist (dev and on-prem)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--wait", type=int, default=60, help="Seconds to wait for storage.")

    def handle(self, *args: Any, **opts: Any) -> None:
        deadline = time.monotonic() + opts["wait"]
        delay = 1.0
        while True:
            try:
                storage.ensure_bucket()
                break
            except (BotoCoreError, ClientError) as exc:
                if time.monotonic() >= deadline:
                    raise CommandError(f"Object storage is not reachable: {exc}") from exc
                self.stdout.write(f"Waiting for object storage ({exc.__class__.__name__})…")
                time.sleep(delay)
                delay = min(delay * 2, 8)
        self.stdout.write(self.style.SUCCESS("bucket ready"))

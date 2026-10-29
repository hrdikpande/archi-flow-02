"""Register event handlers."""

from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles

from .models import SheetRevision


@handles("revision.uploaded")
def run_naming_check(event: OutboxEvent) -> None:
    """A-04 on every PDF upload."""
    from .revisions import check_naming

    revision = (
        SheetRevision.objects.select_related("sheet__project")
        .filter(pk=event.payload["revision_id"])
        .first()
    )
    if revision is not None and revision.state == "draft":
        check_naming(revision)

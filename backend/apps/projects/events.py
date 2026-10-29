"""Stage roll-up (F-03, 03 §4): stages follow their sheets."""

from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles
from apps.register.models import RevisionState, Sheet, SheetState

from .models import Stage, StageState
from .services import system_transition_stage


@handles("sheet.state_changed")
def start_stage_with_first_sheet(event: OutboxEvent) -> None:
    """planned → active when the first sheet of the stage moves to in progress."""
    if event.payload.get("to") != SheetState.IN_PROGRESS:
        return
    sheet = Sheet.objects.filter(pk=event.payload["sheet_id"]).only("stage_id").first()
    if sheet is not None:
        stage = Stage.objects.get(pk=sheet.stage_id)
        if stage.state == StageState.PLANNED:
            system_transition_stage(stage, "start")


def deliverables_complete(stage: Stage) -> bool:
    """Every non-cancelled sheet of the stage has an issued revision with a required purpose."""
    sheets = Sheet.objects.filter(stage=stage).exclude(
        state__in=[SheetState.CANCELLED, SheetState.SUPERSEDED]
    )
    if not sheets.exists():
        return False
    required = stage.purposes_required
    missing = sheets.exclude(
        revisions__state__in=[RevisionState.ISSUED, RevisionState.SUPERSEDED],
        revisions__purpose__in=required,
        revisions__stage=stage,
    )
    return not missing.exists()


@handles("revision.issued")
def roll_up_on_issue(event: OutboxEvent) -> None:
    sheet = Sheet.objects.filter(pk=event.payload["sheet_id"]).select_related("stage").first()
    if sheet is None:
        return
    stage = sheet.stage
    if stage.state == StageState.PLANNED:
        system_transition_stage(stage, "start")
        stage.refresh_from_db()
    if stage.state == StageState.ACTIVE and deliverables_complete(stage):
        system_transition_stage(stage, "deliverables_issued")

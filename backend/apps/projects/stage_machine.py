"""Stage state transitions (03 §4). Automatic roll-ups (F-03, A-09) use the same table."""

from dataclasses import dataclass

from .models import StageState as S

PREVIOUS = "__previous__"


@dataclass(frozen=True)
class StageTransition:
    action: str
    sources: frozenset[str]
    target: str
    label: str
    manual: bool  # may a person trigger it (PL) or only the system


NON_TERMINAL = frozenset(set(S.values) - {S.CLOSED, S.ON_HOLD})

STAGE_TRANSITIONS: dict[str, StageTransition] = {
    t.action: t
    for t in [
        StageTransition("start", frozenset({S.PLANNED}), S.ACTIVE, "Start stage", True),
        StageTransition(
            "deliverables_issued", frozenset({S.ACTIVE}), S.DELIVERABLES_ISSUED, "", False
        ),
        StageTransition(
            "reopen_deliverables",
            frozenset({S.DELIVERABLES_ISSUED}),
            S.ACTIVE,
            "",
            False,
        ),
        # P1 had a manual "Mark client approved"; from P2 approval is recorded with evidence
        # (F-26, apps/comments.services.record_approval), which runs this transition (DD-031).
        StageTransition(
            "client_approved",
            frozenset({S.DELIVERABLES_ISSUED}),
            S.CLIENT_APPROVED,
            "Record client approval",
            False,
        ),
        StageTransition(
            "ready_to_invoice", frozenset({S.CLIENT_APPROVED}), S.READY_TO_INVOICE, "", False
        ),
        StageTransition(
            "invoiced", frozenset({S.READY_TO_INVOICE}), S.INVOICED, "Mark invoiced", False
        ),
        StageTransition("close", NON_TERMINAL | {S.ON_HOLD}, S.CLOSED, "Close stage", True),
        StageTransition("hold", NON_TERMINAL, S.ON_HOLD, "Put on hold", True),
        StageTransition("resume", frozenset({S.ON_HOLD}), PREVIOUS, "Resume", True),
    ]
}

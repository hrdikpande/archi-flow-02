"""The sheet state machine: ONE table of allowed transitions (02 §6, 03 §3, CLAUDE.md).

Sources follow 03 §3 ("allowed next states"). Roles follow 02 §6. `transition()` in
services.py is the only code that changes `Sheet.state`.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from apps.register.models import SheetState as S

PREVIOUS = "__previous__"  # restore Sheet.state_before_hold


class Actor(StrEnum):
    """Who someone is relative to a sheet."""

    OWNER = "owner_of_sheet"
    CHECKER = "checker"
    PL = "pl"
    DL = "dl"
    DC = "dc"
    SENIOR = "senior_reviewer"
    ADMIN = "admin"


@dataclass(frozen=True)
class Context:
    """What the caller supplied with the transition request."""

    reason: str = ""
    comment: str = ""
    redline_count: int = 0


Guard = Callable[[Any, Any, Context], str | None]  # (sheet, actor user, context) -> problem


def checker_assigned(sheet: Any, user: Any, ctx: Context) -> str | None:
    return None if sheet.checker_id else "Assign a checker before submitting."


def not_own_sheet(sheet: Any, user: Any, ctx: Context) -> str | None:
    return "You can't check your own sheet." if sheet.owner_id == user.pk else None


def comment_or_redline(sheet: Any, user: Any, ctx: Context) -> str | None:
    if ctx.comment.strip() or ctx.redline_count:
        return None
    return "Add a comment or a redline to return the sheet."


def reason_given(sheet: Any, user: Any, ctx: Context) -> str | None:
    return None if ctx.reason.strip() else "Give a reason."


@dataclass(frozen=True)
class Transition:
    action: str
    label: str
    sources: frozenset[str]
    target: str
    actors: frozenset[Actor]
    guards: tuple[Guard, ...] = ()
    needs_reason: bool = False
    system_only: bool = False  # reached only through another service (issue → transmittals)
    hint: str = ""
    primary: bool = False  # shown as the main button in the ActionBar
    order: int = 50
    extra: dict[str, Any] = field(default_factory=dict)


A = Actor
OWNER_DL_PL = frozenset({A.OWNER, A.DL, A.PL})

TRANSITIONS: dict[str, Transition] = {
    t.action: t
    for t in [
        Transition(
            "start",
            "Start",
            frozenset({S.PLANNED}),
            S.IN_PROGRESS,
            OWNER_DL_PL,
            primary=True,
            order=1,
        ),
        Transition(
            "submit",
            "Submit for check",
            frozenset({S.IN_PROGRESS}),
            S.READY_FOR_CHECK,
            OWNER_DL_PL,
            guards=(checker_assigned,),
            primary=True,
            order=2,
        ),
        # 03 §7: "PL can force any allowed transition with a reason" (withdraw is owner-only).
        Transition(
            "withdraw",
            "Withdraw from check",
            frozenset({S.READY_FOR_CHECK}),
            S.IN_PROGRESS,
            frozenset({A.OWNER, A.PL}),
            order=20,
        ),
        Transition(
            "start_check",
            "Start check",
            frozenset({S.READY_FOR_CHECK}),
            S.IN_CHECK,
            frozenset({A.CHECKER, A.PL}),
            guards=(not_own_sheet,),
            primary=True,
            order=3,
        ),
        Transition(
            "return",
            "Return with redlines",
            frozenset({S.IN_CHECK}),
            S.CHANGES_REQUESTED,
            frozenset({A.CHECKER, A.SENIOR, A.PL}),
            guards=(comment_or_redline,),
            order=5,
        ),
        Transition(
            "approve",
            "Approve",
            frozenset({S.IN_CHECK}),
            S.APPROVED_FOR_ISSUE,
            frozenset({A.CHECKER, A.SENIOR, A.PL}),
            guards=(not_own_sheet,),
            primary=True,
            order=4,
        ),
        Transition(
            "resume",
            "Resume work",
            frozenset({S.CHANGES_REQUESTED}),
            S.IN_PROGRESS,
            OWNER_DL_PL,
            primary=True,
            order=6,
        ),
        Transition(
            "reopen",
            "Reopen",
            frozenset({S.APPROVED_FOR_ISSUE}),
            S.IN_PROGRESS,
            OWNER_DL_PL,
            order=21,
            hint="Clears the approval; the sheet must be checked again.",
        ),
        Transition(
            "issue",
            "Issue",
            frozenset({S.APPROVED_FOR_ISSUE}),
            S.ISSUED,
            frozenset({A.DC, A.PL}),
            system_only=True,
            primary=True,
            order=7,
        ),
        Transition(
            "next_revision",
            "Start next revision",
            frozenset({S.ISSUED}),
            S.IN_PROGRESS,
            OWNER_DL_PL,
            order=8,
        ),
        Transition(
            "supersede_sheet",
            "Supersede sheet",
            frozenset({S.ISSUED}),
            S.SUPERSEDED,
            frozenset({A.PL}),
            needs_reason=True,
            order=30,
            hint="The sheet is replaced by another number or withdrawn.",
        ),
        Transition(
            "hold",
            "Hold",
            frozenset({S.PLANNED, S.IN_PROGRESS}),
            S.ON_HOLD,
            frozenset({A.PL}),
            order=31,
        ),
        Transition(
            "resume_hold",
            "Resume",
            frozenset({S.ON_HOLD}),
            PREVIOUS,
            frozenset({A.PL}),
            primary=True,
            order=9,
        ),
        Transition(
            "cancel",
            "Cancel",
            frozenset({S.PLANNED, S.IN_PROGRESS}),
            S.CANCELLED,
            frozenset({A.PL}),
            needs_reason=True,
            order=32,
        ),
        # 03 §3: superseded and cancelled are terminal; "Admin can reopen".
        Transition(
            "reopen_terminal",
            "Reopen",
            frozenset({S.SUPERSEDED, S.CANCELLED}),
            PREVIOUS,
            frozenset({A.ADMIN}),
            needs_reason=True,
            order=33,
        ),
    ]
}

# States from which a sheet keeps a "previous" state to return to.
REMEMBERS_PREVIOUS = {"hold", "cancel", "supersede_sheet"}

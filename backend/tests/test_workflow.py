"""F-10 state machine, F-11 reviews and redlines (docs/03 §3, §7; docs/02 §6)."""

import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.outbox.models import OutboxEvent
from apps.register.models import SheetState as S
from apps.workflow.models import Review, ReviewKind, ReviewState, StatusTransition
from apps.workflow.services import allowed_actions, transition
from apps.workflow.state_machine import TRANSITIONS

from .workflow_fixtures import draft_with_pdf, new_sheet, ready_upload_for


def _move(client: APIClient, sheet_id, action, **body):
    return client.post(
        f"/api/v1/sheets/{sheet_id}/transitions", {"action": action, **body}, format="json"
    )


def test_the_table_matches_docs_03_section_3() -> None:
    """Allowed next states per 03 §3, transcribed independently of the table."""
    spec = {
        S.PLANNED: {S.IN_PROGRESS, S.ON_HOLD, S.CANCELLED},
        S.IN_PROGRESS: {S.READY_FOR_CHECK, S.ON_HOLD, S.CANCELLED},
        S.READY_FOR_CHECK: {S.IN_CHECK, S.IN_PROGRESS},
        S.IN_CHECK: {S.CHANGES_REQUESTED, S.APPROVED_FOR_ISSUE},
        S.CHANGES_REQUESTED: {S.IN_PROGRESS},
        S.APPROVED_FOR_ISSUE: {S.ISSUED, S.IN_PROGRESS},
        S.ISSUED: {S.IN_PROGRESS, S.SUPERSEDED},
    }
    from_table: dict[str, set[str]] = {}
    for t in TRANSITIONS.values():
        if t.action in ("resume_hold", "reopen_terminal"):
            continue
        for source in t.sources:
            from_table.setdefault(source, set()).add(t.target)
    assert from_table == spec


def test_happy_path_with_one_click_actions(team, client_for) -> None:
    sheet = new_sheet(team)
    designer, checker = client_for(team.designer), client_for(team.checker)
    assert _move(designer, sheet.pk, "start").json()["state"] == "in_progress"
    assert _move(designer, sheet.pk, "submit").json()["state"] == "ready_for_check"
    assert _move(checker, sheet.pk, "start_check").json()["state"] == "in_check"
    returned = _move(checker, sheet.pk, "return", comment="Grid line C wrong")
    assert returned.json()["state"] == "changes_requested"
    assert _move(designer, sheet.pk, "resume").json()["state"] == "in_progress"
    _move(designer, sheet.pk, "submit")
    _move(checker, sheet.pk, "start_check")
    approved = _move(checker, sheet.pk, "approve").json()
    assert approved["state"] == "approved_for_issue"
    history = list(StatusTransition.objects.filter(sheet=sheet).order_by("created_at"))
    assert [h.action for h in history] == [
        "start",
        "submit",
        "start_check",
        "return",
        "resume",
        "submit",
        "start_check",
        "approve",
    ]
    assert history[0].role == "owner_of_sheet" and history[2].role == "checker"
    assert history[3].reason == "Grid line C wrong"
    assert AuditEvent.objects.filter(verb="sheet.approve").count() == 1
    events = OutboxEvent.objects.filter(name="sheet.state_changed")
    assert events.count() == 8


def test_disallowed_moves_return_409_with_allowed_list(team, client_for) -> None:
    sheet = new_sheet(team)
    response = _move(client_for(team.designer), sheet.pk, "approve")
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "transition_not_allowed"
    assert body["allowed_actions"] == ["start"]
    unknown = _move(client_for(team.designer), sheet.pk, "teleport")
    assert unknown.status_code == 409


def test_guards(team, client_for) -> None:
    sheet = new_sheet(team, checker=None)
    designer = client_for(team.designer)
    _move(designer, sheet.pk, "start")
    no_checker = _move(designer, sheet.pk, "submit")
    assert "Assign a checker" in no_checker.json()["detail"]
    type(sheet).objects.filter(pk=sheet.pk).update(checker=team.checker)
    _move(designer, sheet.pk, "submit")
    checker = client_for(team.checker)
    _move(checker, sheet.pk, "start_check")
    blank = _move(checker, sheet.pk, "return")
    assert "comment or a redline" in blank.json()["detail"]
    redline = ready_upload_for(team.checker, "redline.pdf", pages=3, kind="document")
    ok = _move(checker, sheet.pk, "return", redline_upload_ids=[str(redline.pk)])
    assert ok.json()["state"] == "changes_requested"
    review = Review.objects.get(sheet=sheet)
    assert review.state == ReviewState.RETURNED and review.redlines.count() == 1


def test_designer_cannot_check_own_sheet(team, client_for) -> None:
    sheet = new_sheet(team, owner=team.checker)
    client = client_for(team.checker)
    _move(client, sheet.pk, "start")
    _move(client, sheet.pk, "submit")
    response = _move(client, sheet.pk, "start_check")
    assert response.status_code == 409
    assert "own sheet" in response.json()["detail"]


def test_non_members_and_other_roles_are_refused(team, client_for) -> None:
    sheet = new_sheet(team)
    assert _move(client_for(team.outsider), sheet.pk, "start").status_code == 404
    assert _move(client_for(team.dc), sheet.pk, "start").status_code == 409
    assert _move(client_for(team.dl), sheet.pk, "start").status_code == 200


def test_issue_only_through_transmittals(team, client_for) -> None:
    sheet = new_sheet(team, state=S.APPROVED_FOR_ISSUE)
    response = _move(client_for(team.dc), sheet.pk, "issue")
    assert response.status_code == 409
    assert "transmittal" in response.json()["detail"]


def test_senior_qc_two_step(team, client_for) -> None:
    team.stage.requires_senior_qc = True
    team.stage.save()
    sheet = new_sheet(team)
    designer, checker, senior = (client_for(u) for u in (team.designer, team.checker, team.senior))
    _move(designer, sheet.pk, "start")
    _move(designer, sheet.pk, "submit")
    _move(checker, sheet.pk, "start_check")
    first = _move(checker, sheet.pk, "approve").json()
    assert first["state"] == "in_check"  # waits for the senior reviewer
    senior_review = Review.objects.get(sheet=sheet, kind=ReviewKind.SENIOR_QC)
    assert senior_review.reviewer == team.senior  # the only senior reviewer on the project
    again = _move(checker, sheet.pk, "approve")
    assert again.status_code == 409 and "senior QC" in again.json()["detail"]
    event = OutboxEvent.objects.filter(name="sheet.state_changed").latest("created_at")
    assert event.payload["senior_qc_needed"] is True
    queue = client_for(team.senior).get("/api/v1/reviews").json()
    assert [(i["kind"], i["sheet"]["number"]) for i in queue] == [("senior_qc", "A-101")]
    assert _move(senior, sheet.pk, "approve").json()["state"] == "approved_for_issue"


def test_hold_resume_cancel_and_admin_reopen(team, client_for, admin) -> None:
    sheet = new_sheet(team)
    pl = client_for(team.pl)
    _move(client_for(team.designer), sheet.pk, "start")
    assert _move(pl, sheet.pk, "hold").json()["state"] == "on_hold"
    assert _move(pl, sheet.pk, "resume_hold").json()["state"] == "in_progress"
    assert _move(pl, sheet.pk, "cancel").status_code == 409  # needs a reason
    assert _move(pl, sheet.pk, "cancel", reason="Dropped by client").json()["state"] == "cancelled"
    assert _move(pl, sheet.pk, "start").status_code == 409  # terminal
    reopened = _move(client_for(admin), sheet.pk, "reopen_terminal", reason="Back in scope")
    assert reopened.json()["state"] == "in_progress"


def test_pl_can_force_withdraw_with_reason(team, client_for) -> None:
    sheet = new_sheet(team)
    designer = client_for(team.designer)
    _move(designer, sheet.pk, "start")
    _move(designer, sheet.pk, "submit")
    pl = client_for(team.pl)
    assert _move(pl, sheet.pk, "withdraw").status_code == 409
    assert _move(pl, sheet.pk, "withdraw", reason="Wrong set").json()["state"] == "in_progress"


def test_allowed_actions_and_issue_blocker(team) -> None:
    sheet = new_sheet(team)
    assert [a.action for a in allowed_actions(sheet, team.designer)] == ["start"]
    assert {a.action for a in allowed_actions(sheet, team.pl)} == {"start", "hold", "cancel"}
    sheet.state = S.APPROVED_FOR_ISSUE
    sheet.save()
    issue = next(a for a in allowed_actions(sheet, team.dc) if a.action == "issue")
    assert issue.blocked_reason == "Upload PDF first."
    draft_with_pdf(team, sheet)
    issue = next(a for a in allowed_actions(sheet, team.dc) if a.action == "issue")
    assert issue.blocked_reason is None


def test_reopen_clears_approval(team, client_for) -> None:
    sheet = new_sheet(team)
    for actor, action in [
        (team.designer, "start"),
        (team.designer, "submit"),
        (team.checker, "start_check"),
        (team.checker, "approve"),
    ]:
        transition(sheet, action, actor)
    reopened = _move(client_for(team.designer), sheet.pk, "reopen").json()
    assert reopened["state"] == "in_progress"
    assert not Review.objects.filter(sheet=sheet, state=ReviewState.OPEN).exists()


@pytest.mark.parametrize("action", sorted(TRANSITIONS))
def test_every_action_has_label_and_known_actors(action: str) -> None:
    t = TRANSITIONS[action]
    assert t.label and t.actors and t.sources

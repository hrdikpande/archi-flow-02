"""Notification catalogue (03 §18) plus the team/naming/transmittal events from 03 §5–§8.

Mandatory events cannot be changed from their default; every other event can be set to
instant, digest or off per user (F-21). "off" stops email; the in-app centre still lists the
item (DD-021).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Event:
    key: str
    label: str
    default: str  # instant | digest
    mandatory: bool
    phase: str = "P1"


INSTANT, DIGEST, OFF = "instant", "digest", "off"
MODES = (INSTANT, DIGEST, OFF)

EVENTS: dict[str, Event] = {
    e.key: e
    for e in [
        Event("sheet_assigned", "Sheet assigned to you", INSTANT, True),
        Event("review_requested", "Sheet ready for your check", INSTANT, True),
        Event("sheet_returned", "Sheet returned with redlines", INSTANT, True),
        Event("sheet_approved", "Sheet approved for issue", DIGEST, False),
        Event("senior_qc_needed", "Senior QC needed", INSTANT, True),
        Event("sheet_at_risk", "Sheet at risk (A-01)", DIGEST, False),
        Event("sheet_late", "Sheet late or escalated (A-02)", INSTANT, False),
        Event("allocation_flag", "Over/under-allocated people (A-05)", DIGEST, False),
        Event("timesheet_missing", "Timesheet missing (A-06)", INSTANT, False),
        Event("weekly_owner_summary", "Weekly owner summary", INSTANT, False),
        # F-52: "exports over 5,000 rows run as a background job and email a link".
        Event("export_ready", "Your large export is ready", INSTANT, True),
        Event("project_member_added", "Added to a project team", INSTANT, False),
        Event("naming_blocked", "Uploaded PDF blocked by a naming rule (A-04)", INSTANT, False),
        Event("transmittal_sent", "Transmittal sent on your project", DIGEST, False),
        Event("sweep_missing", "A scheduled automation did not run", INSTANT, True),
        Event("review_overdue", "Review overdue (A-07)", INSTANT, False, "P2"),
        Event(
            "comment_assigned", "Client comment assigned or overdue (A-08)", INSTANT, False, "P2"
        ),
        Event("ready_to_invoice", "Stage ready to invoice (A-09)", INSTANT, True, "P2"),
        Event("rfi_due", "RFI due (A-10)", INSTANT, False, "P3"),
        Event(
            "ca_assigned", "RFI assigned or submittal waiting for your review", INSTANT, False, "P3"
        ),
        Event("transmittal_unacknowledged", "Transmittal not acknowledged", DIGEST, False, "P2"),
        Event("forecast_ready", "Monthly forecast report ready", DIGEST, False, "P4"),
    ]
}

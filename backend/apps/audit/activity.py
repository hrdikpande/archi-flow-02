"""Project activity feed (F-45): significant events, newest first, each linking to its object.

Built on the audit trail (F-39), which already records every state change with actor and time;
`project_id` and `discipline_id` are written with each row so the feed filters cheaply.
"""

from typing import Any

from django.db.models import Q, QuerySet

from apps.projects.models import Project

from .models import AuditEvent

# Event types offered as a filter (F-45: "filter by person, discipline and event type").
TYPES: dict[str, Q] = {
    "state": Q(entity_type="register.sheet")
    & ~Q(verb__in=["sheet.updated", "sheet.created", "sheet.deleted", "sheet.imported"]),
    "revision": Q(verb__startswith="revision.") | Q(verb="review.redlines_added"),
    "transmittal": Q(verb__startswith="transmittal."),
    "stage": Q(entity_type="projects.stage") & ~Q(verb__in=["stage.updated", "stage.created"]),
    "import": Q(verb__in=["import.committed", "import.undone"]),
    "team": Q(verb__startswith="project.member_"),
    "sheet": Q(verb__in=["sheet.created", "sheet.deleted"]),
}
SIGNIFICANT = Q()
for _q in TYPES.values():
    SIGNIFICANT |= _q

VERB_TEXT = {
    "sheet.start": "started",
    "sheet.submit": "submitted for check",
    "sheet.start_check": "started checking",
    "sheet.approve": "approved for issue",
    "sheet.return": "returned with comments",
    "sheet.issue": "issued",
    "sheet.supersede": "superseded",
    "sheet.hold": "put on hold",
    "sheet.resume": "resumed",
    "sheet.cancel": "cancelled",
    "sheet.withdraw": "withdrew",
    "sheet.reopen": "reopened",
    "sheet.created": "added sheet",
    "sheet.deleted": "deleted sheet",
    "revision.created": "uploaded a revision of",
    "revision.issued": "issued revision",
    "revision.superseded": "superseded revision",
    "review.redlines_added": "added redlines to",
    "transmittal.sent": "sent transmittal",
    "transmittal.resent": "resent",
    "import.committed": "imported",
    "import.undone": "undid the import",
    "project.member_added": "added to the team:",
    "project.member_removed": "removed from the team:",
    "project.member_updated": "changed the role of",
}


def type_of(event: AuditEvent) -> str:
    verb = event.verb
    if verb.startswith("import."):
        return "import"
    if verb.startswith("project.member_"):
        return "team"
    if verb.startswith("transmittal."):
        return "transmittal"
    if verb.startswith("revision.") or verb == "review.redlines_added":
        return "revision"
    if event.entity_type == "projects.stage":
        return "stage"
    if verb in ("sheet.created", "sheet.deleted"):
        return "sheet"
    if event.entity_type == "register.sheet":
        return "state"
    return "other"


def feed(
    project: Project, *, actor: Any = None, discipline: Any = None, kinds: list[str] | None = None
) -> QuerySet[AuditEvent]:
    qs = AuditEvent.objects.filter(project_id=project.pk).filter(SIGNIFICANT)
    if actor:
        qs = qs.filter(actor_id=actor)
    if discipline:
        qs = qs.filter(discipline_id=discipline)
    if kinds:
        chosen = Q()
        for k in kinds:
            if k in TYPES:
                chosen |= TYPES[k]
        qs = qs.filter(chosen)
    return qs.select_related("actor")


def describe(event: AuditEvent) -> str:
    who = event.actor.short_name if event.actor else "System"
    verb = event.verb
    if verb.startswith("stage."):
        state = (event.after or {}).get("state", "")
        return f"{who} moved stage {event.entity_label} to {state.replace('_', ' ')}"
    text = VERB_TEXT.get(verb, verb.split(".", 1)[-1].replace("_", " "))
    reason = (event.after or {}).get("reason")
    tail = f": “{reason}”" if reason else ""
    return f"{who} {text} {event.entity_label}{tail}".strip()


def links(project: Project, events: list[AuditEvent]) -> dict[str, str]:
    """Front-end path for each event's object (F-45: every event links to its object)."""
    from apps.register.models import SheetRevision
    from apps.transmittals.models import TransmittalRecipient
    from apps.workflow.models import Review

    base = f"/projects/{project.pk}"
    rev_ids = [e.entity_id for e in events if e.entity_type == "register.sheetrevision"]
    rev_sheet = {
        str(k): str(v)
        for k, v in SheetRevision.objects.filter(pk__in=rev_ids).values_list("pk", "sheet_id")
    }
    review_ids = [e.entity_id for e in events if e.entity_type == "workflow.review"]
    review_sheet = {
        str(k): str(v)
        for k, v in Review.objects.filter(pk__in=review_ids).values_list("pk", "sheet_id")
    }
    rec_ids = [e.entity_id for e in events if e.entity_type == "transmittals.transmittalrecipient"]
    rec_tr = {
        str(k): str(v)
        for k, v in TransmittalRecipient.objects.filter(pk__in=rec_ids).values_list(
            "pk", "transmittal_id"
        )
    }
    out: dict[str, str] = {}
    for e in events:
        t = e.entity_type
        if t == "register.sheet":
            out[str(e.pk)] = f"{base}/sheets/{e.entity_id}"
        elif t == "register.sheetrevision" and e.entity_id in rev_sheet:
            out[str(e.pk)] = f"{base}/sheets/{rev_sheet[e.entity_id]}"
        elif t == "workflow.review" and e.entity_id in review_sheet:
            out[str(e.pk)] = f"{base}/sheets/{review_sheet[e.entity_id]}"
        elif t == "transmittals.transmittal":
            out[str(e.pk)] = f"{base}/transmittals/{e.entity_id}"
        elif t == "transmittals.transmittalrecipient" and e.entity_id in rec_tr:
            out[str(e.pk)] = f"{base}/transmittals/{rec_tr[e.entity_id]}"
        elif t == "projects.stage":
            out[str(e.pk)] = f"{base}/stages"
        elif t == "register.importjob":
            out[str(e.pk)] = f"{base}/register"
        elif t == "projects.projectmembership":
            out[str(e.pk)] = f"{base}/team"
        else:
            out[str(e.pk)] = base
    return out

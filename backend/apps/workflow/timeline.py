"""Sheet activity (S-06 'Activity'): transitions, reviews, revisions, newest first (F-47)."""

from typing import Any

from apps.register.models import Sheet


def _name(user: Any) -> str:
    return user.short_name if user else "System"


def sheet_timeline(sheet: Sheet) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for t in sheet.transitions.select_related("actor"):
        entries.append(
            {
                "at": t.created_at,
                "kind": "transition",
                "actor": _name(t.actor),
                "text": f"{t.get_from_state_display()} → {t.get_to_state_display()}",
                "detail": t.reason,
            }
        )
    for r in sheet.reviews.select_related("reviewer").filter(closed_at__isnull=False):
        entries.append(
            {
                "at": r.closed_at,
                "kind": "review",
                "actor": _name(r.reviewer),
                "text": f"{r.get_kind_display()} {r.get_state_display().lower()}",
                "detail": r.comment,
            }
        )
    for rev in sheet.revisions.select_related("uploaded_by", "issued_by"):
        if rev.file_id:
            entries.append(
                {
                    "at": rev.created_at,
                    "kind": "revision",
                    "actor": _name(rev.uploaded_by),
                    "text": f"Uploaded {rev.code}",
                    "detail": rev.original_name,
                }
            )
        if rev.issued_at:
            entries.append(
                {
                    "at": rev.issued_at,
                    "kind": "issue",
                    "actor": _name(rev.issued_by),
                    "text": f"Issued {rev.code}",
                    "detail": rev.purpose,
                }
            )
        if rev.superseded_at:
            entries.append(
                {
                    "at": rev.superseded_at,
                    "kind": "superseded",
                    "actor": "",
                    "text": f"{rev.code} superseded",
                    "detail": "",
                }
            )
    return sorted(entries, key=lambda e: e["at"], reverse=True)

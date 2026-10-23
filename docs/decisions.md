# Decisions log

Decisions taken during design and build. Architecture-level decisions are ADR-001 to ADR-012 in `02-architecture.md` §15; owner decisions DEC-01 to DEC-10 are listed in `01-implementation-plan.md` §13. Add new entries at the top.

| Date | ID | Question | Decision | Reason | Decided by |
|---|---|---|---|---|---|
| 23-Oct-2026 | DD-003 | Feature number F-45 was unassigned | F-45 = project activity feed (DESIGN.md Activity tab), Phase 1 | Keeps IDs contiguous; the screen already needed it | LatentIQ (design) |
| 23-Oct-2026 | DD-002 | Revision state vs sheet state for "Superseded" | Revisions have draft/issued/superseded; a sheet is `superseded` only when replaced by another sheet number or withdrawn | Lets a sheet keep working on its next revision while the old issue is superseded | LatentIQ (design) |
| 23-Oct-2026 | DD-001 | Build on Paperless-ngx? | No; own Django app; Paperless-ngx sidecar decided in Phase 2 (I-13) | See `00-paperless-ngx-assessment.md` | LatentIQ (design) |

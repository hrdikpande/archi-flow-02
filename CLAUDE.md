# CLAUDE.md · DrawingOps

Drawing and deliverable control for an architecture/MEP design firm: sheet register, review states, transmittals, deadlines, workload, fee stages and dashboards, on top of AutoCAD/Revit. Built by LatentIQ.

## Specification (read before changing anything)

| Need | File |
|---|---|
| What to build, rules, acceptance criteria, permissions | `docs/03-features-and-functionality.md` |
| How it is built: stack, layout, data model, state machine, events, API | `docs/02-architecture.md` |
| Look, components, screens, accessibility | `DESIGN.md` |
| What each sprint delivers | `docs/05-build-phases.md` |
| Status of every item | `TRACKER.md` (and `tracker.csv`) |
| Prompts for building sprint by sprint | `BUILD_PROMPT.md` |
| Decisions taken during the build | `docs/decisions.md` |

## Rules

- Build only the current sprint's tracker items. No authoring, accounting or AI before Phase 4.
- Never copy code from OpenConstructionERP (AGPL-3.0) or Paperless-ngx (GPL-3.0). No GPL/AGPL dependencies.
- Business logic in `services.py`; thin views; side effects via outbox events; one sheet transition table.
- Scope every query by organisation and project membership. Enforce permissions server-side.
- Issued files are immutable; audit rows are insert-only; sweeps are idempotent.
- UI follows `DESIGN.md` tokens and components; status is colour + icon + word.
- No real email outside production. No secrets in the repo.
- Update `TRACKER.md` status and notes as you work; only humans mark "Done".

## Commands (to be created in S1)

```bash
make up          # docker compose up (web, worker, beat, postgres, valkey, minio, caddy, mail catcher)
make migrate     # django migrations
make test        # pytest + vitest
make e2e         # playwright against the compose stack
make lint        # ruff, mypy, eslint, tsc
make schema      # regenerate OpenAPI schema and TypeScript client
make licences    # fail on GPL/AGPL dependencies
```

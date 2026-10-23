# DrawingOps · build document set

DrawingOps (working name) is drawing-and-deliverable control software for an architecture and MEP design firm. It provides a sheet register, review states, transmittals, deadlines and alerts, workload and timesheets, fee stages, and dashboards, built on top of the firm's existing AutoCAD and Revit tools. This folder is the complete specification a team or coding agent needs to build it.

Prepared by LatentIQ on 23 Oct 2026, from the research document *Architecture Firm Drawing & Project Control – Lead Research*. Every feature, automation, dashboard and integration in that document is included here under the same IDs (F-01 to F-41, A-01 to A-10), plus the supporting features a complete product needs (F-42 to F-58).

## Read in this order

| # | File | What it answers |
|---|---|---|
| 00 | [`docs/00-paperless-ngx-assessment.md`](docs/00-paperless-ngx-assessment.md) | Can we build on Paperless-ngx? (No as the foundation; maybe as a sidecar archive later) |
| 01 | [`docs/01-implementation-plan.md`](docs/01-implementation-plan.md) | Outcome, scope, assumptions, team, timeline, rollout, gates, effort, decisions needed |
| 02 | [`docs/02-architecture.md`](docs/02-architecture.md) | Stack, code layout, data model, state machine, events, automation engine, files, search, security, API, deployment, ADRs |
| 03 | [`docs/03-features-and-functionality.md`](docs/03-features-and-functionality.md) | Every feature with rules, permissions and acceptance criteria; automations; dashboards; integrations; NFRs |
| 04 | [`DESIGN.md`](DESIGN.md) | Design tokens (contrast-checked), components, 23 screens, interaction, accessibility |
| 05 | [`docs/05-build-phases.md`](docs/05-build-phases.md) | Discovery, 19 sprints across 4 phases, pilot, gates |
| – | [`TRACKER.md`](TRACKER.md) · [`tracker.csv`](tracker.csv) | All 118 items (58 features, 10 automations, 5 dashboards, 13 integrations, 10 NFRs, 18 tasks, 4 gates) with phase, sprint, dependencies and status |
| – | [`BUILD_PROMPT.md`](BUILD_PROMPT.md) | Master prompt, sprint kickoff prompts and review prompt for a coding agent |
| – | [`CLAUDE.md`](CLAUDE.md) | Repo rules for coding agents |
| – | [`docs/decisions.md`](docs/decisions.md) | Running decisions log |

## Phase summary

| Phase | What ships | Gate |
|---|---|---|
| P0 Discovery (3 weeks) | Baseline metrics, confirmed problems, decisions, pilot choice | G0 |
| P1 Visibility (S1–S6 + 4-week pilot) | 35 features: register, review states, transmittals, supersede, alerts, workload, timesheets, dashboards, search | G1 |
| P2 Flow and billing (S7–S11) | Review queue and delegation, checklists, client comments and approvals, billing signal, CAD plugins, site view | G2 |
| P3 Construction stage (S12–S16) | RFIs, submittals, site reports, change orders, clash import, knowledge search | – |
| P4 Intelligence (S17–S19) | Late-risk and workload forecasts, exploratory AI drawing checks | G3 first |

## Status of the facts in these documents

- **Checked first-hand:** Paperless-ngx (cloned repo and its docs source), OpenConstructionERP (cloned repo), library licences and versions (PyPI and npm registries), colour contrast ratios (computed).
- **From the research document:** market and practice facts, many from search summaries; see that document's tags.
- **Assumptions:** listed as AS-01 to AS-15 in `01-implementation-plan.md` §3; confirm them in discovery.
- **Estimates:** durations, effort and sizing are estimates, marked [UNVERIFIED].

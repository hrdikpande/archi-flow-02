# DrawingOps · product overview

**What it is.** DrawingOps is drawing and deliverable control software for architecture and MEP (mechanical, electrical, plumbing) design firms. It gives the whole firm one live record of every drawing sheet it owes, from the day the sheet is planned to the day its fee stage is invoiced. It sits alongside the firm's existing AutoCAD and Revit tools; it does not author drawings.

**Built by** LatentIQ. **Source of this overview:** the interactive prototype in `demo/` (primary), `docs/01-implementation-plan.md`, `docs/03-features-and-functionality.md`, `DESIGN.md`, and the production code status in `docs/INTERNAL_IMPLEMENTATION_STATUS.md`.

## The outcome it is designed for

> The owner sees, without phone calls, which projects are at which stage, which sheets are late or about to be late, who is overloaded and what is waiting for review; site never works from a superseded drawing. (`docs/01-implementation-plan.md` §1)

The firm measures progress with four baseline metrics (D-05): late issue rate, average working days in check, hours logged against planned, and days from deliverables issued to invoice.

## Who uses it

| Role | Main job in DrawingOps |
|---|---|
| Owner / Principal | Portfolio dashboard, reports, billing signals, everyone's hours, audit trail |
| Project lead | Projects, fee stages, team, client approvals, issue, timesheet approval |
| Discipline lead | Plans sheets and dates, first check (review), allocates hours, approves timesheets |
| Designer | Moves own sheets through the workflow, uploads check prints, logs own hours |
| Senior reviewer | Senior QC (second check) on milestone stages, AI finding triage |
| Document controller | Issues drawings on numbered transmittals |
| Accounts | Receives ready-to-invoice signals, exports, records invoices |
| System admin | Firm settings, rules, users, integrations, onboarding, audit trail |
| External parties (client, consultant, contractor) | No account: secure transmittal links, acknowledgement, phone site view |

Details: [`role-permission-matrix.md`](role-permission-matrix.md).

## Core ideas

1. **A sheet exists from the day it is planned**, before any file. The register is the plan, not a file listing.
2. **One state machine for every sheet**: Planned → In progress → Ready for check → In check → Approved for issue → Issued, with Changes requested, On hold, Cancelled and Superseded. Every move is one click at the real event and is audited.
3. **Flags are computed, not set**: At risk (A-01), Late (A-02), Over/Under-allocated (A-05), Hours missing (A-06), Review overdue (A-07), Comment overdue (A-08), Ready to invoice (A-09), RFI due (A-10), all on the firm's working calendar.
4. **Issue supersedes automatically**: a numbered transmittal issues the new revision, supersedes older ones, emails secure links, and tells earlier recipients a newer revision exists (A-03).
5. **Fee stages move with their sheets**: Planned → Active → Deliverables issued → Client approved → Ready to invoice → Invoiced → Closed. The billing signal fires when every deliverable is issued and the client's approval is recorded.
6. **Every number opens the list behind it**, and every list exports (Excel, PDF, CSV).
7. **Intelligence is advisory**: late-risk and workload forecasts and AI drawing checks are labelled, never change data, need a human decision, and are gated on six months of the firm's own history.

## Modules

| Module | What it covers |
|---|---|
| Dashboards | My work (per role), Portfolio (owner), Project overview, Discipline dashboard |
| Projects and fee stages | Project record, stage plan from the appointment letter (100% rule), team, activity feed, full export |
| Drawing register | Register with filters, grouping, saved views, inline edit with undo, bulk actions, packages, export |
| Getting drawings in | Excel/CSV import wizard with preview and undo, PDF upload with name and title-block matching, naming checks, Revit/AutoCAD sync proposals, file-storage activity |
| Sheet page | PDF viewer, revisions with SUPERSEDED watermark, reviews, distribution ("who has which revision"), timeline, CAD link, notes, overrides |
| Workflow and review | Pre-check checklists, review queue with waiting time, return with comment/redlines, senior QC second step, delegation |
| Issue and transmittals | Issue composer (sheets, purpose, recipients, preview cover sheet), transmittal log and matrix, resend, correction transmittals |
| External | Secure transmittal page (download, ZIP, acknowledge), phone site view of the current set |
| Client comments and approvals | Comment log with sources, assignment, required response, inbound email capture and unknown-sender queue, decisions, stage approval with evidence |
| Billing signals | Ready-to-invoice list, CSV export, accounting webhook, mark invoiced, invoiced history |
| People | Workload heat map, allocations, staff directory with capacity and leave, weekly timesheets, approvals |
| Alerts and automation | Notification centre, preferences (instant/digest/off, mandatory locked, quiet hours), daily digest, ten automation rules, idempotent daily sweep, run log, weekly owner summary |
| Construction stage | RFIs, submittals with stamps, site visit reports with photos, change orders, BCF clash import |
| Search and knowledge | ⌘K/Ctrl+K command search, knowledge search across decisions, comments, RFIs and reviews, contacts |
| Reports | Baseline metrics (D-05) with PDF, hours by project and stage, utilisation (never ranked), review cycle, missing timesheets |
| Intelligence | Late-risk prediction, workload forecast, AI drawing-check findings queue, admin modes and gate G3 |
| Administration | Organisation, disciplines, stage templates, codes, naming rules (live tester), checklists, intelligence, calendar, automation, users and invitations, contacts, integrations and API tokens, onboarding, audit trail |
| Platform | SSO and TOTP, role-based access, audit trail, immutable issued files, exports, accessibility (WCAG 2.2 AA target), dark theme, keyboard shortcuts, Indian date and currency formats |

Full list: [`feature-inventory.md`](feature-inventory.md). Screens: [`route-inventory.md`](route-inventory.md). End-to-end flows: [`workflow-inventory.md`](workflow-inventory.md).

## The main business workflow

```text
Project created from appointment letter (PL)
  → sheets planned in the register / imported from Excel / synced from Revit and AutoCAD (PL, DL)
  → designer starts, drafts, uploads a check print, ticks the pre-check, submits (Designer)
  → checker returns with redlines or approves; senior QC as a second step where the stage needs it (DL, SR)
  → document controller issues approved sheets on a numbered transmittal; older revisions superseded (DC)
  → client downloads from a secure link and acknowledges; site sees only the current set (External)
  → stage deliverables issued + client approval recorded → Ready to invoice (PL → Accounts)
  → Accounts exports or pushes to accounting, then marks invoiced (Accounts)
  → owner sees it all on the portfolio and in the baseline report (Owner)
```

## Status of the software (honest summary)

- **The demo** (`demo/`) is a complete, clickable browser prototype of the intended product on fictional data. It enforces roles in the browser only and **simulates** outside systems: Microsoft/Google SSO, email delivery (a demo mailbox), inbound email, Revit/AutoCAD plugins, the file-storage watcher, the accounting webhook, and the machine-learning models (deterministic stand-ins labelled Forecast/Advisory).
- **The production code** (`backend/`, `frontend/`) implements most features end to end; every tracker item is still *In review* (none accepted), staging and production environments are blocked on owner decisions, and the integration edges (real SSO tenant, SMTP, plugins inside Revit/AutoCAD, storage watcher) are partial. Intelligence code exists but stays inert until gate G3 (six months of clean history). See `docs/INTERNAL_IMPLEMENTATION_STATUS.md`.
- **Out of scope by design**: drawing authoring, invoicing/GST/ledgers (they stay in the accounting tool), AI drawing checks before Phase 4.
- **Conditional / decision pending**: Autodesk Forma, Bluebeam Studio, WhatsApp Business API, Paperless-ngx archive.

The walkthrough video presents the intended product as demonstrated in the prototype and says on screen and in narration which parts are simulated. It does not claim a production deployment.

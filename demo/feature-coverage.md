# DrawingOps demo · feature coverage

Every item in `tracker.csv` (118 items: features, automations, dashboards, integrations, non-functional requirements, tasks and gates) mapped to where it lives in the demo and how it was verified. Production status is copied from `tracker.csv` as of 26-Oct-2026; the demo covers the intended product regardless of that status.

**Verification key.** *Tested (automated workflow)*: exercised end to end by `demo/qa/flows.cjs` or `demo/qa/flows2.cjs` with assertions (85 checks, all passing). *Tested (screen renders, no errors)*: opened by `demo/qa/smoke.cjs` with zero JavaScript errors and inspected in screenshots, without a dedicated assertion. *Not applicable*: process items, gates and infrastructure that a browser demo cannot show.

**Demo status key.** *Implemented in demo*: works on demo data with the documented rules. *Simulated*: the user experience is complete but the outside system (SSO, email, CAD plugins, ML models, webhooks) is imitated in the browser. *Partially simulated*: part real, part imitated (say which in the screen column).


## Discovery

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| P0-01 | Kickoff; stakeholder map (owner, champion, IT, accounts) | P0 | Not started | — | Not a product feature (discovery task) | Not applicable |
| P0-02 | Interviews: owner, 3 project leads, 3 discipline leads, document controller, accounts | P0 | Not started | — | Not a product feature (discovery task) | Not applicable |
| P0-03 | As-is process map per stage with pain evidence (H1-H7) | P0 | Not started | — | Not a product feature (discovery task) | Not applicable |
| P0-04 | Baseline metrics on >= 2 past projects (D-05 definitions) | P0 | Not started | Reports › Baseline metrics uses the D-05 definitions | Partially simulated | Tested (screen renders, no errors) |
| P0-05 | Inventory: CAD versions, file storage, email/SSO, accounting, timesheets | P0 | Not started | — | Not a product feature (discovery task) | Not applicable |
| P0-06 | Collect artefacts: appointment letter, live sheet register, naming rules, title block | P0 | Not started | Sample artefacts in assets/documents (appointment letter on a project, register, naming rules) | Partially simulated | Tested (screen renders, no errors) |
| P0-07 | Owner decisions DEC-01, DEC-02, DEC-04, DEC-05, DEC-06 | P0 | Not started | — | Not a product feature (owner decisions) | Not applicable |
| P0-08 | Name pilot projects and champions; sign P1 fixed scope and price | P0 | Not started | — | Not a product feature (pilot choice) | Not applicable |

## Gates

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| G0 | Discovery sign-off (01 §9) | P0 | Not started | — | Not a product feature (gate) | Not applicable |
| G1 | Pilot go/no-go (01 §9) | P1 | Not started | — | Not a product feature (gate) | Not applicable |
| G2 | Phase 2 review vs baseline (01 §9) | P2 | Not started | — | Not a product feature (gate) | Not applicable |
| G3 | >= 6 months clean history before Phase 4 (01 §9) | P4 | Not started | Admin › Intelligence shows the G3 gate and progress | Simulated | Tested (screen renders, no errors) |

## Engineering

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| T-01 | Repo scaffold, CI pipeline, Docker Compose dev environment | P1 | In review | — | Engineering task; the demo needs no build | Not applicable |
| T-02 | Design tokens and app shell (DESIGN.md §2-4) | P1 | In review | Whole demo: tokens copied from frontend/src/styles/tokens.css; app shell per DESIGN.md §3 | Implemented in demo | Tested (screen renders, no errors) |
| T-03 | Transactional outbox and event dispatcher (02 §7) | P1 | In review | Side effects (notifications, emails, audit) happen in the store's services, like the outbox | Simulated | Tested (automated workflow) |
| T-04 | OpenAPI schema and generated TypeScript client | P1 | In review | — | Engineering task (no API in the demo) | Not applicable |
| T-05 | Staging environment with auto-deploy from main | P1 | Blocked | — | Engineering task (staging) | Not applicable |
| T-06 | Production environment, backups, monitoring (02 §14) | P1 | Blocked | — | Engineering task (production) | Not applicable |
| T-07 | UAT with client champion | P1 | Not started | Demo walkthrough follows docs/uat-script.md (see README) | Implemented in demo | Tested (automated workflow) |
| T-08 | Pilot: data load, training, office hours, weekly usage review (01 §7-8) | P1 | Not started | — | Pilot activity | Not applicable |
| T-09 | Phase 4 data pipeline and feature store | P4 | In review | Admin › Intelligence (gate progress, model status) | Simulated | Tested (screen renders, no errors) |
| T-10 | Evaluation datasets and back-testing harness | P4 | In review | Admin › Intelligence (back-test precision vs A-01, MAPE per discipline) | Simulated | Tested (screen renders, no errors) |

## M01 Projects and stages

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-01 | Project record (client, type, location, team, CAD versions) | P1 | In review | Projects › New project; project header and Overview › Edit | Implemented in demo | Tested (automated workflow) |
| F-02 | Fee-stage template from appointment letter; editable % | P1 | In review | Project › Stages: template, editable %, 100% rule, appointment letter | Implemented in demo | Tested (automated workflow) |
| F-03 | Stage status and planned/actual dates with automatic roll-up | P1 | In review | Stages move with sheets (first start → Active; all issued → Deliverables issued) | Implemented in demo | Tested (automated workflow) |
| F-42 | Organisation settings: disciplines, templates, codes, calendar, rules, thresholds | P1 | In review | Admin: organisation, disciplines, templates, codes, naming rules, calendar, thresholds | Implemented in demo | Tested (automated workflow) |
| F-43 | Contacts and external organisations | P1 | In review | Contacts: add/edit, duplicate-email warning, kinds | Implemented in demo | Tested (screen renders, no errors) |
| F-49 | Packages with planned dates | P1 | In review | Packages: inline select, bulk move, new package; sheets inherit the package date | Implemented in demo | Tested (screen renders, no errors) |

## M02 Drawing register

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-04 | Sheet register: number, title, discipline, stage, package, owner, checker, planned date, state, revision, flags | P1 | In review | Project › Register (filters, search, sort, group, columns, saved views, pagination) | Implemented in demo | Tested (automated workflow) |
| F-05 | Import sheet list from Excel/CSV with mapping, preview, undo | P1 | In review | Register › Import Excel: upload, map, preview with row errors, commit, undo 24 h | Implemented in demo | Tested (automated workflow) |
| F-06 | Revision history with issued PDF per revision; one current | P1 | In review | Sheet page › Revisions; Upload PDF creates the next draft code | Implemented in demo | Tested (automated workflow) |
| F-07 | Automatic superseding of older revisions on issue | P1 | In review | Issue composer: earlier revisions superseded in the same step | Implemented in demo | Tested (automated workflow) |
| F-08 | Purpose and suitability code per issue | P1 | In review | Issue composer purpose (required); Admin › Revision and purpose codes | Implemented in demo | Tested (automated workflow) |
| F-09 | Sheet-list sync from Revit/AutoCAD plugins | P2 | In review | Project › CAD sync: proposals from Revit/AutoCAD, accept/reject, title mismatch | Simulated | Tested (automated workflow) |
| F-46 | Bulk actions in register | P1 | In review | Register bulk bar: owner, checker, shift ± working days, package, change state; skipped report | Implemented in demo | Tested (automated workflow) |
| F-47 | Sheet detail page with PDF viewer and timeline | P1 | In review | Sheet page: PDF viewer, revisions, reviews, activity, distribution | Implemented in demo | Tested (automated workflow) |
| F-48 | SUPERSEDED watermark on old-revision downloads | P1 | In review | Superseded downloads carry a SUPERSEDED watermark and date | Implemented in demo | Tested (automated workflow) |
| F-50 | Title-block reading for bulk PDF import | P2 | In review | Upload PDFs: unmatched files matched from the title-block text layer | Implemented in demo | Tested (automated workflow) |
| F-51 | Site view: mobile read-only current issued set | P2 | In review | Site view link (no login): current issued set only, 44 px targets | Implemented in demo | Tested (automated workflow) |
| F-54 | Onboarding of existing projects and historic revisions | P1 | In review | Admin › Onboarding: template workbook, PDFs, problems list, load silently | Implemented in demo | Tested (automated workflow) |

## M03 Workflow and review

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-10 | Sheet state machine with one-click transitions and audit | P1 | In review | Sheet action bar, My work buttons, Review queue; one transition table | Implemented in demo | Tested (automated workflow) |
| F-11 | Assign checker; redlines and comments on reviews | P1 | In review | Reviews › side-by-side panel: comment, redline files, return blocked without either | Implemented in demo | Tested (automated workflow) |
| F-12 | Review queue with waiting time; delegation | P2 | In review | Reviews: oldest first with working days; Set a delegate | Implemented in demo | Tested (automated workflow) |
| F-13 | Designer pre-check checklists | P2 | In review | Submit for check opens the pre-check checklist; Admin › Checklists | Implemented in demo | Tested (automated workflow) |

## M04 Issue and transmittals

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-14 | Transmittals: recipients, sheets, revisions, purpose, number, cover PDF, secure links | P1 | In review | Project › Transmittals › Issue sheets (S-07), detail, cover sheet PDF, secure link | Implemented in demo | Tested (automated workflow) |
| F-15 | Recipient acknowledgement of receipt | P2 | In review | External transmittal page: Acknowledge receipt; unacknowledged flag on PL overview | Implemented in demo | Tested (automated workflow) |

## M05 People and workload

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-16 | Staff directory: discipline, role, team, capacity, leave | P1 | In review | Workload › Staff directory: discipline, capacity, leave | Implemented in demo | Tested (automated workflow) |
| F-17 | Planned hours per person x project-stage x week | P1 | In review | Workload › Allocate; cell drawer with inline edit and copy forward | Implemented in demo | Tested (automated workflow) |
| F-18 | Weekly timesheets by project and stage; submit/approve; CSV import | P1 | In review | Timesheets: week grid, submit, lock, CSV import; Approvals | Implemented in demo | Tested (automated workflow) |
| F-19 | Over/under-allocation heat map | P1 | In review | Workload heat map: Over/Under with icon + word + number | Implemented in demo | Tested (automated workflow) |

## M06 Deadlines and alerts

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-20 | Daily at-risk and late rules on sheets | P1 | In review | Flags in register, sheet page, dashboards (A-01, A-02) | Implemented in demo | Tested (automated workflow) |
| F-21 | Notifications: in-app, email, digest, preferences | P1 | In review | Bell panel, preferences (instant/digest/off, mandatory locked, quiet hours), daily digest email | Implemented in demo | Tested (automated workflow) |
| A-01 | At risk: planned date within 7 working days, not started/in progress | P1 | In review | At-risk flag; threshold in Admin › Automation | Implemented in demo | Tested (automated workflow) |
| A-02 | Late: planned date passed, not issued; escalate after 3 working days | P1 | In review | Late flag with escalation note | Implemented in demo | Tested (automated workflow) |
| A-03 | On issue: supersede earlier revision, notify earlier recipients | P1 | In review | Issue supersedes and emails earlier recipients | Implemented in demo | Tested (automated workflow) |
| A-04 | On upload: block issue if sheet number/file name breaks rule | P1 | In review | Upload naming check blocks issue | Implemented in demo | Tested (automated workflow) |
| A-05 | Weekly: over (>110%) / under (<50%) allocation | P1 | In review | Heat map Over/Under thresholds | Implemented in demo | Tested (automated workflow) |
| A-06 | Weekly: timesheet missing reminder | P1 | In review | Hours missing flags, reminders, sweep | Implemented in demo | Tested (automated workflow) |
| A-07 | Daily: review open > 3 working days, escalate | P2 | In review | Overdue badge in Reviews; sweep escalates to delegate or DL | Implemented in demo | Tested (automated workflow) |
| A-08 | Daily: client comment unanswered > N days | P2 | In review | Overdue client comments; sweep reminder | Implemented in demo | Tested (automated workflow) |
| A-09 | Event: deliverables issued + client approval -> ready to invoice | P2 | In review | Approval + all issued → Ready to invoice | Implemented in demo | Tested (automated workflow) |
| A-10 | Daily: RFI due within 2 working days | P3 | In review | RFI due flags; sweep reminder | Implemented in demo | Tested (automated workflow) |

## M07 Dashboards and reports

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-22 | Owner portfolio dashboard (D-01) | P1 | In review | Portfolio (S-03): five metric cards, project table, discipline load, forecast | Implemented in demo | Tested (automated workflow) |
| F-23 | Project, discipline and My-work dashboards (D-02 to D-04) | P1 | In review | Project overview (D-02), Discipline dashboard (D-03), My work (D-04) | Implemented in demo | Tested (automated workflow) |
| F-44 | Global search | P1 | In review | ⌘K / Ctrl+K command palette across projects, sheets (incl. aliases), transmittals, contacts, comments, RFIs | Implemented in demo | Tested (automated workflow) |
| F-45 | Project activity feed | P1 | In review | Project › Activity: newest first, filters by person, type, discipline | Implemented in demo | Tested (screen renders, no errors) |
| F-52 | Exports to Excel/PDF | P1 | In review | Export menus (Excel .xlsx, PDF, CSV) on lists; > 5,000 rows run as a background job | Implemented in demo | Tested (automated workflow) |
| F-53 | Baseline metrics report (D-05) | P1 | In review | Reports › Baseline metrics: date range, four metrics, definitions, PDF | Implemented in demo | Tested (automated workflow) |
| D-01 | Portfolio dashboard (owner) | P1 | In review | Portfolio | Implemented in demo | Tested (automated workflow) |
| D-02 | Project dashboard (project lead) | P1 | In review | Project overview | Implemented in demo | Tested (screen renders, no errors) |
| D-03 | Discipline dashboard (discipline lead) | P1 | In review | Discipline dashboard | Implemented in demo | Tested (automated workflow) |
| D-04 | My work (designer) | P1 | In review | My work | Implemented in demo | Tested (automated workflow) |
| D-05 | Baseline metrics report | P1 | In review | Reports › Baseline metrics | Implemented in demo | Tested (automated workflow) |

## M08 Client comments

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-24 | Client comment log per sheet and stage | P2 | In review | Project › Comments: log, assign, respond, close (response required), reject | Implemented in demo | Tested (automated workflow) |
| F-25 | Capture client comments from forwarded email | P2 | In review | Comments › Simulate a forwarded email; unknown-sender review queue | Simulated | Tested (automated workflow) |
| F-26 | Client approval record per stage | P2 | In review | Stages › Record client approval with evidence file | Implemented in demo | Tested (automated workflow) |

## M09 Billing signal

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-27 | Stage-complete (ready to invoice) flag and accounts notification | P2 | In review | Ready to invoice flag, Accounts notification, Billing signals | Implemented in demo | Tested (automated workflow) |
| F-28 | Accounting export/API push; record invoiced | P2 | In review | Billing › Export CSV (configured columns), Push to accounting (simulated webhook), Mark invoiced | Partially simulated | Tested (automated workflow) |
| F-29 | Invoicing, GST, ledger | OOS | Out of scope | — | Out of scope by design (stays in the accounting tool); stated on the Billing page | Not applicable |

## M10 Construction admin

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-30 | RFI log | P3 | In review | Construction › RFIs: log, due flags, answer, start next revision | Implemented in demo | Tested (automated workflow) |
| F-31 | Submittal log and stamped review | P3 | In review | Construction › Submittals: review and stamp, stamped PDF download | Implemented in demo | Tested (automated workflow) |
| F-32 | Site visit reports with photos | P3 | In review | Construction › Site reports: phone form, photo compression ≤ 2 MB, EXIF removed, PDF | Implemented in demo | Tested (automated workflow) |
| F-33 | Change-order log | P3 | In review | Construction › Change orders: raise, approve (PL), revision cycle | Implemented in demo | Tested (automated workflow) |

## M11 Coordination

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-34 | Clash results import (BCF) as issues | P3 | In review | Construction › Clashes: BCF import, update by GUID, assignee/status | Implemented in demo | Tested (automated workflow) |

## M12 Quality

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-35 | Sheet-number and file-name checks on upload | P1 | In review | Naming rule check on upload; blocked issue with rule text and valid example | Implemented in demo | Tested (automated workflow) |
| F-36 | AI checks drawings for errors (P1-P3) | OOS | Out of scope | — | Out of scope in P1–P3 (see F-57) | Not applicable |
| F-37 | Drawing authoring | OOS | Out of scope | — | Out of scope (never built) | Not applicable |
| F-58 | Project knowledge base across decisions, comments, RFIs | P3 | In review | Knowledge search; Project › Decisions | Implemented in demo | Tested (automated workflow) |

## M13 Platform

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-38 | Role-based access per project | P1 | In review | Navigation, pages and actions change by org role and project role | Implemented in demo (client-side only) | Tested (automated workflow) |
| F-39 | Audit trail of every change | P1 | In review | Admin › Audit trail: actor, time, before/after, IP, request ID; export | Implemented in demo | Tested (automated workflow) |
| F-40 | SSO (Google/Microsoft) + local accounts with TOTP | P1 | In review | Sign in: Microsoft SSO picker, email + password, TOTP for admin | Simulated | Tested (automated workflow) |
| F-41 | Issued PDFs in object storage; CAD files linked | P1 | In review | Sheet page CAD link (copy path); PDFs generated or held in the browser | Simulated | Tested (screen renders, no errors) |
| N-01 | Performance targets (p95 API < 300 ms; register < 1 s; dashboards < 2 s) | P1 | In review | Register of 132 sheets re-renders instantly in the browser; the ⌘K palette prints its own search time | Partially simulated (browser only, no API) | Tested (automated workflow) |
| N-02 | Availability 99.5% office hours; backups; PITR; restore drill | P1 | In review | — | Not applicable to a browser demo | Not applicable |
| N-03 | Security baseline (ASVS L2 checklist, HTTPS, CSP, scans) | P1 | In review | Escaped templates, PDF magic-byte check, 200 MB limit, SSRF guard on webhook URL | Partially simulated | Tested (automated workflow) |
| N-04 | Accessibility WCAG 2.2 AA | P1 | In review | Colour + icon + word, focus rings, skip link, table semantics, View as table; axe-core scan | Implemented in demo | Tested (axe-core: 0 violations on 9 screens) |
| N-05 | Observability: errors, logs, metrics, missing-sweep alert | P1 | In review | Admin › Automation run log and missing-sweep warning | Simulated | Tested (screen renders, no errors) |
| N-06 | Data retention and full project export | P1 | In review | Project overview › Export data: project.json + issued PDFs as ZIP | Implemented in demo | Tested (automated workflow) |
| N-07 | Browser and device support | P1 | In review | Desktop, tablet and 390 px phone layouts; site view phone-first | Implemented in demo | Tested (Playwright at 390, 820, 1280, 1440 px) |
| N-08 | Localisation and formats (dates, INR grouping, IST) | P1 | In review | Dates 23-Oct-2026, 24-h IST times, ₹ with Indian grouping | Implemented in demo | Tested (screen renders, no errors) |
| N-09 | Capacity: 300 users, 100k sheets, 2 TB | P1 | In progress | — | Not applicable to a browser demo (747 sheets seeded) | Not applicable |
| N-10 | Privacy and consent review | P1 | In review | Hours visibility rules; nobody ranked; fictional data only | Implemented in demo | Tested (automated workflow) |

## M15 Intelligence

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| F-55 | Late-risk prediction (advisory) | P4 | In review | Forecast chips and lists on Portfolio, Overview, Sheet (advisory) | Simulated | Tested (screen renders, no errors) |
| F-56 | Workload forecast (advisory) | P4 | In review | Workload and Discipline: forecast chart beside allocations, MAPE | Simulated | Tested (screen renders, no errors) |
| F-57 | AI drawing checks, exploratory, human-approved | P4 | In review | Intelligence › Findings queue; findings on the sheet page; mode off/evaluation/on | Simulated | Tested (automated workflow) |

## M14 Integrations

| ID | Feature | Phase | Production status | Demo screen or workflow | Demo status | Verification |
|---|---|---|---|---|---|---|
| I-01 | Excel/CSV sheet-register import | P1 | In review | Import wizard (.xlsx and .csv) | Implemented in demo | Tested (automated workflow) |
| I-02 | File-storage connector (CAD file activity) | P2 | In progress | CAD file activity on sheets; Admin › Integrations shows 'Partly built' | Simulated | Tested (screen renders, no errors) |
| I-03 | AutoCAD .NET plugin (Sheet Set title-block fields) | P2 | In review | CAD sync proposals (AutoCAD) | Simulated | Tested (automated workflow) |
| I-04 | Revit add-in (sheet list and revisions) | P2 | In review | CAD sync proposals (Revit) | Simulated | Tested (automated workflow) |
| I-05 | Autodesk Forma APIs (formerly Autodesk Construction Cloud) | P2 | Conditional | Admin › Integrations lists it as conditional | Not built (conditional in the product too) | Tested (screen renders, no errors) |
| I-06 | Bluebeam Studio API (markup status) | P3 | Conditional | Admin › Integrations lists it as conditional | Not built (conditional in the product too) | Tested (screen renders, no errors) |
| I-07 | Navisworks / BCF clash import | P3 | In review | Clash BCF import | Implemented in demo | Tested (automated workflow) |
| I-08 | Accounting export (CSV, then webhook/API) | P2 | In review | Billing CSV + simulated webhook with SSRF guard | Partially simulated | Tested (automated workflow) |
| I-09 | Inbound email for client comments | P2 | In review | Project email address; simulated forwarded email | Simulated | Tested (automated workflow) |
| I-10 | WhatsApp Business API for client comments | Decide at G1 | Decision pending | Admin › Integrations: decision pending | Not built (decision pending) | Tested (screen renders, no errors) |
| I-11 | SSO: Google Workspace or Microsoft 365 | P1 | Blocked | Simulated Microsoft account picker | Simulated | Tested (automated workflow) |
| I-12 | Outbound email (SMTP relay or transactional service) | P1 | In review | Demo mailbox replaces SMTP; nothing is sent | Simulated | Tested (automated workflow) |
| I-13 | Paperless-ngx sidecar archive | Decide in P2 | Decision pending | Admin › Integrations: decision pending | Not built (decision pending) | Tested (screen renders, no errors) |

## Screens (DESIGN.md §5)

| Screen | Name | Demo route | Status |
|---|---|---|---|
| S-01 | Sign in | `#/sign-in (+ #/sso, #/forgot, #/reset, #/invite/…)` | Implemented and rendered |
| S-02 | My work | `#/` | Implemented and rendered |
| S-03 | Portfolio | `#/portfolio` | Implemented and rendered |
| S-04 | Project overview | `#/projects/p1` | Implemented and rendered |
| S-05 | Register | `#/projects/p1/register` | Implemented and rendered |
| S-06 | Sheet detail | `#/projects/p1/sheets/…` | Implemented and rendered |
| S-07 | Issue and transmittal composer | `#/projects/p1/issue` | Implemented and rendered |
| S-08 | Review queue | `#/reviews` | Implemented and rendered |
| S-09 | Workload | `#/workload` | Implemented and rendered |
| S-10 | Timesheet | `#/timesheets, #/timesheets/approvals` | Implemented and rendered |
| S-11 | Stage plan editor | `#/projects/p1/stages` | Implemented and rendered |
| S-12 | Import wizard | `#/projects/p1/import` | Implemented and rendered |
| S-13 | Notifications centre and preferences | `Bell panel, #/settings/notifications` | Implemented and rendered |
| S-14 | Admin settings | `#/admin/…` | Implemented and rendered |
| S-15 | External transmittal page | `#/t/<token> (from the demo mailbox)` | Implemented and rendered |
| S-16 | Client comments log | `#/projects/p1/comments` | Implemented and rendered |
| S-17 | Billing signals | `#/billing` | Implemented and rendered |
| S-18 | Site view | `#/site/<token> (Project overview › Site view)` | Implemented and rendered |
| S-19 | Checklists admin and pre-check panel | `#/admin/checklists; Submit for check` | Implemented and rendered |
| S-20 | RFI, submittal, site report, change-order logs | `#/projects/p4/construction/…` | Implemented and rendered |
| S-21 | Clash issues | `#/projects/p4/construction/clashes` | Implemented and rendered |
| S-22 | Knowledge search | `#/knowledge` | Implemented and rendered |
| S-23 | Predictions panel | `Portfolio, Overview, Sheet, Workload (labelled Forecast)` | Implemented and rendered |

## Demo-only additions (not part of the product)

- **Demo mailbox** (`#/mailbox`) stands in for Mailpit/SMTP so you can see every email the product would send.
- **Demo menu** (bottom-left): mailbox, run the 08:00 sweep now, guided walkthrough, keyboard shortcuts, switch account, reset demo data.
- **Demo Access panel** on the sign-in page with every account's credentials.


## Summary

- Implemented in demo: 70
- Simulated: 18
- Partially simulated: 5
- Not a product feature (discovery task): 4
- Not a product feature (gate): 3
- Not built (conditional in the product too): 2
- Not built (decision pending): 2
- Not a product feature (owner decisions): 1
- Not a product feature (pilot choice): 1
- Engineering task; the demo needs no build: 1
- Engineering task (no API in the demo): 1
- Engineering task (staging): 1
- Engineering task (production): 1
- Pilot activity: 1
- Out of scope by design (stays in the accounting tool); stated on the Billing page: 1
- Out of scope in P1–P3 (see F-57): 1
- Out of scope (never built): 1
- Implemented in demo (client-side only): 1
- Partially simulated (browser only, no API): 1
- Not applicable to a browser demo: 1
- Not applicable to a browser demo (747 sheets seeded): 1

## Known gaps and why

- **Real integrations** (Microsoft/Google SSO, SMTP, inbound email, CAD plugins, file-storage watcher, accounting webhook) cannot run in a browser-only demo. Each has a simulated user experience and is labelled as simulated where it appears.
- **Forma (I-05), Bluebeam (I-06), WhatsApp (I-10), Paperless-ngx (I-13)** are conditional or awaiting a decision in the product itself, so the demo only shows their status on Admin › Integrations.
- **Server-side guarantees** (permissions enforced on the API, immutable storage, encryption, backups, 300-user capacity) are architectural and are explained, not demonstrated. In the demo, roles are enforced in the browser only.
- **Uploaded files** stay in the browser's memory for the session; after a page refresh the revision record remains and its file is replaced by the generated drawing.


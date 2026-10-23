# 03 · Features and functionality

DrawingOps (working name) gives an architecture-and-MEP design firm one live view of every project's sheets, deadlines, reviews, people and fee stages, on top of the CAD tools it already uses. This spec lists every feature, automation, dashboard, integration and non-functional requirement, with the IDs used in `TRACKER.md`.

**Traceability.** F-01 to F-41 keep the numbers from the research document *Architecture Firm Drawing & Project Control – Lead Research* (Section 6). F-42 to F-58 are added here because a complete product needs them; each says where it came from. A-01 to A-10 (automations), D-01 to D-05 (dashboards) and I-01 to I-13 (integrations) follow the research document's Sections 8 and 9.

**Phases.** P0 discovery · P1 visibility (H1–H4) · P2 flow and billing (H5–H7) · P3 construction stage · P4 intelligence · OOS out of scope.

**Tags.** [GIVEN] lead facts · [HYPOTHESIS] H1–H7 · [ASSUMPTION AS-nn] see `01-implementation-plan.md` §3 · [UNVERIFIED] design judgement.

---

## 1. Users and roles

| Role | Who | Main jobs in DrawingOps |
|---|---|---|
| Owner / Principal | Firm owner, directors | Read portfolio dashboard; weekly review; see billing signals |
| Project Lead (PL) | Architect leading a project | Create project, load stages, approve sheet plan, issue, manage team |
| Discipline Lead (DL) | Lead of Architecture, HVAC, Electrical, Plumbing (PHE), Fire, Civil, ELV, Medical gas | Plan sheets and dates, assign designers, first check, allocate hours |
| Designer | Architect or engineer drafting in CAD | Move own sheets through states, upload check prints, log hours |
| Senior Reviewer | Principal or senior architect | Milestone QC checks, redlines |
| Document Controller (DC) | Document control staff, or the PL on small projects [ASSUMPTION AS-07] | Upload issued PDFs, create and send transmittals |
| Accounts | Finance team | Receive stage-complete signals (P2), record invoiced |
| External (Client, Consultant, Contractor) | Outside parties | Receive transmittals by email; acknowledge (P2); read-only site view (P2) |
| System Admin | IT or LatentIQ support | Users, SSO, settings, integrations, backups |

A user has one **organisation role** (Owner, Staff, Accounts, Admin) and, per project, one **project role** (PL, DL, Designer, Senior Reviewer, DC, Viewer). Permissions come from both (§17).

## 2. Core objects (plain language)

| Object | What it is |
|---|---|
| Project | One commission for one client, e.g. "Hospital Block B, HSR". |
| Stage | A fee stage from the appointment letter (Concept, Preliminary, Approvals, Working drawings/GFC, Tender, Construction, Closure), with a fee % and dates. |
| Package | An optional group of sheets with one date, e.g. "HVAC GFC set". Lets leads plan by package before planning sheet by sheet. |
| Sheet | One drawing sheet the firm owes, e.g. `A-101 Ground Floor Plan`. **It exists from the day it is planned, before any file.** |
| Revision | One issued (or draft) version of a sheet with its PDF, revision code (e.g. P01, C02), purpose and date. |
| Transmittal | The numbered record of sending revisions to people, with a PDF cover sheet. |
| Review | A check of a sheet by a checker or senior reviewer, with outcome and redlines. |
| Allocation | Planned hours for a person on a project stage in a given week. |
| Time entry | Actual hours a person logged on a project stage. |
| Flag | A computed warning: At risk, Late, Over-allocated, Under-allocated, Timesheet missing, Review overdue, Comment overdue, Ready to invoice. |

## 3. Sheet workflow states

| State | Meaning | Who moves it here | Allowed next states |
|---|---|---|---|
| `planned` | On the list, not started | DL (create/import) | `in_progress`, `on_hold`, `cancelled` |
| `in_progress` | Being drafted | Designer or DL ("Start") | `ready_for_check`, `on_hold`, `cancelled` |
| `ready_for_check` | Designer says it is done | Designer ("Submit for check") | `in_check`, `in_progress` (withdraw) |
| `in_check` | Being reviewed | Checker ("Start check") | `changes_requested`, `approved_for_issue` |
| `changes_requested` | Redlines returned | Checker ("Return") | `in_progress` |
| `approved_for_issue` | Passed review | Checker ("Approve"); if the stage needs senior QC, the senior reviewer's approval is the second step | `issued`, `in_progress` (reopen) |
| `issued` | PDF sent with a transmittal | DC or PL ("Issue") | `in_progress` (start next revision), `superseded` |
| `superseded` | The sheet itself was replaced by another sheet number or withdrawn | PL | (terminal; Admin can reopen) |
| `on_hold` | Paused | PL | the state it was paused from |
| `cancelled` | Dropped from scope | PL, with reason | (terminal; Admin can reopen) |

Revision states are separate: `draft` → `issued` → `superseded`. Issuing revision C02 automatically sets C01 to `superseded` (A-03). **At risk** and **Late** are flags, not states (§9).

## 4. Stage states

`planned` → `active` → `deliverables_issued` → `client_approved` → `ready_to_invoice` → `invoiced` → `closed` (plus `on_hold`).

| Transition | Trigger | Phase |
|---|---|---|
| planned → active | First sheet of the stage moves to `in_progress`, or PL starts it | P1 |
| active → deliverables_issued | Every non-cancelled sheet tagged to the stage has an issued revision with a purpose the stage requires (configurable, default "For approval" or "GFC") | P1 (automatic) |
| deliverables_issued → client_approved | PL records client approval with evidence (F-26) | P2 (P1: PL can mark it manually, no evidence required) |
| client_approved → ready_to_invoice | A-09 | P2 |
| ready_to_invoice → invoiced | Accounts marks it, or accounting export/API confirms (F-28) | P2 |
| → closed | PL closes | P1 |

---

## 5. M01 · Projects and stages

**Objective.** Every project, its client, team and fee stages live in one place, so status and billing can be computed instead of asked for. [HYPOTHESIS H1, H7]
**Users.** PL (create, edit), Owner (read), DL and Designers (read), Admin (settings).
**Business problem.** Stage schedules sit in contract PDFs; nobody can see which stage a project is in without calling the lead.
**User flow.** Admin sets org defaults (F-42) → PL creates project (F-01) → picks stage template, edits fees and dates (F-02) → adds team with roles → stages move as sheets move (F-03).
**Business rules.**
- Project code unique per organisation; format configurable (default `YYYY-NNN`).
- Stage fee percentages in a project must total 100% ± 0.01, or the stage plan cannot be saved as "final" (draft allowed).
- Stage planned end ≥ planned start. Stages may overlap.
- A sheet belongs to exactly one stage (the stage whose deliverable it is). A sheet re-issued in a later stage is a new revision tagged to the later stage via the revision, not a new sheet. [UNVERIFIED design choice; confirm in discovery]
**Permissions.** Create project: Owner, PL-eligible staff (org setting). Edit stages: PL. Read: project members and Owner.
**Inputs.** Project details; appointment letter (PDF attachment, optional); stage list with % and dates.
**Outputs.** Project page, stage timeline, stage status feeding dashboards and A-09.
**Integrations.** None in P1. P2: accounting export reads stage fee % (F-28).
**Notifications.** Team member added to project (in-app + email).
**Reports.** Project list export; stage schedule export.
**Edge cases.** Project with no fee stages (internal or pro-bono): allowed, flagged "no stages" on dashboard. Client changes stage scope mid-project: stage edit is audited (F-39). Stage fee % changed after invoicing: blocked unless Admin.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-01 | Project record: code, name, client, type (hospital, residential, commercial, other), location, start/end, team with project roles, CAD versions in use (AutoCAD/Revit year) | P1 | H1 | Given a PL, when they create a project with required fields, then it appears in the project list and portfolio with stage "planned". Code duplicates are rejected with a clear message. CAD versions are free-text tags shown on the project page. |
| F-02 | Fee-stage template loaded from the appointment letter; org default template (CoA-style: Concept 10%, Preliminary 10%, Approvals, Working drawings, Tender, Construction, Closure, with editable %) | P1 | H1, H7 | Given an org default template, when a PL applies it, then stages are created with editable names, %, dates. Saving as final requires 100% total. The appointment letter PDF can be attached. Default percentages are placeholders until the owner confirms them [ASSUMPTION AS-05]. |
| F-03 | Stage status and planned/actual dates, moving by the rules in §4 | P1 | H1 | When the first sheet of a stage starts, the stage becomes active and actual start = today. When every non-cancelled sheet in the stage is issued with a required purpose, the stage becomes deliverables_issued and actual end = that date. Every stage change is in the audit trail. |
| F-42 | Organisation settings: disciplines and their sheet-number prefixes, stage templates, revision-code scheme, purpose codes, working calendar with holidays, naming rules, automation thresholds | P1 | – (added: needed by F-02, F-08, F-35, A-01 to A-10) | Admin can edit each list; changes apply to new records; existing records keep their values. Holiday calendar drives "working days" in all automations. |
| F-43 | Contacts and external organisations: clients, consultants (incl. structural), contractors, authorities; people with email | P1 | – (added: transmittals need recipients) | A PL can add a contact once and reuse it across projects. Duplicate email warns. A contact can belong to one organisation. |
| F-49 | Packages: optional groups of sheets with a planned date (e.g. "HVAC GFC set") | P1 | H3 (added: research §13 mitigation "plan by package first") | A DL can create a package, assign sheets to it, and set a package date. A sheet without its own planned date inherits the package date for A-01/A-02. Dashboards can group by package. |

## 6. M02 · Drawing register

**Objective.** One trustworthy list of every sheet the firm owes, with exactly one current revision each, so nobody builds from an old drawing. [HYPOTHESIS H2, H3]
**Users.** DL (plan), Designer (update own), DC (issue), PL (approve plan), Owner (read), External (P2 site view).
**Business problem.** No single list of sheets and their status; site may use superseded drawings.
**User flow.** DL imports the existing Excel register (F-05) or creates sheets → sets owner and planned date → designers work → PDFs are uploaded as revisions at issue (F-06) → older revisions are superseded (F-07).
**Business rules.**
- Sheet number unique within a project. Format checked against the discipline prefix rule (F-35).
- A revision code is unique per sheet and follows the org scheme (e.g. P01, P02 then C01, C02) [UNVERIFIED default; confirm in discovery].
- Exactly one revision per sheet may be `issued` and current; all earlier issued revisions are `superseded`.
- Issued files are immutable: a mistake is fixed by issuing a new revision, never by replacing a file.
- CAD files are linked (path or URL), not copied, in P1 (F-41).
**Permissions.** Create/edit sheets: DL, PL. Edit own sheet's working fields (notes, check print): Designer. Upload issued revision: DC, PL. Delete sheet: PL, only when it has no issued revision; otherwise cancel.
**Inputs.** Excel/CSV register; sheet fields; PDFs; CAD file links.
**Outputs.** Register grid, sheet detail page, revision history, downloads (watermarked when superseded).
**Integrations.** I-01 Excel import (P1). I-03/I-04 CAD plugins (P2). I-02 storage watcher (P2).
**Notifications.** Sheet assigned to you; sheet re-assigned; new revision issued (to previous recipients, via A-03).
**Reports.** Register export (Excel/PDF) with filters; drawing list per stage for transmittal or client.
**Edge cases.** Sheet renumbered: keep history, record old number as alias, searchable. Sheet split into two: original `superseded` with `replaced_by` links. PDF with many pages: one PDF per sheet in P1; multi-page PDFs rejected with a message (P2: split helper). Upload of the same file twice: detected by SHA-256 and rejected for the same sheet.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-04 | Sheet list per project and discipline: number, title, discipline, stage, package, owner (designer), checker, planned issue date, workflow state, current revision, flags | P1 | H2, H3 | Given a project, a DL can add a sheet with number, title, discipline, stage, owner and planned date. The register grid shows 1,000 sheets with filter, sort and search in < 1 s after load (N-01). Every field change is audited. |
| F-05 | Import sheet list from Excel/CSV with column mapping, preview and validation | P1 | H3 | Given an .xlsx or .csv, when the DL maps columns and previews, then invalid rows (duplicate number, unknown discipline, bad date) are listed with reasons and can be fixed or skipped. Import is all-or-nothing per run and can be undone within 24 h if no sheet has moved state since. |
| F-06 | Revision history with the PDF of each revision; exactly one current issued revision | P1 | H2 | Uploading a PDF creates a `draft` revision with the next code. Issuing it (F-14) marks it `issued`. The sheet page lists all revisions with code, purpose, date, issuer, transmittal and file. |
| F-07 | Automatic superseding of older revisions on issue | P1 | H2 | When revision C02 is issued, C01 becomes `superseded` in the same transaction; the register shows C02 as current; A-03 notifies earlier recipients. |
| F-08 | Purpose and suitability code per issue: For information, For comment, For approval, For authority submission, For tender, Good for Construction (GFC), Record/as-built; optional ISO 19650 suitability S0–S4 | P1 | H2 | Purpose is required to issue. The list is configurable in F-42. The UI never uses the bare acronym "IFC" for a purpose (it also means a BIM file format); it says "Issued for Construction" or "GFC". |
| F-09 | Sheet-list sync from Revit and AutoCAD plugins (sheet number, title, revision on title block) | P2 | H2, H3 | Given the plugin and an API token, when a designer runs "Sync sheets", then new sheets are proposed (not created) for DL approval and title mismatches are shown side by side. |
| F-46 | Bulk actions in the register: assign owner/checker, set planned dates or shift by N working days, move to package, change state where allowed | P1 | H3 (added) | Selecting 50 sheets and shifting dates by +5 working days updates all 50 and writes 50 audit entries. A bulk state change skips sheets where the transition is not allowed and reports which. |
| F-47 | Sheet detail page with revision timeline, state history, reviews, transmittals and an in-browser PDF viewer | P1 | H2 (added) | The viewer opens a 20 MB A0 PDF in < 3 s on office broadband [ASSUMPTION AS-10]; zoom and pan work; superseded revisions show a red banner. |
| F-48 | "SUPERSEDED" watermark stamped on every download of a superseded revision | P1 | H2 (added) | Downloading a superseded revision returns a PDF with a diagonal watermark and the date it was superseded on every page; the stored original is unchanged. |
| F-50 | Title-block reading for bulk PDF import: read sheet number, title and revision from the PDF text layer and match to sheets | P2 | H2 (added: research §11.2) | Given 100 vector PDFs, ≥ 90% are matched to the right sheet on a test set from the firm; unmatched files go to a manual-match list. Rule-based first; OCR only for scanned PDFs. |
| F-51 | Site view: read-only, mobile-friendly list of the current issued set per project, with download | P2 | H2 (added: research §6 note) | A site user with a magic link sees only current issued revisions for their project; superseded ones are hidden. Works on a 360 px wide phone. |
| F-54 | Onboarding of existing live projects: bulk create projects, stages, sheets and past revisions from spreadsheets and a folder of PDFs | P1 | H1 (added: needed for go-live) | Given a template workbook and a PDF folder, an Admin can load a live project in < 1 hour; historic revisions import as `issued`/`superseded` with original dates; nothing triggers notifications during import. |

## 7. M03 · Workflow and review

**Objective.** Every sheet moves through visible states with one click at each real event, so status is current without reporting, and review load is visible. [HYPOTHESIS H1, H3, H5]
**Users.** Designer, Checker (DL), Senior Reviewer, PL.
**Business problem.** Status lives in people's heads; seniors are a bottleneck nobody can measure.
**User flow.** Designer: Start → Submit for check → Checker: Start check → Return with redlines or Approve → (Senior QC if the stage requires) → DC: Issue.
**Business rules.**
- Transitions only as in §3; each needs the role listed.
- "Return" requires a comment or a redline file.
- "Approve" on a stage marked "senior QC required" creates a second review for the senior reviewer; the sheet stays `in_check` until both approve. [UNVERIFIED rule; confirm milestones in discovery]
- A designer cannot check their own sheet.
- Every transition writes a `StatusTransition` row (from, to, user, role, time, reason).
**Permissions.** As §3. PL can force any allowed transition with a reason.
**Inputs.** Clicks; optional check-print PDF; redline PDF or images; comments.
**Outputs.** State, review records, queue lists, timing data for dashboards.
**Integrations.** P2: Bluebeam markup status (I-06, if verified).
**Notifications.** Sheet ready for your check; returned with redlines; approved; senior QC needed.
**Reports.** Review cycle report: time in each state per sheet, per checker, per discipline.
**Edge cases.** Checker on leave: PL reassigns; P2 delegation (F-12). Sheet edited after approval: designer must "Reopen" (back to `in_progress`), which clears the approval.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-10 | Sheet state machine with one-click transitions, guards and audit trail | P1 | H1, H3 | Only the transitions in §3 are possible through UI and API; a disallowed call returns HTTP 409 with the allowed list. Each transition records user, role, time and reason. |
| F-11 | Assign a checker; attach redlines (PDF or images) and comments to a review | P1 | H5 | When the designer submits, the assigned checker is notified. "Return" without comment or file is blocked. Redlines are visible on the sheet page under that revision. |
| F-12 | Review queue per reviewer with waiting time, sorting by age; delegation while on leave | P2 | H5 | A reviewer sees all sheets waiting for them, oldest first, with days waiting (working days). Setting a delegate routes new reviews to them between two dates. |
| F-13 | Designer pre-check checklists per discipline and stage, ticked before "Submit for check" | P2 | H5 | Admin defines checklists; if a checklist is attached to the stage, submit is blocked until every mandatory item is ticked; ticks are stored with the review. |

## 8. M04 · Issue and transmittals

**Objective.** Every issue is a numbered, auditable record of who received which revision, for what purpose, so the current revision is never in doubt. [HYPOTHESIS H2]
**Users.** DC, PL (issue); External recipients (receive).
**User flow.** DC selects approved sheets → uploads/attaches PDFs → picks purpose and recipients → previews cover sheet → Issue → system stamps, numbers, emails, supersedes.
**Business rules.**
- Transmittal number: `<project code>-TR-<NNNN>`, sequential per project, never reused.
- A transmittal cannot be edited after it is sent; corrections are a new transmittal referencing the old one.
- Only sheets in `approved_for_issue` (or PL override with reason) can be issued.
- Email to externals contains a secure download link, valid for a configurable period (default 30 days) [UNVERIFIED default], not attachments larger than 10 MB.
**Permissions.** Create/send: DC, PL. Read: project members; recipients see only their transmittals.
**Outputs.** Cover sheet PDF, email, transmittal log, revision states updated.
**Notifications.** Recipients (email); previous recipients of earlier revisions (A-03); PL (copy).
**Reports.** Transmittal log per project; "who has which revision" matrix per sheet.
**Edge cases.** Email bounces: shown on the transmittal with a resend option. Recipient without email (paper issue): recorded as "issued by hand" with date.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-14 | Transmittal: recipients, sheets, revisions, purpose, auto-number, PDF cover sheet, secure email link | P1 | H2 | Issuing 12 sheets to 3 recipients creates one transmittal with the next number, a cover sheet listing all 12 (number, title, revision, purpose), 3 emails with links, and sets all 12 revisions to `issued`. |
| F-15 | Recipient acknowledgement of receipt (click in email or portal) | P2 | H2 | When a recipient clicks "Acknowledge", the time is stored and shown on the transmittal; unacknowledged after N days appears on the PL dashboard. |

## 9. M05 · People and workload

**Objective.** Leads see who is over- or under-loaded this week and next, and hours actually spent per project and stage. [HYPOTHESIS H4]
**Users.** DL (allocate), Designer (log hours), PL and Owner (read).
**Business rules.**
- Weekly capacity per person (default 45 h [ASSUMPTION AS-08]) minus leave and holidays from F-42.
- Allocation is planned hours per person × project × stage × ISO week.
- Over-allocated: allocations > 110% of capacity; under-allocated: < 50% (A-05 thresholds, editable).
- Timesheet week Monday–Sunday; submit by Tuesday 12:00 for the previous week (A-06). Approved timesheets are locked.
- Who sees what: a person sees their own hours; DL sees their discipline; PL sees project totals; Owner sees all. Individual hourly productivity is not ranked anywhere [UNVERIFIED design choice: research §13 people-risk].
**Integrations.** If the firm already has a timesheet tool, F-18 imports from CSV instead of being used for entry.
**Reports.** Hours by project/stage (planned vs actual); utilisation by person and discipline (billable hours / available hours); missing timesheets.
**Edge cases.** Person moves discipline mid-month: allocations stay, reporting uses the discipline at the time of entry. Part-time staff: capacity per person.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-16 | Staff directory: name, discipline, org role, team, weekly capacity, leave | P1 | H4 | Admin or DL can set capacity and leave; SSO-created users appear with blank discipline until set. |
| F-17 | Planned hours per person per project and stage, by week (grid, copy forward) | P1 | H4 | A DL can allocate 20 h to a designer on Project X Stage 4 for weeks 44–47 in one action; the person's load bar updates. |
| F-18 | Weekly timesheet by project and stage; submit and approve; or CSV import from an existing tool | P1 | H4 | A designer logs hours against only the projects/stages they are allocated to or a member of; total per day ≤ 24; DL approves; approved weeks are read-only. |
| F-19 | Over- and under-allocation view: people × weeks heat map with drill-down | P1 | H4 | Cells above 110% show "Over" (red + icon + number); below 50% show "Under"; clicking a cell lists that person's allocations that week. |

## 10. M06 · Deadlines and alerts

**Objective.** Late and at-risk sheets are known early, and the right person is told without anyone chasing. [HYPOTHESIS H1, H3]

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-20 | Daily at-risk and late rules on sheets (implemented by A-01, A-02) | P1 | H3 | See A-01 and A-02. Flags show in register, dashboards and the sheet page with the date raised; history of flags is kept. |
| F-21 | Notifications: in-app centre, email, daily digest; per-user preferences per event type; quiet hours | P1 | H1, H3 | Every event in §18 can be switched between "instant", "digest" and "off" per user except mandatory ones (assignment, review requested). The daily digest arrives at 08:30 local time [UNVERIFIED default] and lists only unread items. |

### Automation rules

Thresholds are org settings (F-42); defaults are placeholders to agree with the owner. All day counts are working days from the F-42 calendar.

| ID | Trigger | Condition | Action | Notified | Hyp. | Phase |
|---|---|---|---|---|---|---|
| A-01 | Daily sweep 08:00 | Planned issue date (own or package) within 7 days and state ∈ {planned, in_progress} | Raise **At risk** flag (clear when condition ends) | Designer, DL; PL in digest | H3 | P1 |
| A-02 | Daily sweep 08:00 | Planned issue date passed and no issued revision for the current cycle | Raise **Late**; if still late after 3 working days, escalate | DL, PL; Owner in weekly summary | H3, H1 | P1 |
| A-03 | Event: revision issued | Sheet has an earlier issued revision | Mark earlier revision `superseded`; notify every recipient of earlier revisions with a link to the new one | DC; previous recipients | H2 | P1 |
| A-04 | Event: PDF uploaded | Sheet number in file name or title block ≠ sheet, or file name breaks the naming rule | Block issue, show the exact rule broken | Uploader | Pain 13 | P1 |
| A-05 | Weekly, Monday 07:00 | Person's allocations this week > 110% or < 50% of capacity | Raise Over/Under-allocated flag | DL, PL | H4 | P1 |
| A-06 | Weekly, Tuesday 12:00 | No submitted timesheet for previous week | Reminder; list to DL | Person; DL | H4 | P1 |
| A-07 | Daily sweep | Review open > 3 working days | Escalate to delegate or DL | Reviewer, DL | H5 | P2 |
| A-08 | Daily sweep | Client comment open with no response > N days (default 5) | Reminder | Assignee, PL | H6 | P2 |
| A-09 | Event: sheet issued or client approval recorded | All stage deliverables issued AND client approval recorded | Stage → `ready_to_invoice`; create billing signal | Accounts, PL, Owner | H7 | P2 |
| A-10 | Daily sweep | RFI response due within 2 working days | Reminder | RFI assignee | Pain 14 | P3 |

Rules are idempotent: running a sweep twice the same day raises no duplicate flags or notifications. Every run is logged with counts (`AutomationRun`).

## 11. M07 · Dashboards, search and reports

| ID | Item | Who | Shows | Phase | Hyp. |
|---|---|---|---|---|---|
| D-01 (F-22) | Portfolio dashboard | Owner | Every active project: stage, sheets planned vs issued, late and at-risk counts, oldest waiting review, discipline workload heat map; P2: stages ready to invoice and days waiting | P1 | H1, H3, H4, H7 |
| D-02 (F-23) | Project dashboard | PL | Sheets planned vs issued over time per discipline (burn-up), late list, team allocation, open transmittals; P2: open client comments | P1 | H1, H3 |
| D-03 (F-23) | Discipline dashboard | DL | Assignments, check queue, capacity this week and next | P1 | H3, H4, H5 |
| D-04 (F-23) | My work | Designer | My sheets by due date, sheets returned with redlines, my reviews, timesheet status | P1 | H3, H4 |
| D-05 (F-53) | Baseline metrics report | Owner, LatentIQ | Monthly: % sheets issued after planned date; average working days in check; hours logged vs planned per project; days from deliverables issued to invoice (P2) | P1 | H1–H7 (added: research §9.1) |

| ID | Feature | Phase | Acceptance criteria |
|---|---|---|---|
| F-22 | Owner portfolio dashboard (D-01) | P1 | Loads in < 2 s for 60 active projects (N-01); every number links to the filtered list behind it; data no older than 15 minutes, with "updated hh:mm" shown. |
| F-23 | Project, discipline and My-work dashboards (D-02 to D-04) | P1 | Each card links to the filtered register or list; a user sees only projects they are a member of (F-38). |
| F-44 | Global search across projects, sheets (number, title, alias), transmittals, contacts; P2 adds comments and PDF text | P1 (added) | Typing "A-101" returns matching sheets across the user's projects in < 500 ms; results respect permissions. |
| F-45 | Project activity feed: newest-first list of significant events (state changes, issues, transmittals, stage changes, imports) with filters | P1 (added: DESIGN.md Activity tab) | Every event in the feed links to its object; filter by person, discipline and event type; feed respects permissions. |
| F-52 | Exports: register, transmittal log, late/at-risk list, workload, timesheets, to Excel and PDF | P1 (added: research §9 reports) | Every list view has "Export" with the current filters; exports over 5,000 rows run as a background job and email a link. |
| F-53 | Baseline metrics report (D-05) | P1 (added) | The report reproduces the four metrics for any date range; definitions are printed on the report. |

## 12. M08 · Client comments and approvals (P2)

**Objective.** No client comment is lost; every one has an owner, a status and a response; stage approval is evidenced. [HYPOTHESIS H6, H7]
**Business rules.** A comment belongs to a project and optionally to a sheet, revision and stage. Status: `new` → `assigned` → `responded` → `closed` (or `rejected` with reason). A response is required to close.

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-24 | Comment log per sheet and stage: source (email, meeting, call, WhatsApp, letter), received date, assignee, status, response | P2 | H6 | A PL can log a comment in < 30 s and link it to sheets; A-08 reminds on overdue items; closed comments need a response text. |
| F-25 | Capture comments from forwarded email (project address, e.g. `p-2026-014@…`) | P2 | H6 | An email forwarded to the project address creates a `new` comment with the body and attachments within 5 minutes; unknown senders go to a review queue. |
| F-26 | Client approval record per stage: who approved, date, evidence file | P2 | H6, H7 | Recording approval moves the stage to `client_approved` and triggers A-09 if deliverables are issued. |

## 13. M09 · Billing signal (P2)

**Objective.** The moment a stage is billable, accounts know, without building accounting. [HYPOTHESIS H7]

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-27 | Stage-complete flag and accounts notification (via A-09) | P2 | H7 | When a stage reaches `ready_to_invoice`, Accounts gets a notification with project, stage, fee % and fee amount (if fee value entered); D-01 shows days waiting. |
| F-28 | Export or API push to the accounting tool; record "invoiced" back | P2 | H7 | Accounts can download a CSV of ready stages in a column layout agreed with the firm, or a webhook posts JSON; marking "invoiced" (manually or via API) moves the stage to `invoiced`. |
| F-29 | Invoicing, GST, ledger | OOS | H7 | Not built. Stays in the firm's accounting tool [GIVEN research §10.3]. |

## 14. M10 · Construction administration (P3)

| ID | Feature | Phase | Acceptance criteria |
|---|---|---|---|
| F-30 | RFI log: number, question, raised by (contractor contact), ball in court, due date, linked sheets, response, cost/schedule impact flag | P3 | An RFI can link to sheets; answering it may start a new sheet revision; A-10 reminds before due. |
| F-31 | Submittal log: shop drawings, product data, samples; reviewer; status (approved, approved as noted, revise and resubmit, rejected); stamp | P3 | A reviewer can stamp a submittal PDF with status and date; the log shows who owes the next action. |
| F-32 | Site visit reports: date, attendees, observations with photos, linked sheets, actions | P3 | A site architect can file a report from a phone; photos are compressed to ≤ 2 MB each; report exports to PDF. |
| F-33 | Change-order log: description, origin (RFI, client), cost/schedule impact, approval status, linked sheets | P3 | A change order can create a new sheet revision cycle and is listed on the project dashboard. |

## 15. M11 · Coordination (P3)

| ID | Feature | Phase | Acceptance criteria |
|---|---|---|---|
| F-34 | Import clash results (BCF 2.1/3.0 .bcfzip, or Navisworks report export) as tracked issues linked to sheets and disciplines | P3 | Importing a BCF file creates one issue per topic with title, status, viewpoint image and assignee; re-importing updates existing issues instead of duplicating. |

## 16. M12 · Quality and standards; M13 · Platform; M15 · Intelligence

| ID | Feature | Phase | Hyp. | Acceptance criteria |
|---|---|---|---|---|
| F-35 | Sheet-number and file-name checks on upload (implemented by A-04) | P1 | Pain 13 | A file named against the rule is blocked with the rule text and an example of a valid name. Rules are regex-based, per org and overridable per project. |
| F-36 | AI checks drawings for errors | OOS in P1 | Pain 13 | Not built in P1–P3 [GIVEN scope rule]. See F-57. |
| F-37 | Drawing authoring | OOS | – | Never built [GIVEN scope rule]. |
| F-58 | Project knowledge base: decisions, comments, RFIs and reviews linked to sheets and searchable across projects; reusable checklists and templates | P3 | Pain 15 (added) | Searching "OT ceiling HEPA" returns past comments, RFIs and decisions across projects the user can see, each linked to its sheet. |
| F-38 | Role-based access per project (org role + project role) | P1 | H1 | A designer not on Project X cannot see it via UI, API, search or exports; the permission matrix in §17 is enforced server-side and covered by tests for every endpoint. |
| F-39 | Audit trail of every state change and every field change on projects, stages, sheets, revisions, transmittals, allocations, timesheets | P1 | H2 | Each change stores actor, time, entity, before/after values, IP and request ID; audit rows cannot be edited or deleted via the app; Admin can export them. |
| F-40 | Single sign-on with Google Workspace or Microsoft 365 (OIDC); local accounts with TOTP 2FA as fallback | P1 | – | A user with a firm account signs in without a new password; first sign-in creates the user with no project access until added. |
| F-41 | Store issued PDFs in object storage; link CAD files by path or URL rather than copying DWG/RVT | P1 | H2 | PDFs are stored once (SHA-256 dedupe) with server-side encryption; a CAD link field accepts UNC paths, SharePoint/Drive URLs and Autodesk links and is shown as "Open in CAD location". |
| F-55 | Late-risk prediction: probability each open sheet will miss its date, from history | P4 | H3 | Trained on ≥ 6 months of the firm's history; on a held-out month it ranks sheets that later went late in the top 20% at least 2× better than A-01 alone [UNVERIFIED target]; shown as advisory with reasons; never changes data. |
| F-56 | Workload forecast: predicted hours per discipline for the next 8 weeks from planned sheets and history | P4 | H4 | Forecast error (MAPE) per discipline-week reported monthly; displayed beside planned allocations, never replacing them. |
| F-57 | AI drawing checks (exploratory): title-block completeness and missing-reference checks on issued PDFs | P4 | Pain 13 | Advisory only, human approves every finding; evaluated on a labelled set of ≥ 200 sheets before any rollout; precision target agreed with the owner first. |

## 17. Permission matrix

✔ = allowed · own = only own items · — = not allowed · (P2) etc. = arrives in that phase.

| Action | Owner | PL | DL | Designer | Senior Rev. | DC | Accounts | External | Admin |
|---|---|---|---|---|---|---|---|---|---|
| View project | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | stage data only | own transmittals; site view (P2) | ✔ |
| Create project / edit stages | ✔ | ✔ | — | — | — | — | — | — | ✔ |
| Create, import, edit sheets | — | ✔ | ✔ | own notes | — | — | — | — | — |
| Start / submit own sheet | — | ✔ | ✔ | own | — | — | — | — | — |
| Check, return, approve | — | ✔ | ✔ | — | ✔ | — | — | — | — |
| Upload issued PDF, send transmittal | — | ✔ | — | — | — | ✔ | — | — | — |
| Hold, cancel, supersede sheet | — | ✔ | — | — | — | — | — | — | — |
| Allocate hours | — | ✔ | ✔ | — | — | — | — | — | — |
| Log own timesheet | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |
| Approve timesheets | — | ✔ | ✔ | — | — | — | — | — | — |
| See others' hours | all | project | discipline | — | — | — | totals | — | — |
| Log client comments (P2) | — | ✔ | ✔ | — | — | ✔ | — | — | — |
| Record client approval (P2) | — | ✔ | — | — | — | — | — | — | — |
| Mark invoiced (P2) | — | — | — | — | — | — | ✔ | — | — |
| Org settings, users, integrations | — | — | — | — | — | — | — | — | ✔ |
| Export audit trail | ✔ | — | — | — | — | — | — | — | ✔ |

## 18. Notification catalogue

| Event | To | Default | Mandatory | Phase |
|---|---|---|---|---|
| Sheet assigned to you | Designer | instant | yes | P1 |
| Sheet ready for your check | Checker | instant | yes | P1 |
| Sheet returned with redlines | Designer | instant | yes | P1 |
| Sheet approved for issue | Designer, DC | digest | no | P1 |
| Senior QC needed | Senior reviewer | instant | yes | P1 |
| Sheet at risk (A-01) | Designer, DL | digest | no | P1 |
| Sheet late (A-02) / escalation | DL, PL | instant | no | P1 |
| Transmittal received | External recipients | email | yes | P1 |
| New revision of a sheet you received (A-03) | Previous recipients | email | yes | P1 |
| Over/under-allocated (A-05) | DL, PL | digest | no | P1 |
| Timesheet missing (A-06) | Person; DL list | instant | no | P1 |
| Weekly owner summary | Owner | Monday 08:30 email | no | P1 |
| Review overdue (A-07) | Reviewer, DL | instant | no | P2 |
| Client comment assigned / overdue (A-08) | Assignee, PL | instant | no | P2 |
| Stage ready to invoice (A-09) | Accounts, PL, Owner | instant | yes | P2 |
| RFI due (A-10) | Assignee | instant | no | P3 |

## 19. Integrations

| ID | Integration | What moves | Phase |
|---|---|---|---|
| I-01 | Excel/CSV sheet-register import | Sheet lists, historic registers | P1 |
| I-02 | File-storage connector (office server, Google Drive, SharePoint, Egnyte, Forma) | "CAD file changed" activity per sheet | P2 |
| I-03 | AutoCAD plugin (.NET) | Sheet number, title, revision from Sheet Set title-block fields | P2 |
| I-04 | Revit add-in (.NET, Revit API) | Sheet list and revisions from the model | P2 |
| I-05 | Autodesk Forma APIs (formerly Autodesk Construction Cloud) | Files, issues, RFIs, submittals, only if the firm uses Forma | P2 (conditional) |
| I-06 | Bluebeam Studio API | Markup status from review sessions; only if India developer access is confirmed | P3 (conditional) |
| I-07 | Navisworks / BCF import | Clash results (F-34) | P3 |
| I-08 | Accounting export (CSV first, then webhook/API) | Ready-to-invoice stages out; invoiced status in | P2 |
| I-09 | Inbound email (IMAP or forwarding) | Client comments (F-25) | P2 |
| I-10 | WhatsApp Business API | Client comments | Decide at G1 (privacy and consent); default: not built |
| I-11 | SSO: Google Workspace or Microsoft 365 | Sign-in, user list | P1 |
| I-12 | Outbound email (firm's SMTP relay or a transactional email service) | Notifications, transmittals | P1 |
| I-13 | Paperless-ngx sidecar archive | Links to scanned approvals and letters | Decide in P2 (see `00-paperless-ngx-assessment.md`) |

## 20. Non-functional requirements

| ID | Requirement | Target | Phase |
|---|---|---|---|
| N-01 | Performance | p95 API < 300 ms for list endpoints at 200 users; register of 1,000 sheets interactive < 1 s after load; dashboards < 2 s | P1 |
| N-02 | Availability and backup | 99.5% monthly in office hours (IST) [ASSUMPTION AS-11]; nightly DB backup + point-in-time recovery 7 days; object storage versioning; restore drill monthly; RPO 24 h, RTO 4 h | P1 |
| N-03 | Security | OWASP ASVS level 2 as checklist; HTTPS only, HSTS, CSP; PDF magic-byte validation; upload size limit 200 MB; encryption at rest; secrets outside the repo; dependency and container scanning in CI | P1 |
| N-04 | Accessibility | WCAG 2.2 AA for all P1 screens; status never shown by colour alone | P1 |
| N-05 | Observability | Error tracking, structured logs with request IDs, metrics for API latency, queue depth, sweep durations; alert if a scheduled sweep does not run | P1 |
| N-06 | Data retention and export | Issued revisions and transmittals kept for the life of the system; full project export (JSON + files) on request | P1 |
| N-07 | Browser and device | Latest two versions of Chrome, Edge, Firefox, Safari; desktop first ≥ 1280 px; My work and site view usable at 360 px | P1 / P2 |
| N-08 | Localisation and formats | English UI; dates `23-Oct-2026`; Indian digit grouping (1,00,000) for money; INR; IST timezone default; architecture ready for more languages | P1 |
| N-09 | Capacity | 300 users, 100 concurrent projects, 100,000 sheets, 500,000 revisions, 2 TB PDFs without re-architecture [ASSUMPTION AS-09] | P1 |
| N-10 | Privacy and consent | Personal data limited to work data; hour data visibility per §9; client data stays in the agreed region; India data-protection obligations reviewed with counsel before go-live [UNVERIFIED] | P1 |

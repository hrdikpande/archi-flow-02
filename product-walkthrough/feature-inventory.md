# DrawingOps · feature inventory

Every feature and meaningful sub-feature discovered in the demo (`demo/js/screens/*`, `demo/js/demo-state.js`), cross-checked against `docs/03-features-and-functionality.md` and `demo/feature-coverage.md`. IDs F-, A-, D-, I-, N- follow the specification and `TRACKER.md`; other IDs are sub-features added here.

Roles: O owner, PL project lead, DL discipline lead, D designer, SR senior reviewer, DC document controller, ACC accounts, ADM system admin, EXT external recipient, ALL everyone signed in.

**147 features** across 24 modules.

## Platform

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-40a | Sign in with Microsoft (SSO) | ALL | `#/sign-in, #/sso` | Staff sign in with the firm's Microsoft 365 / Google Workspace account; no new password. | Simulated (account picker) |
| F-40b | Local sign-in with TOTP two-factor | ADM | `#/sign-in` | Email and password plus a 6-digit authenticator code for admins and non-SSO users. | Implemented in demo |
| F-40c | Forgot / reset password by emailed code | ALL | `#/forgot, #/reset` | Local accounts request a 6-digit code by email and set a new password. | Simulated email (demo mailbox) |
| F-40d | Show password, keep me signed in | ALL | `#/sign-in` | Reveal password toggle and persistent session option. | Implemented in demo |
| F-40e | No public sign-up | ALL | `#/sign-in` | Accounts come only from SSO or an admin invitation. | Implemented in demo |
| F-38 | Role-based navigation and access per project | ALL | `all` | Navigation, pages and actions follow the organisation role plus each project role. | Implemented in demo (browser-enforced) |
| F-38b | No-access page for routes outside a role | ALL | `e.g. #/portfolio as designer` | Clear message instead of the page when a role lacks access. | Implemented in demo |
| INV | User invitations by email | ADM | `#/admin/users, #/invite/:token` | Admin invites by email; invitee sets a password or uses SSO. | Simulated email |
| PROF | Profile and delegation settings | ALL | `#/settings/profile` | Personal details and review delegation. | Implemented in demo |
| KB | Keyboard shortcuts | ALL | `global` | Ctrl/⌘K, ?, g-m/g-r/g-w/g-v, j/k/x/Enter in the register, s and a. | Implemented in demo |
| N-03a | Upload safety checks | ALL | `upload` | PDF magic-byte check, 200 MB limit, SHA-256 duplicate check. | Implemented in demo |
| ACCV | Accounts' narrow project view | ACC | `#/projects/:pid` | Stages and fees only. | Implemented in demo |
| F-39 | Audit trail (insert-only) and background export | ADM, O | `#/admin/audit` | Actor, time, entity, before/after, IP, request ID; export as background job with emailed link. | Implemented in demo |
| THEME | Dark theme and row density | ALL | `account menu` | Light/dark/system theme; compact or comfortable rows. | Implemented in demo |
| N-04 | Accessibility: colour + icon + word, table views, focus, skip link | ALL | `all` | WCAG 2.2 AA target; axe-checked in the demo. | Implemented in demo |
| N-07 | Desktop, tablet and phone layouts | ALL | `all` | Responsive from 390 px. | Implemented in demo |
| N-08 | Indian formats (dates, ₹ grouping, IST) | ALL | `all` | 23-Oct-2026 dates, 24-hour IST, ₹ with Indian grouping. | Implemented in demo |
| TRUST | Server-side permissions, immutable issued files, insert-only audit, idempotent sweeps | — | `architecture` | Design guarantees of the production system. | Not demonstrable in a browser prototype (server-side) |
| N-01 | Performance targets | — | `—` | p95 API < 300 ms; register < 1 s; dashboards < 2 s. | Partially simulated (browser only) |
| N-02 | Availability, backups, restore drill | — | `—` | Operational requirements. | Not applicable to a browser demo |
| N-09 | Capacity 300 users, 100k sheets | — | `—` | Scale target. | Not applicable |

## Dashboards

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| D-04 | My work (designer) | D | `#/` | Own sheets by due date with state, flags and one next action; returned sheets; hours this week. | Implemented in demo |
| D-04b | My work variants per role | DL, DC, ACC, PL, ADM | `#/` | Waiting for your check (DL/SR), ready to issue (DC), ready to invoice (ACC/O), projects you lead (PL), firm set-up (ADM). | Implemented in demo |
| D-01 | Owner portfolio dashboard | O, PL, ADM | `#/portfolio` | Five metric cards with week-on-week delta, project table, discipline load, forecast list. | Implemented in demo |
| D-01b | Every number opens the list behind it | O | `#/sheets?flag=late` | Metric cards open the exact filtered list; counts match. | Implemented in demo |
| D-01c | Portfolio filters (lead, type) and sorting | O | `#/portfolio` | Filter by project lead or type; sortable columns. | Implemented in demo |
| D-02 | Project dashboard | PL, O, all members | `#/projects/:pid` | Metrics, burn-up, stage timeline, late sheets, project card, team load, transmittals, comments, change orders, forecast. | Implemented in demo |
| D-02b | Burn-up chart with discipline filter and table view | PL | `#/projects/:pid` | Planned vs issued cumulative sheets; chart can be read as a table. | Implemented in demo |
| D-03 | Discipline dashboard | DL | `#/disciplines/:code` | Late, at risk, check queue, approved-not-issued, assignments, capacity, workload forecast. | Implemented in demo |
| SL | Sheets list (behind dashboard numbers) | ALL | `#/sheets` | Cross-project sheet list with flag, discipline and text filters, pagination and export. | Implemented in demo |
| F-52a | Portfolio late/at-risk export | O | `#/portfolio` | Export late and at-risk sheets to Excel, PDF or CSV. | Implemented in demo |

## Projects

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| PL-LIST | Projects list | ALL | `#/projects` | Search, state and type filters, issued/planned and late counts, export. | Implemented in demo |
| F-01 | New project (record, client, type, fee, dates, lead, DC, CAD versions) | O, PL, ADM | `#/projects/new` | Creates the project with stages from a template; client added to contacts. | Implemented in demo |
| F-01b | Unique project code validation | PL | `#/projects/new` | Duplicate code refused with the name of the project that uses it. | Implemented in demo |
| F-01c | Edit project (name, end date, fee, state) | PL, O, ADM | `#/projects/:pid` | Edit drawer; closing keeps all records. | Implemented in demo |
| F-02 | Fee-stage plan from appointment letter, 100% rule | PL | `#/projects/:pid/stages` | Editable fee %, dates, required purposes, senior QC; total must be 100% to save as final. | Implemented in demo |
| F-02b | Appointment letter attach and download | PL | `#/projects/:pid/stages` | Attach the letter as PDF; download from the project card. | Implemented in demo |
| F-02c | Apply stage template; add stage | PL | `#/projects/:pid/stages` | Replace a not-started plan with a template; add stages. | Implemented in demo |
| F-03 | Stage states roll up from sheets | PL | `#/projects/:pid/stages` | Planned → Active (first sheet started) → Deliverables issued (all issued) → Client approved → Ready to invoice → Invoiced → Closed; fee % locks after invoicing. | Implemented in demo |
| TEAM | Team and project roles; add/remove member | PL, ADM | `#/projects/:pid/team` | Members with project role, discipline, hours here and load; add notifies by app and email. | Implemented in demo |
| F-45 | Project activity feed | ALL members | `#/projects/:pid/activity` | Every state change, issue, transmittal, stage event, import and comment; filters. | Implemented in demo |
| N-06 | Full project export (JSON + issued PDFs) | PL, O, ADM | `#/projects/:pid` | One ZIP with every record and current issued PDFs. | Implemented in demo |
| F-43 | Contacts and external organisations | ALL | `#/contacts` | Clients, consultants, contractors, authorities; duplicate-email warning; export. | Implemented in demo |
| SITE-LINK | Project email address and site-view link | PL | `#/projects/:pid` | Per-project inbound email address; copy the site view link. | Simulated inbound email |

## Register

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-04 | Sheet register | PL, DL, all members | `#/projects/:pid/register` | Every sheet with number, title, discipline, package, owner, checker, state, planned date, revision, flags. | Implemented in demo |
| F-04b | Register search (number, title, alias, owner) | ALL | `#/projects/:pid/register` | Instant text search. | Implemented in demo |
| F-04c | Register filters and Late / At-risk toggles | ALL | `#/projects/:pid/register` | Discipline, stage, state, owner, package filters; flag toggles. | Implemented in demo |
| F-04d | Grouping, sorting, column chooser | ALL | `#/projects/:pid/register` | Group by discipline/package/stage with counts; sortable; show/hide columns. | Implemented in demo |
| SV | Saved views | ALL | `#/projects/:pid/register` | Save filters, grouping and sort as a named view. | Implemented in demo |
| F-04e | Inline edit with undo | PL, DL | `#/projects/:pid/register` | Owner, checker, package, planned date edited in the table; audited; undo. | Implemented in demo |
| F-46 | Bulk actions with skipped report | PL, DL, DC | `#/projects/:pid/register` | Assign owner/checker, shift dates ± working days, move to package, change state, issue, export selected. | Implemented in demo |
| F-49 | Packages with planned dates | PL, DL | `#/projects/:pid/register` | Sheets without their own date inherit the package date; new package. | Implemented in demo |
| F-04f | New sheet with live number check | PL, DL | `#/projects/:pid/register` | Sheet exists before any file; number checked against the discipline rule. | Implemented in demo |
| F-52 | Exports to Excel / PDF / CSV | ALL | `lists` | Every list exports with current filters; over 5,000 rows run as a background job. | Implemented in demo |
| F-05 | Excel/CSV import wizard with mapping, preview, undo | PL, DL | `#/projects/:pid/import` | Upload, auto-mapped columns, row-level problems, all-or-nothing commit, undo within 24 h. | Implemented in demo |
| F-06 | Revisions: PDF upload creates the next draft code | D, PL, DC | `#/projects/:pid/upload, sheet page` | Each PDF becomes a draft revision (P01, C01…); one current revision per sheet. | Implemented in demo |
| F-50 | Title-block reading for unmatched PDFs | PL, DC | `#/projects/:pid/upload` | A scan with no sheet number in its name is matched from its title-block text. | Implemented in demo |
| F-54 | Onboarding of a live project with historic revisions | ADM | `#/admin/onboarding` | Template workbook + PDFs; problems listed first; loads silently. | Implemented in demo |

## Quality

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-35 | Naming checks on upload (A-04) | ALL | `upload, issue composer` | File name and sheet number rules; issue blocked with rule text and a valid example. | Implemented in demo |

## Integrations

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-09 | Revit / AutoCAD sheet-list sync (proposals) | PL, DL | `#/projects/:pid/cad-sync` | Plugins propose new sheets and title changes; nothing is created until a lead accepts. | Simulated plugins |
| I-02 | File-storage connector (CAD file activity) | ALL | `CAD sync, sheet page` | Shows when a CAD file was last saved and by whom. | Simulated |
| I-12 | Outbound email (SMTP) | ALL | `demo mailbox` | Transmittals, notifications, resets, invitations, digests and summaries by email. | Simulated (demo mailbox) |
| I-08 | Accounting integration settings (columns, webhook, SSRF guard) | ADM | `#/admin/integrations` | Choose CSV columns, webhook URL with private-address guard, enable, test event. | Simulated webhook |
| I-INT | Integrations overview and API tokens | ADM | `#/admin/integrations` | Status of every integration; scoped tokens shown once; conditional items. | Simulated integrations |
| I-05 | Autodesk Forma | — | `#/admin/integrations` | Conditional on the firm using Forma. | Not built (conditional) |
| I-06 | Bluebeam Studio | — | `#/admin/integrations` | Conditional on developer access. | Not built (conditional) |
| I-10 | WhatsApp Business API | — | `#/admin/integrations` | Decision pending (privacy); WhatsApp is a manual comment source. | Not built (decision pending) |
| I-13 | Paperless-ngx archive | — | `#/admin/integrations` | Decision pending. | Not built (decision pending) |

## Sheet

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-47 | Sheet page with PDF viewer | ALL | `#/projects/:pid/sheets/:sid` | Header, state, flags, forecast, viewer with download/new tab/full screen. | Implemented in demo |
| F-48 | Superseded banner and SUPERSEDED watermark | ALL | `sheet page, downloads` | Old revisions show a red banner and download with a diagonal watermark and date. | Implemented in demo |
| REV | Revisions list and reviews history | ALL | `sheet page` | Every revision with purpose and transmittal; every check and senior QC decision. | Implemented in demo |
| DIST | Who has which revision (distribution) | ALL | `sheet page; transmittals matrix` | Per recipient: revision held, transmittal, download and acknowledgement. | Implemented in demo |
| TL | Sheet activity timeline | ALL | `sheet page` | Every transition with who, when and why. | Implemented in demo |
| F-41 | CAD file link (linked, not copied) | ALL | `sheet page` | Copy the CAD file path; issued PDFs held in object storage. | Simulated storage |
| NOTES | Working notes, edit details | PL, DL, D (notes) | `sheet page › More` | Working notes and sheet detail edits, audited. | Implemented in demo |

## Workflow

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| OVR | Project-lead override with reason; hold, cancel, supersede, delete | PL | `sheet page › More` | Override stays within the transition table; hold/cancel/supersede need a reason; never-issued sheets can be deleted. | Implemented in demo |
| F-10 | Sheet state machine, one-click transitions, audit | D, DL, SR, DC, PL | `My work, sheet page, reviews` | One transition table for every sheet; allowed actions per role. | Implemented in demo |
| F-13 | Designer pre-check checklists | D | `Submit for check` | Mandatory items block submission; ticks stored with the review. | Implemented in demo |
| F-11 | Return with comment or redlines (required) | DL, SR | `#/reviews` | Return needs a comment or redline file; designer notified. | Implemented in demo |
| F-12 | Review queue, oldest first, waiting days; delegation | DL, SR | `#/reviews` | Queue with working days waited, overdue flag, scope and kind filters; set a delegate for dates. | Implemented in demo |
| SQC | Senior QC as a second step | SR | `#/reviews` | Stages that need senior QC hold the sheet in check until the senior reviewer approves. | Implemented in demo |
| RESTART | Start revisions after a return | D | `My work, sheet page` | Returned sheet goes back to In progress. | Implemented in demo |

## Transmittals

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-14 | Issue composer and numbered transmittals | DC, PL | `#/projects/:pid/issue` | Sheets, purpose, recipients (email and by hand), note, preview, confirm; sequential numbers. | Implemented in demo |
| F-08 | Purpose (and suitability) per issue | DC | `issue composer; admin codes` | Purpose required; ISO 19650 suitability optional. | Implemented in demo |
| COVER | Transmittal cover sheet PDF | DC, EXT | `issue composer, transmittal page` | Generated cover with project, purpose, recipients and drawings. | Implemented in demo |
| F-07 | Automatic superseding on issue (A-03) | DC | `issue` | Earlier revisions superseded in the same step; earlier recipients emailed. | Implemented in demo |
| TLOG | Transmittal log, filters, matrix, export | ALL members | `#/projects/:pid/transmittals` | Every issue with purpose, sheets, recipients, acknowledgement and bounce status. | Implemented in demo |
| TDET | Transmittal detail, resend, correction transmittal | DC | `#/projects/:pid/transmittals/:tid` | Per-recipient delivery, download and acknowledgement; resend; corrections are new transmittals. | Implemented in demo |

## External

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| S-15 | External transmittal page (no login) | EXT | `#/t/:token` | Secure link page with transmittal details and every drawing. | Implemented in demo |
| ZIP | Download one or all as ZIP with cover | EXT | `#/t/:token` | Single downloads or ZIP including the cover sheet. | Implemented in demo |
| F-15 | Recipient acknowledgement of receipt | EXT | `#/t/:token` | Records date and time; sender sees it immediately. | Implemented in demo |
| F-51 | Site view: current issued set on a phone | EXT | `#/site/:token` | Phone-first list of current issued revisions only, with search. | Implemented in demo |

## Comments

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-24 | Client comment log | PL, DL, DC | `#/projects/:pid/comments` | Numbered comments with source, sheets, assignee, status; response required to close; reject; export. | Implemented in demo |
| F-25 | Capture comments from forwarded email; unknown-sender queue | PL | `#/projects/:pid/comments` | Project email address logs known senders; unknown senders wait for review. | Simulated inbound email |
| F-26 | Client approval per stage with evidence | PL | `#/projects/:pid/stages` | Approved by, date, evidence file, note. | Implemented in demo |

## Automation

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| A-08 | Client comment overdue (A-08) | PL | `comments` | No response after N days flags and reminds. | Implemented in demo |
| F-20 | At-risk and late flags (A-01, A-02) | ALL | `register, dashboards` | Computed from planned dates and the working calendar; escalation after 3 working days. | Implemented in demo |
| AUTO | Automation rules A-01..A-10 with thresholds | ADM | `#/admin/automation` | Ten rules with schedule, condition, thresholds and on/off. | Implemented in demo |
| SWEEP | Idempotent daily sweep and run log; missing-sweep warning (N-05) | ADM | `#/admin/automation` | Run now; second run sends nothing twice; run log with counts and durations. | Implemented in demo |
| A-03 | Supersede and tell earlier recipients (A-03) | DC | `issue` | On issue. | Implemented in demo |
| A-05 | Over/under allocation (A-05) | PL, DL | `workload` | Weekly > 110% / < 50%. | Implemented in demo |
| A-06 | Timesheet missing (A-06) | ALL | `timesheets, approvals, reports` | Reminder after Tuesday 12:00. | Implemented in demo |
| A-07 | Review overdue (A-07) | DL, SR | `reviews` | Open > 3 working days escalates to delegate or DL. | Implemented in demo |
| A-10 | RFI due (A-10) | PL | `construction` | RFI due within 2 working days flagged and reminded. | Implemented in demo |

## Knowledge

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-58a | Decisions log | PL | `#/projects/:pid/decisions` | Decisions with context and sheets; searchable. | Implemented in demo |
| F-58 | Knowledge search | ALL | `#/knowledge` | Decisions, comments, RFIs and review comments with highlights and filters. | Implemented in demo |

## Billing

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| A-09 | Ready-to-invoice signal (A-09) | PL, ACC, O | `stages, billing` | Deliverables issued + client approval → ready to invoice; Accounts, owner, PL notified. | Implemented in demo |
| F-27 | Billing signals list | ACC, O, PL | `#/billing` | Ready stages with fee %, amount, waiting days and approval evidence. | Implemented in demo |
| F-28 | Accounting export (CSV) and webhook push; mark invoiced | ACC | `#/billing` | CSV in configured columns; signed webhook; invoice reference and date. | Partially simulated (webhook) |
| INVD | Invoiced history | ACC, O | `#/billing/invoiced` | Invoiced stages with reference and days from deliverables to invoice. | Implemented in demo |
| F-29 | Invoicing, GST, ledger | — | `—` | Deliberately out of scope; stays in the accounting tool. | Out of scope by design |

## People

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-19 | Workload heat map (over/under, A-05) | PL, DL, O | `#/workload` | Planned hours vs capacity per person and week; icon + word + %; filters. | Implemented in demo |
| F-17 | Allocations per person × project-stage × week | PL, DL | `#/workload` | Cell drawer with inline edit and copy to next 3 weeks; Allocate dialog. | Implemented in demo |
| F-16 | Staff directory: discipline, capacity, leave | DL, ADM, all | `#/workload/staff` | Capacity and leave drive the heat map. | Implemented in demo |
| F-18 | Weekly timesheets; CSV import; submit and lock | ALL except ADM | `#/timesheets` | Rows from allocations; day grid; import CSV; submit locks the week. | Implemented in demo |
| F-18b | Timesheet approvals; return; remind | DL, PL | `#/timesheets/approvals` | Approve, return with reason, approve all, remind missing people. | Implemented in demo |
| N-10 | Hours visibility and no ranking | ALL | `team, reports` | Hours visible to self, DL, PL and owner; utilisation never ranks people. | Implemented in demo |

## Alerts

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-21 | Notification centre | ALL | `bell panel` | Today / earlier, unread, link to the item, mark all read. | Implemented in demo |
| F-21b | Notification preferences, mandatory alerts, quiet hours, digest | ALL | `#/settings/notifications` | Instant / digest / off per event; mandatory locked; quiet hours; send digest now. | Implemented in demo |
| SUMMARY | Weekly owner summary email | O | `email` | Monday morning summary of late, at-risk, overloaded and ready-to-invoice. | Simulated email |

## Construction

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-30 | RFI log; answer starts next revision | PL, DL | `#/projects/:pid/construction/rfis` | Question, raised by, ball in court, due, sheets, impact; answering can restart linked sheets. | Implemented in demo |
| F-31 | Submittal log and stamped review | PL, DL | `#/projects/:pid/construction/submittals` | Review and stamp (approved, as noted, revise, rejected); stamped PDF. | Implemented in demo |
| F-32 | Site visit reports with photos | PL, DL | `#/projects/:pid/construction/site` | Attendees, weather, observations, photos compressed and EXIF removed, PDF export. | Implemented in demo |
| F-33 | Change-order log | PL | `#/projects/:pid/construction/changes` | Cost, time, source, sheets; PL approves; approved total. | Implemented in demo |

## Coordination

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-34 | Clash import (BCF) as issues | PL, DL | `#/projects/:pid/construction/clashes` | Viewpoints, disciplines, sheets, assignee, status; re-import updates by GUID. | Implemented in demo (sample BCF) |

## Search

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-44 | Command search (⌘K / Ctrl+K) | ALL | `global` | Sheets, projects, transmittals, contacts and actions across visible projects. | Implemented in demo |

## Reports

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-53 | Baseline metrics report (D-05) with PDF | O, ADM | `#/reports?tab=baseline` | Four measures, by month and project, definitions printed. | Implemented in demo |
| RPT-H | Hours by project and stage | O, PL, DL, ACC | `#/reports?tab=hours` | Planned vs logged hours per stage; export. | Implemented in demo |
| RPT-U | Utilisation (never ranked) | O, PL, DL | `#/reports?tab=util` | Billable / available by discipline and person, alphabetical. | Implemented in demo |
| RPT-R | Review cycle report | O, PL, DL, ACC | `#/reports?tab=review` | Days in check by discipline and checker; time in each state. | Implemented in demo |
| RPT-M | Missing timesheets with reminders | O, PL, DL | `#/reports?tab=missing` | List for last week; send reminders now. | Implemented in demo |

## Intelligence

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-55 | Late-risk prediction (advisory) | O, PL, DL | `portfolio, overview, sheet` | Probability with reasons; never changes data. | Simulated model (deterministic stand-in) |
| F-56 | Workload forecast (advisory) | O, PL, DL | `discipline, workload` | 8-week forecast beside allocations and capacity, with MAPE. | Simulated model |
| F-57 | AI drawing checks, human-approved | SR, DC, ADM | `#/intelligence/findings` | Findings with confidence; accept or dismiss; owner told. | Simulated model |
| G3 | Intelligence modes and gate G3 | ADM | `#/admin/intelligence` | Off / evaluation / on; unlocks after 6 months and 2,000 issued revisions; back-test figures. | Simulated figures |

## Admin

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-42a | Organisation settings | ADM | `#/admin/organisation` | Name, address, time zone, code format, capacity, digest time, link validity, acknowledgement days. | Implemented in demo |
| F-42b | Disciplines and sheet-number rules | ADM | `#/admin/disciplines` | Per-discipline regex with live test. | Implemented in demo |
| F-42c | Stage templates | ADM | `#/admin/stage-templates` | Standard fee-stage templates; default. | Implemented in demo |
| F-42d | Revision and purpose codes; ISO 19650 suitability | ADM | `#/admin/codes` | Revision scheme (P/C), purpose list, optional suitability codes. | Implemented in demo |
| F-42e | Naming rules with live tester | ADM | `#/admin/naming-rules` | Rules for sheet numbers and file names; pass/fail with reason. | Implemented in demo |
| F-42f | Checklists admin | ADM | `#/admin/checklists` | Pre-check items per discipline and stage. | Implemented in demo |
| F-42g | Working calendar and holidays | ADM | `#/admin/calendar` | Working week and holidays used by every automation. | Implemented in demo |
| USERS | Users and roles; deactivate (never delete) | ADM | `#/admin/users` | Org role, sign-in method, last seen; invitations waiting; resend/withdraw. | Implemented in demo |
| ADM-CONTACTS | Contacts in admin | ADM | `#/admin/contacts` | Same contact list under admin. | Implemented in demo |

## Demo only

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| DEMO-MB | Demo mailbox (stands in for email) | — | `#/mailbox` | Shows every email the product would send. | Demo-only |
| DEMO-CTL | Demo menu, guided tour, reset, Demo Access panel | — | `Demo button` | Prototype harness controls. | Demo-only |

## Out of scope

| ID | Feature | Roles | Screen / route | What it does | Demo status |
|---|---|---|---|---|---|
| F-36/F-37 | AI drawing checks before Phase 4; drawing authoring | — | `—` | Never built in P1–P3 / never built. | Out of scope |

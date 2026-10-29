# DrawingOps · workflow inventory

End-to-end workflows across roles and dashboards, traced from the demo's screens to its business rules (`demo/js/demo-state.js`: transition table, `transition`, `issue`, `stageRules`, `billingRule`, `runSweep`). Each workflow lists the steps, who does them, where, what the system does automatically, and where the walkthrough video shows it. Times refer to chapters of `complete-product-walkthrough.mp4` (see `chapters.txt` for timestamps).

## W1 · Plan a project from the appointment letter

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | Project lead (or Owner/Admin) | Projects › New project | Enter code, name, client, type, location, fee, dates, lead, document controller, stage template, CAD versions | Rejects duplicate or badly formatted codes; adds a new client to Contacts; creates stages from the template with dates spread across the project; notifies the lead and DC |
| 2 | Project lead | Project › Stages | Adjust fee %, dates, required purposes, senior QC; attach the appointment letter | Fees must total 100% to save as final; every change audited |
| 3 | Project lead | Project › Team & hours | Add members with project roles and disciplines | Member notified in app and by email |

Video: chapter 04.

## W2 · Build the sheet register

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | PL / DL | Register › Import Excel | Upload .xlsx/.csv, map columns, preview | Each row checked (duplicate number, unknown discipline, bad date, number rule); problems explained; import is all-or-nothing; undo for 24 h while no sheet moved |
| 2 | PL / DL | Register › Sheet | Add a sheet | Sheet exists before any file; number checked against the discipline rule as you type |
| 3 | PL / DL | CAD sync | Accept or reject Revit/AutoCAD proposals; choose model or register title | Sheet created only on acceptance (plugins simulated in the demo) |
| 4 | PL / DL | Register | Inline edits, bulk owner/checker/package/date shifts, saved views | Edits audited with undo; date shifts use working days; skipped sheets reported with reasons |

Video: chapters 05 and 06.

## W3 · Draft, check and approve a sheet (the core loop)

```text
Planned → In progress → Ready for check → In check → Approved for issue → Issued
                ↑                              ↓
                └──── Changes requested ←──────┘   (return needs a comment or a redline file)
```

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | Designer (or DL/PL) | My work › Start | One click | Sheet In progress; if first in its stage, stage becomes Active |
| 2 | Designer | Sheet page › Upload PDF | Upload a check print | Draft revision with the next code (P01/C01…); naming rule, PDF magic bytes, 200 MB limit, SHA-256 duplicate checks |
| 3 | Designer | Sheet page › Submit for check | Tick the discipline's pre-check list | Blocked until mandatory items are ticked; review opened; checker notified (mandatory alert) |
| 4 | Checker (DL) | Reviews | Open the review (drawing beside the check) | Queue shows working days waited; overdue after 3 working days (A-07) |
| 5a | Checker | Reviews › Return | Comment and/or redline files | Changes requested; designer notified with the comment |
| 5b | Checker | Reviews › Approve | Optional comment | If the stage needs senior QC: stays In check, senior reviewer notified; otherwise Approved for issue; the sheet owner (designer) and DC notified |
| 6 | Senior reviewer | Reviews (senior QC) | Approve or return | Approved for issue; DC notified |
| 7 | Designer | My work › Returned to you › Start revisions | — | Back to In progress |
| – | Any reviewer | Reviews › Set a delegate | Choose colleague and dates | Reviews and escalations route to the delegate |
| – | Project lead | Sheet › More | Hold, resume, cancel, supersede (with reason); override a step (with reason, within the table) | Audited; nothing outside the transition table is possible (HTTP 409 otherwise) |

Video: chapters 07, 08 and 09.

## W4 · Issue drawings and supersede old revisions

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | Document controller | My work › Approved and ready to issue | Issue n sheets… | Opens the composer with the next transmittal number reserved |
| 2 | DC | Issue composer › Sheets | Choose approved sheets; rename a blocked file; add a missing PDF | Sheets without a valid PDF stay behind |
| 3 | DC | Purpose and recipients | Purpose (required), email recipients, by-hand recipients, note | — |
| 4 | DC | Preview | Preview the cover sheet | Generated PDF cover |
| 5 | DC | Issue (confirm) | One click | One numbered transmittal; revisions issued; earlier revisions superseded (A-03); secure links emailed; earlier recipients told a newer revision exists; PL and owners notified; stages re-checked for "deliverables issued" |
| 6 | DC | Transmittals | Log, matrix, detail; resend bounced email; correct with a new transmittal | Transmittals are never edited after sending |

Video: chapter 10.

## W5 · Client receives, downloads and acknowledges

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | Client / consultant / contractor | Email | Open drawings | Secure page, no sign-in; link expires after the configured days |
| 2 | Recipient | Transmittal page | Download one, or all as ZIP with the cover | Download time recorded; superseded files watermarked |
| 3 | Recipient | Transmittal page | Acknowledge receipt | Time recorded; sender and PL notified; shows on the transmittal |
| 4 | Earlier recipient | Email | New revision notice | Points to the current set |
| 5 | Site team | Site view link (phone) | Search and open current drawings | Only current issued revisions are listed |

Video: chapter 11.

## W6 · Client comments and decisions

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | PL / DL / DC | Comments › Log comment | Source (email, letter, call, WhatsApp, meeting), sender, assignee, text, sheets | Numbered (e.g. 2026-014-CC-010); assignee notified |
| 2 | Client | Email to the project address | Forward an email | Known sender: logged automatically; unknown sender: waits in a review queue (inbound email simulated in the demo) |
| 3 | Assignee | Comment drawer | Respond, then close | Close requires a written response; reject requires a reason |
| 4 | System | Daily sweep | — | Overdue after N days (A-08): assignee and PL reminded |
| 5 | PL | Decisions | Record a decision with context and sheets | Searchable in Knowledge |

Video: chapter 12.

## W7 · From deliverables to invoice (billing signal)

```text
Stage: Active → Deliverables issued → Client approved → Ready to invoice → Invoiced → Closed
```

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | System | On issue | Every non-cancelled sheet of the stage issued with a required purpose | Stage becomes Deliverables issued |
| 2 | Project lead | Stages › Record client approval | Approved by, date, evidence file, note | Client approved; if all deliverables issued → Ready to invoice (A-09); Accounts, Owner and PL notified |
| 3 | Admin | Integrations › Accounting | Choose CSV columns, webhook URL, enable | Private and link-local addresses refused (SSRF guard) |
| 4 | Accounts | Billing signals | Export CSV, or push to accounting | CSV in agreed columns; signed webhook (simulated in the demo) |
| 5 | Accounts | Billing › Mark invoiced | Invoice reference and date | Invoiced; fee % locks; appears in Invoiced and the baseline "days to invoice" metric |
| 6 | Project lead | Stages › Close | — | Closed |

Video: chapters 04 (stages), 12 (approval), 13 (billing).

## W8 · Plan people and record time

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | PL / DL | Workload | Allocate hours per person × project-stage × week; copy forward | Heat map updates; over 110% / under 50% flagged (A-05) |
| 2 | DL / Admin | Staff directory | Capacity and leave | Capacity reduced for leave and holidays |
| 3 | Everyone except Admin | Timesheets | Enter hours (or import CSV), submit | Week locks; missing by Tuesday 12:00 → reminder (A-06) |
| 4 | DL / PL | Timesheet approvals | Approve, return with reason, approve all, remind | Approved weeks read-only; returned weeks reopen with the reason |
| 5 | Owner / PL / DL | Reports | Hours, utilisation (never ranked), missing timesheets | Visibility rules applied |

Video: chapter 14 (and 18 for reports).

## W9 · Deadlines, alerts and the daily sweep

| # | Trigger | Rule | Who is told |
|---|---|---|---|
| 1 | Daily 08:00 | A-01 at risk (planned date within 7 working days, not started/in progress) | Designer, DL (digest by default) |
| 2 | Daily 08:00 | A-02 late (planned date passed, not issued); escalate after 3 working days | DL, then PL |
| 3 | On issue | A-03 supersede and tell earlier recipients | External recipients |
| 4 | On upload | A-04 naming rule check | Uploader (issue blocked) |
| 5 | Monday 07:00 | A-05 over/under-allocated | DL, PL |
| 6 | Tuesday 12:00 | A-06 timesheet missing | Person |
| 7 | Daily 08:00 | A-07 review overdue | Reviewer or delegate, DL |
| 8 | Daily 08:00 | A-08 client comment overdue | Assignee, PL |
| 9 | On issue / approval | A-09 ready to invoice | Accounts, Owner, PL |
| 10 | Daily 08:00 | A-10 RFI due within 2 working days | Assignee |
| – | Monday 08:30 | Weekly owner summary | Owner |

The sweep is idempotent: running it twice in a day sends nothing twice (duplicates counted and skipped). Thresholds are set in Admin › Automation; the working calendar drives every working-day count. People choose instant, digest or off per event (mandatory events locked on) and quiet hours.

Video: chapter 15.

## W10 · Construction stage

| # | Who | Where | Action | System response |
|---|---|---|---|---|
| 1 | PL / DL / DC | Construction › RFIs | Log, answer; optionally start the next revision of linked sheets | Due flags (A-10); linked sheets restarted |
| 2 | Reviewer | Submittals › Review and stamp | Approved / approved as noted / revise and resubmit / rejected, notes | Stamped PDF |
| 3 | PL / DL | Site reports › File a site report | Attendees, weather, observations, photos | Photos compressed to ≤ 2 MB, EXIF/GPS removed; PDF export |
| 4 | PL | Change orders › Approve / reject | Cost, time, source RFI, sheets | Approved total; affected issued sheets start a new revision cycle |
| 5 | PL / DL | Clashes › Import BCF | Upload a Navisworks BCF file | New topics created, existing ones updated by GUID; assignee and status editable |

Video: chapter 16.

## W11 · Find and report

- **Command search** (⌘K/Ctrl+K) across visible projects: sheets, projects, transmittals, contacts, comments, RFIs, decisions, actions. Chapter 17.
- **Knowledge search** across decisions, client comments, RFIs and review comments with highlights. Chapter 17.
- **Baseline report** (D-05) by month and project with printed definitions; PDF export. Chapter 18.
- **Every list exports** to Excel, PDF or CSV; more than 5,000 rows run as a background job that emails a link. Chapters 05, 20.

## W12 · Intelligence (advisory)

| # | Capability | What happens | Human decision |
|---|---|---|---|
| 1 | Late-risk prediction (F-55) | Probability and reasons on open sheets | None needed; never changes data |
| 2 | Workload forecast (F-56) | 8-week forecast beside allocations, with measured error | Leads keep planning allocations |
| 3 | AI drawing checks (F-57) | Findings with confidence from title blocks and references | Accept (owner told) or dismiss |
| 4 | Admin modes and gate G3 | Off / evaluation / on, after ≥ 6 months and ≥ 2,000 issued revisions | Admin |

In the demo these are deterministic stand-ins, labelled Forecast / Advisory. Chapter 19.

## W13 · Administer the firm and onboard

| # | Who | Where | Action |
|---|---|---|---|
| 1 | Admin | Organisation, disciplines, stage templates, codes, naming rules (live tester), checklists, calendar | Configure the firm's rules |
| 2 | Admin | Users and roles | Invite (email), resend, withdraw; change org role; deactivate (never delete) |
| 3 | Invitee | Invitation email › Accept | Set a password or use SSO; sees projects once added to a team |
| 4 | Admin | Integrations | SSO, email, CAD plugins and tokens, file storage, BCF, accounting |
| 5 | Admin | Onboarding | Load a live project with historic revisions from a workbook and PDFs, silently |
| 6 | Admin / Owner | Audit trail | Search, filter, export (background job) |

Video: chapters 01 (two-factor), 13 (accounting), 15 (automation), 19 (intelligence), 20 (everything else).

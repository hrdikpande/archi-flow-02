# DrawingOps · route inventory

Every route in the demo (`demo/js/demo-app.js` `ROUTES`, hash-based: `demo/demo.html#/…`), with its screen, who can open it, what it is for, and where the walkthrough shows it. Screen IDs S-01…S-23 follow `DESIGN.md` §5. Production SPA routes in `frontend/src` mirror these paths without the hash.

## Public (no sign-in)

| Route | Screen | Who | Purpose | In the video |
|---|---|---|---|---|
| `#/sign-in` | S-01 Sign in | everyone | Microsoft SSO button, email + password, keep signed in, reveal password, link to forgot password; no public sign-up | 01 |
| `#/sign-in` (TOTP step) | S-01 | admins, local accounts | 6-digit authenticator code | 01 |
| `#/sso` | S-01 SSO picker | staff | Simulated Microsoft account picker (labelled) | 01 |
| `#/forgot` | Forgot password | local accounts | Request a 6-digit reset code by email | 01 |
| `#/reset` | Reset password | local accounts | Enter code and new password | not shown (same flow as forgot) |
| `#/invite/:token` | Accept invitation | invitees | Full name and password (or SSO) to join the firm | 20 |
| `#/t/:token[?r=contact]` | S-15 External transmittal page | external recipients | Transmittal details, download one/all (ZIP), cover sheet, acknowledge receipt; expired-link message | 11 |
| `#/site/:token` | S-18 Site view | anyone with the project link | Phone-first list of current issued revisions with search | 11 |
| `#/mailbox[?m=id]` | Demo mailbox (demo only) | anyone | Shows every email the product would send; stands in for SMTP | 11, 15, 20 (labelled as demonstration) |

## Signed in: firm-wide

| Route | Screen | Who (observed) | Purpose | In the video |
|---|---|---|---|---|
| `#/` | S-02 My work | everyone | Role-specific home: own sheets and next actions, returned sheets, checks waiting, ready to issue, ready to invoice, hours, latest notifications, admin set-up links | 01, 08, 09, 10, 13 |
| `#/portfolio[?lead=&type=&sort=&dir=]` | S-03 Portfolio (D-01) | Owner, PL, Admin | Five metrics, project table, discipline load, forecast | 02, 19, 21 |
| `#/sheets[?flag=late\|at_risk&state=&owner=&lead=&disc=&q=&p=]` | Sheets list | everyone | The list behind every dashboard number; filters, pagination, export | 02 |
| `#/disciplines/:code` | D-03 Discipline dashboard | everyone (built for DLs) | Late, at risk, check queue, approved not issued, assignments, capacity, workload forecast | 09, 19 |
| `#/projects[?state=&type=&q=]` | Projects list | everyone (visible projects) | Search, filters, export, New project | 04, 17 |
| `#/projects/new` | New project (F-01, F-02) | Owner, PL, Admin, staff who can lead | Create a project with stages from a template | 04 |
| `#/reviews[?open=reviewId&scope=&kind=&project=]` | S-08 Review queue | everyone (populated for checkers) | Queue oldest first, side-by-side review panel, return/approve, delegate | 09 |
| `#/workload[?disc=&project=&flag=&cell=]` | S-09 Workload | all except Accounts | Heat map, cell drawer, allocate, forecast | 14 |
| `#/workload/staff` | Staff directory (F-16) | all except Accounts | Discipline, capacity, leave | 14 |
| `#/timesheets[?w=]` | S-10 My timesheet | all except Admin | Week grid by project and stage, CSV import, submit | 14 |
| `#/timesheets/approvals` | S-10 Approvals | PL, DL | Approve, return, approve all, remind | 14 |
| `#/reports?tab=baseline\|hours\|util\|review\|missing&range=&from=&to=` | Reports (D-05) | Owner, Admin (all tabs); PL, DL (no baseline); Accounts (hours, review cycle) | Baseline metrics PDF, hours, utilisation, review cycle, missing timesheets | 18 |
| `#/knowledge[?q=]` | S-22 Knowledge search | everyone | Decisions, comments, RFIs, review comments | 17 |
| `#/intelligence/findings[?status=]` | S-23 Findings queue | everyone views; SR, DC, Admin decide | AI drawing-check findings, accept/dismiss | 19 |
| `#/billing` | S-17 Billing signals | Owner, Accounts, PL (own projects) | Ready to invoice, CSV, push to accounting, mark invoiced | 13 |
| `#/billing/invoiced` | S-17 Invoiced | Owner, Accounts, PL | Invoiced stages with references | 13 |
| `#/contacts[?c=]` | Contacts (F-43) | everyone | External people and organisations, add/edit, export | 17 |
| `#/settings/notifications` | S-13 Preferences | everyone | Instant/digest/off, mandatory locked, quiet hours, send digest now | 15 |
| `#/settings/profile` | Profile | everyone | Profile details and delegation | 09 (delegation) |
| `#/exports/:id` | Export job | the requester | Background export progress and download | 20 (job started) |
| Bell panel (no route) | S-13 Notification centre | everyone | Today/earlier, unread, mark all read | 02, 15 |
| ⌘K / Ctrl+K (no route) | Command palette (F-44) | everyone | Search sheets, projects, transmittals, contacts, comments, RFIs, decisions, actions | 17 |
| `?` (no route) | Keyboard shortcuts | everyone | Shortcut list | 21 |
| Account menu (no route) | Theme, density, profile, preferences, sign out | everyone | Light/dark/system, compact/comfortable | 21 |

## Signed in: inside a project (`#/projects/:pid/…`)

Accounts see only **Overview** and **Stages**. Everyone else on the project sees all tabs.

| Route | Screen | Who | Purpose | In the video |
|---|---|---|---|---|
| `#/projects/:pid[?disc=]` | S-04 Project overview (D-02) | members; Accounts (stages only) | Metrics, burn-up, stage timeline, late sheets, project card, team load, transmittals, comments, change orders, forecast, edit, full export | 03, 13 |
| `#/projects/:pid/register[?disc=&stage=&state=&owner=&pkg=&flag=&q=&group=&sort=&dir=&p=]` | S-05 Register | members (edit: PL, DL) | Register, filters, grouping, saved views, columns, inline edit, bulk bar, new sheet, export | 05 |
| `#/projects/:pid/import` | S-12 Import wizard | PL, DL | Upload, map columns, preview and fix, result with undo | 06 |
| `#/projects/:pid/upload` | Upload PDFs | PL, DL, DC | Drop PDFs, match by name or title block, naming checks, draft revisions | 06 |
| `#/projects/:pid/cad-sync` | CAD sync (F-09) | PL, DL | Revit/AutoCAD proposals, accept/reject, plugins, file-storage activity | 06 |
| `#/projects/:pid/sheets/:sid` | S-06 Sheet detail | members | PDF viewer, revisions, reviews, distribution, activity, CAD link, notes, AI checks, actions | 07, 08 |
| `#/projects/:pid/stages` | S-11 Stage plan | members (edit: PL, Owner, Admin) | Fee stages, 100% rule, template, appointment letter, client approvals | 04, 12 |
| `#/projects/:pid/team` | Team & hours | members (edit: PL, Admin) | Members, roles, hours, add/remove, external recipients | 04 |
| `#/projects/:pid/issue[?sheets=]` | S-07 Issue composer | DC, PL | Sheets, purpose, recipients, note, cover preview, issue | 10 |
| `#/projects/:pid/transmittals[?view=matrix&ack=0&purpose=&q=]` | Transmittal log | members | Log, matrix ("who has which revision"), filters, export | 10 |
| `#/projects/:pid/transmittals/:tid` | Transmittal detail | members | Recipients with delivery, download, acknowledgement; resend; correct with a new transmittal; cover | 10, 11 |
| `#/projects/:pid/activity[?person=&type=&disc=&n=]` | Activity feed (F-45) | members | Every event, newest first, filters | 04 |
| `#/projects/:pid/comments[?c=&overdue=1]` | S-16 Client comments | members (log: PL, DL, DC) | Comment log, overdue filter, log, respond, close, reject, simulated forwarded email, unknown-sender queue | 12 |
| `#/projects/:pid/decisions` | Decisions (F-58) | members | Decisions with context and sheets | 12 |
| `#/projects/:pid/construction[/rfis\|submittals\|site\|changes\|clashes]` | S-20, S-21 Construction | members | RFIs, submittals, site reports, change orders, BCF clashes | 16 |

## Admin (`#/admin/:section`)

All sections need the System admin role, except **Audit trail**, which the Owner can also open.

| Route | Section | Purpose | In the video |
|---|---|---|---|
| `#/admin` → `#/admin/organisation` | Organisation | Firm name, tagline, address, time zone, code format, capacity, digest time, link validity, acknowledgement days | 20 |
| `#/admin/disciplines` | Disciplines | Codes, names, sheet-number regex with live test, active | 20 |
| `#/admin/stage-templates` | Stage templates | Fee-stage templates and default | 20 |
| `#/admin/codes` | Revision and purpose codes | P/C revision scheme, purposes, ISO 19650 suitability | 20 |
| `#/admin/naming-rules` | Naming rules | Rules and live tester | 20 |
| `#/admin/checklists` | Checklists | Pre-check items per discipline and stage | 20 |
| `#/admin/intelligence` | Intelligence | Gate G3, modes for late-risk, workload forecast, AI checks | 19 |
| `#/admin/calendar` | Working calendar | Working week and holidays | 20 |
| `#/admin/automation` | Automation | Rules A-01…A-10, thresholds, run now, run log | 15 |
| `#/admin/users` | Users and roles | Org roles, sign-in method, last seen, invitations, deactivate | 20 |
| `#/admin/contacts` | Contacts | Same contact list as `#/contacts` | shown via `#/contacts` |
| `#/admin/integrations` | Integrations | SSO, email, CAD plugins, file storage, Forma/Bluebeam (conditional), BCF, accounting (columns, webhook, test), API tokens, pending decisions | 13, 20 |
| `#/admin/onboarding` | Onboarding | Template workbook, PDFs, problems, load silently | 20 |
| `#/admin/audit` | Audit trail | Search, filters, before/after, background export | 20 |

## Counts

- **46 route patterns** in the router (`ROUTES`): 8 public and 38 signed in. Through parameters they cover 9 project tabs, 5 construction sub-tabs, 5 report tabs and 14 admin sections.
- **23 design screens** (S-01…S-23), all present in the demo.
- **5 non-route surfaces**: notification panel, command palette, shortcuts dialog, account menu, demo menu (demo only, hidden in the video).

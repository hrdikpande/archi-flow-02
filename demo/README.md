# DrawingOps · interactive client demo

A standalone, clickable prototype of the **complete intended DrawingOps product**: drawing and deliverable control for an architecture and MEP design firm (sheet register, review states, transmittals, deadlines and alerts, workload and timesheets, fee stages and billing signals, dashboards, construction-stage logs, knowledge search and advisory forecasts).

> **This is a simulated prototype, not the production application.** It runs entirely in your browser on fictional data. It never calls the DrawingOps backend, never sends email, and never contacts Microsoft, Google, Autodesk or any accounting system. Sign-in is a simulation for trying the roles; it is not security.

## Launch

**Easiest:** double-click `demo/demo.html` (or drag it into a browser window). No server, build step or internet connection is needed: fonts, icons and documents are all local. Verified in Google Chrome and Chromium; current Edge, Firefox and Safari are supported but were not part of the automated test run, so rehearse once in the browser you will present with.

**Optional local server** (only if your browser blocks local files, for example some locked-down corporate browsers):

```bash
cd demo
python3 -m http.server 8000
# then open http://127.0.0.1:8000/demo.html
```

Use a recent desktop browser for the presentation; the demo also works on tablets and phones (390 px wide and up).

## Demo accounts

All accounts use the password **`Demo@2026`**. They are listed on the sign-in page under **Demo Access — Use These Credentials**, each with a **Fill** and a **Sign in** button.

| Role | Name | User ID (email) | What to show |
|---|---|---|---|
| Owner / Principal | Nikhil Prasad | `owner@firm.example` | Portfolio, reports, billing signals, everyone's hours, audit export |
| Project lead | Priya Sharma | `lead@firm.example` | Projects, stage plan and client approval, register planning, issue, team, approvals |
| Discipline lead (checker) | Anil Kapoor | `checker@firm.example` | Review queue, register, workload, timesheet approvals |
| Designer | Rahul Kumar | `designer@firm.example` | My work, start and submit sheets, returned redlines, own timesheet |
| Senior reviewer | Sunita Rao | `senior@firm.example` | Senior QC queue, delegation, AI drawing-check findings |
| Document controller | Deepa Chandra | `dc@firm.example` | Issue composer, transmittals, client comments |
| Accounts | Meera Thomas | `accounts@firm.example` | Billing signals, CSV export, mark invoiced |
| System admin | Asha Menon | `admin@firm.example` | All settings, users, integrations, audit trail. **2FA code: `246810`** |

Other ways in, all simulated: **Sign in with Microsoft** (pick a firm account), **Forgot password** (the 6-digit code arrives in the demo mailbox) and **invitations** (an admin invites someone; open the invitation from the demo mailbox). There is deliberately **no public sign-up**: in the product, accounts come from the firm's SSO or an admin invitation (docs/03 F-40, F-38).

## Suggested 15-minute walkthrough

Mirrors `docs/uat-script.md`. The **Demo** button (bottom-left) has a *Guided walkthrough* with the same steps.

1. **Owner** (`owner@`): Portfolio → click *Late sheets*; the list behind it has exactly that many rows. Open *2026-014 HSR Block B* → burn-up chart, stage timeline, late list.
2. **Designer** (`designer@`): My work → *Start* a planned sheet. Open *M-206* → *Submit for check* (tick the pre-check list). *M-204* is under *Returned to you* with the checker's comment.
3. **Discipline lead** (`checker@`): Reviews → open the oldest → *Return* (comment required) or *Approve* (Working drawings need senior QC as a second step).
4. **Document controller** (`dc@`): HSR Block B › Transmittals › *Issue sheets*. A-104 is blocked by the naming rule (*Rename*), E-102 has no PDF (*Add PDF*). Choose purpose GFC → preview the cover sheet → *Issue*. Earlier revisions become superseded.
5. **Client** (no login): Demo › *Demo mailbox* → open the transmittal email → download a drawing or *Download all (ZIP)* → *Acknowledge receipt*.
6. **Project lead** (`lead@`): *2026-003 Mysuru Heritage Hotel* › Stages → *Record client approval* (attach `assets/documents/sample-client-approval-letter.pdf`) → the stage becomes **Ready to invoice**.
7. **Accounts** (`accounts@`): Billing → *Export CSV* → *Mark invoiced*.
8. **Admin** (`admin@`, code `246810`): Naming rules (live tester), Working calendar, Automation (*Run the daily sweep now*; run it twice: nothing is sent twice), Users (*Invite*), Audit trail.

Also worth showing: **⌘K / Ctrl+K** search (try `A-101` or `OT duct`), the register's bulk actions and inline edits with *Undo*, *Import Excel* with `assets/documents/sample-register-import.xlsx` (it has 3 deliberate errors), Workload heat map → click a cell → *Copy to next 3 weeks*, Knowledge search for `OT ceiling HEPA`, Koramangala Tech Park › Construction (RFIs, submittals, site reports, change orders, BCF clash import with `assets/documents/sample-clashes.bcfzip`), and dark mode (account menu, top right).

## How the simulation works

| Area | What happens in the demo |
|---|---|
| **Authentication** | Credentials are checked in the browser against the demo accounts. Sessions live in `sessionStorage` (or `localStorage` with *Keep me signed in*). Protected pages redirect to sign-in. Roles drive navigation, visible data and the actions on every sheet. |
| **Data** | A deterministic seed creates 1 firm, 27 people, 18 external contacts, 9 projects with fee stages, ~750 sheets with full revision and review history, ~300 transmittals, allocations, timesheets, client comments, RFIs, submittals, site reports, change orders, clashes, decisions and AI findings. Dates are generated relative to the day you first open (or reset) the demo, so flags such as *Late 2 days* stay meaningful. Every dashboard number is computed from these records. |
| **Persistence** | Changes are saved in this browser's `localStorage` (key `drawingops-demo-state`, about 2.3 MB) and survive a refresh. Other browsers and computers start fresh. |
| **Reset** | **Demo › Reset demo data** (or *Reset demo data* on the sign-in page) restores the starting state. Only the demo's own browser storage is touched. |
| **Drawings and PDFs** | Every sheet revision has a real, generated A3 vector PDF (grid, rooms, discipline-specific services, full title block). The sheet page shows it in the browser's built-in PDF viewer, with *Download* and *New tab*. Superseded revisions show a red banner and download with a diagonal **SUPERSEDED** watermark and date. Transmittal cover sheets, stamped submittals, site reports, redline files and the baseline report are generated PDFs too. |
| **Uploads** | Upload PDFs, import Excel/CSV, attach evidence, upload site photos and import BCF files with the normal file picker or drag and drop. Files are checked (PDF magic bytes, 200 MB limit, naming rules, SHA-256 duplicate check) and kept in memory for the session. Photos are re-encoded to ≤ 2 MB, which also strips EXIF/GPS. Nothing is uploaded anywhere. |
| **Exports** | *Export* menus produce real files: Excel `.xlsx`, PDF and CSV with the current filters, ZIP of a transmittal, and a full project export (JSON + issued PDFs). Exports over 5,000 rows (for example the audit trail) run as a background job and "email" a link to the demo mailbox. |
| **Email** | Every email the product would send (transmittals, new-revision notices, notifications, digests, resets, invitations, weekly owner summary) appears in **Demo › Demo mailbox** instead. |
| **Automations** | At-risk and late flags (A-01, A-02) are computed live. *Run the 08:00 daily sweep now* sends the reminders and escalations (A-01, A-02, A-06, A-07, A-08, A-10) and is idempotent. Supersede (A-03), naming checks (A-04), allocation flags (A-05) and the ready-to-invoice signal (A-09) happen as you work. |
| **Integrations** | SSO, SMTP, inbound email, CAD plugins (Revit/AutoCAD sync proposals), the file-storage watcher and the accounting webhook are simulated and labelled as such. |
| **Forecasts** | Late-risk percentages, workload forecasts and AI drawing-check findings are deterministic stand-ins for the Phase 4 models, always labelled *Forecast* / *Advisory*. |

## Files

```text
demo/
├── demo.html               entry point (classic scripts, no build, works from file://)
├── README.md               this file
├── feature-coverage.md     every tracker item → demo screen → verification
├── css/                    tokens.css (copied from frontend/src/styles) and demo.css
├── js/
│   ├── lib/                core helpers, PDF writer, ZIP/XLSX, drawing generator, Lucide icons
│   ├── demo-data.js        deterministic seed data
│   ├── demo-state.js       store, state machine, issue, stage rules, automations, audit
│   ├── demo-auth.js        simulated sign-in, SSO, TOTP, reset, invitations
│   ├── demo-components.js  chips, flags, tables, dialogs, drawers, toasts, charts, exports
│   ├── demo-app.js         router, app shell, ⌘K palette, notifications, demo controls
│   └── screens/            one file per module
├── assets/
│   ├── fonts/              Inter and IBM Plex Mono (SIL OFL, licences included)
│   ├── images/             logo (from frontend/public) and illustrative site photos
│   └── documents/          sample register (.xlsx/.csv), onboarding workbook, sample PDFs,
│                           client approval letter, BCF clash file, timesheet CSV
└── qa/                     Playwright checks used to verify the demo
```

## Verification

The demo was checked with Playwright (Chromium) and axe-core. To re-run from the repository root (needs `frontend/node_modules`; run `cd frontend && npx playwright install chromium` once):

```bash
node demo/qa/smoke.cjs     # every route for four roles, zero JS errors
node demo/qa/flows.cjs     # 50 end-to-end checks (auth, review, issue, import, upload, billing, …)
node demo/qa/flows2.cjs    # 35 more (construction logs, BCF, comments, admin, onboarding, …)
node demo/qa/resp.cjs      # 390 / 820 / 1280 px layouts, no horizontal overflow
node demo/qa/axe.cjs       # WCAG 2.2 AA scan of 9 key screens
```

Last run (26-Oct-2026): 85/85 workflow checks passed, 0 JavaScript errors, 0 axe violations, no horizontal overflow at any tested width. The built-in PDF viewer was checked in Google Chrome.

## Limitations

- It is a front-end simulation: permissions are enforced in the browser only, and nothing here is secure or multi-user. Two people on two computers each see their own copy.
- Files you upload are kept for the session only; after a refresh the revision record remains and its preview falls back to the generated drawing.
- The in-page PDF viewer is the browser's own. Chrome, Edge, Firefox and desktop Safari show it inline; on some phones use *New tab* or *Download*.
- Reading `.xlsx` uploads needs a browser from 2023 or later (it uses `DecompressionStream`); `.csv` works everywhere.
- Opening the demo for the first time on another day moves all dates with it; reset the demo to re-anchor dates to today.
- Real integrations (SSO, email, CAD plugins, accounting, BCF from Navisworks) are represented by simulations; see `feature-coverage.md` for exactly what is simulated.

All people, firms, projects, contacts and amounts are fictional. No production code, database, configuration or document was changed to build this demo.

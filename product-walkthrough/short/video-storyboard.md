# DrawingOps · 12-minute cut · video storyboard

Chapter order, scenes, on-screen actions and narration for `drawingops-walkthrough-12min.mp4` (1920×1080, 30 fps). Generated from the recorded timeline, so times, screens and actions are what the video actually shows. Screens are demo routes (`demo/demo.html#…`); `(card)` is a title or explainer card rendered in the product's own design tokens.

| # | Chapter | Starts | Length | Main role on screen |
|---|---|---|---|---|
| 00 | Introduction | 00:00 | 00:46 | Cards |
| 01 | Signing in and roles | 00:46 | 00:29 | Nikhil Prasad · Owner / Principal |
| 02 | The owner's portfolio | 01:16 | 00:59 | Nikhil Prasad · Owner / Principal |
| 03 | Projects, fee stages and teams | 02:15 | 00:54 | Nikhil Prasad · Owner / Principal; Priya Sharma · Project lead |
| 04 | The register and drawing management | 03:09 | 01:26 | Priya Sharma · Project lead |
| 05 | Drafting and checking | 04:36 | 00:36 | Rahul Kumar · Designer (HVAC); Anil Kapoor · Discipline lead (Architecture); Sunita Rao · Senior reviewer |
| 06 | Issue and issue tracking | 05:12 | 01:09 | Sunita Rao · Senior reviewer; Deepa Chandra · Document controller |
| 07 | The client's side | 06:22 | 00:35 | Deepa Chandra · Document controller; Dr. Vikram Nair · Client · Navjeevan Health Trust |
| 08 | Client comments and approvals | 06:57 | 00:23 | Deepa Chandra · Document controller; Priya Sharma · Project lead |
| 09 | Billing signals | 07:21 | 00:46 | Priya Sharma · Project lead; Asha Menon · System admin; Meera Thomas · Accounts |
| 10 | Everything else, in brief | 08:07 | 00:51 | Priya Sharma · Project lead; Nikhil Prasad · Owner / Principal; Asha Menon · System admin |
| 11 | Email: how everything stays tracked | 08:59 | 01:25 | Deepa Chandra · Document controller; Priya Sharma · Project lead; Rahul Kumar · Designer (HVAC) |
| 12 | How the roles work together | 10:24 | 00:53 | Priya Sharma · Project lead; Meera Thomas · Accounts; Nikhil Prasad · Owner / Principal |
| 13 | Close | 11:17 | 00:23 | Nikhil Prasad · Owner / Principal |

## 00 · Introduction

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 00:00 | (card) | hold | This is DrawingOps: drawing and deliverable control for architecture and MEP design firms. It works alongside AutoCAD and Revit, and gives everyone one live record of every sheet, review, transmittal, deadline and fee stage. |
| 00:17 | (card) | hold | Everything revolves around the sheet. Every sheet moves through the same states, from planned to issued, and fee stages move with their sheets, all the way to ready to invoice. |
| 00:27 | (card) | hold | It was recorded in the interactive prototype with fictional data. Outside connections, such as Microsoft sign-in, email delivery, the CAD plugins and accounting, are simulated, and labelled where they appear. Every part is covered briefly, and the core of daily work in detail. |

## 01 · Signing in and roles

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 00:46 | (card) | hold | Part one, in brief: signing in, and roles. |
| 00:50 | `#/sign-in` | highlight | Staff sign in with the firm's Microsoft or Google account, and administrators add an authenticator code. There is no public sign-up. |
| 00:59 | (card) | hold | Eight roles share one system, from owner to accounts. Clients, consultants and contractors need no account at all. |
| 01:06 | `#/` | highlight | Navigation follows the role. Rahul, a designer, sees his own work. Nikhil, the owner, also sees the portfolio, reports and billing. |

## 02 · The owner's portfolio

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 01:16 | (card) | hold | Part two, in detail: the owner's portfolio. |
| 01:19 | `#/portfolio` | hold | The portfolio is the owner's home page: every active project in the firm, on one page. |
| 01:26 | (same screen) | zoom in; highlight | Five numbers lead the page. 20 sheets are late, and 22 are at risk. The oldest review has waited 5 days. 2 people over-allocated this week, and 2 stages are ready to invoice. |
| 01:38 | `#/sheets?flag=late` | click a.metric >> nth=0; zoom in | Every number opens the exact list behind it. Late and at risk are computed each morning from planned dates and the working calendar. |
| 01:46 | `#/portfolio` | zoom in | The projects table shows each project's fee stage, progress, late and at-risk counts, lead and next stage date. Every count opens that project's register, already filtered. |
| 01:58 | (same screen) | zoom in | Below, discipline workload shows which teams are over capacity, and an advisory forecast lists the sheets most likely to slip, with its reasons. |
| 02:08 | `#/portfolio` | click [data-act=export-late]; zoom in; click [data-act=notifications] | The late list exports to Excel, PDF or CSV, and the bell collects the owner's alerts. |

## 03 · Projects, fee stages and teams

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 02:15 | (card) | hold | Part three, in detail: projects, fee stages and teams. |
| 02:19 | `#/projects/p1` | click main table a[href="#/projects/p1"]; zoom in | Opening a project shows its dashboard. HSR Block B, a hospital, is in stage four, working drawings. The headline numbers show progress against plan, late sheets, sheets waiting for check, unacknowledged transmittals and open client comments. |
| 02:36 | `#/projects/p1` | zoom in | The burn-up chart compares planned and issued sheets, and the stage timeline shows each fee stage with its share of the fee, dates and state. |
| 02:44 | `#/projects/p1/stages` | zoom in | Priya, the project lead, creates projects from a fee-stage template. The stage plan mirrors the appointment letter: each stage's share and amount, dates, required issue purposes, and senior QC. Stages move by themselves as their sheets move. |
| 03:00 | `#/projects/p1/team`<br>`#/projects/p1/activity` | hold | The team tab controls who can access the project, with each person's role and load, and the activity feed records every change. |

## 04 · The register and drawing management

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 03:09 | (card) | hold | Part four, in detail: the drawing register. |
| 03:12 | `#/projects/p1/register` | zoom in | The register is the heart of DrawingOps: every sheet the firm owes, with its owner, checker, state, planned date, revision and flags. All one hundred and thirty-two sheets render instantly. |
| 03:25 | `#/projects/p1/register?q=OT+duct`<br>`#/projects/p1/register?disc=M`<br>`#/projects/p1/register?disc=M&flag=late` | type "OT duct"; choose M in select[data-change=reg-f][data-k=disc] | Search covers numbers, titles and owners: OT duct finds the operating-theatre ductwork. Filters combine, and here are the late HVAC sheets. |
| 03:35 | `#/projects/p1/register?state=planned` | choose u_pl in select.cell[data-k=ownerId] >> nth=1; zoom in; click input[data-act=reg-sel] >> nth=0; click input[data-act=reg-sel] >> nth=1; click input[data-act=reg-sel] >> nth=2; click input[data-act=reg-sel] >> nth=3 | Owners, checkers and dates edit in place, audited and undoable. Selecting sheets brings up the bulk bar: assign, shift dates on the working calendar, change state, issue or export. |
| 03:47 | `#/projects/p1/import` | click [data-act=bulk-clear]; click [data-act=imp-sample]; click [data-act=imp-preview]; zoom in | Most firms start from Excel. The import wizard checks every row before anything is created, and explains each problem in plain words. |
| 03:56 | `#/projects/p1/upload` | upload M-206_C01.pdf, scan_0042.pdf, A104 ground floor rev.pdf; zoom in; click [data-act=up-go] | PDFs are matched to their sheets by file name, or by reading a scan's title block, and become draft revisions. A file that breaks the naming rule cannot be issued until it is renamed. |
| 04:09 | `#/projects/p1/cad-sync` | zoom in | Sheet lists can also sync from Revit and AutoCAD, simulated here, as proposals that a lead accepts. |
| 04:16 | `#/projects/p1/sheets/s89` | zoom in | Each sheet has its own page. M-205 is in progress and late by 2 working days. The current drawing opens in the built-in viewer, beside every review and a record of who holds which revision. |
| 04:29 | `#/projects/p1/sheets/s89` | click [data-act=sd-rev] >> nth=-1; zoom in | An older revision shows a superseded banner, and every download of it is stamped SUPERSEDED. |

## 05 · Drafting and checking

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 04:36 | (card) | hold | Part five, in brief: drafting and checking. |
| 04:39 | `#/` | click button[data-act=quick-transition][data-a=start] >> nth=0 | Rahul's My work lists his sheets by due date, with the next action on each. Starting one is a single click. |
| 04:46 | `#/projects/p1/sheets/s90` | click #sd-submit; zoom in; click .dialog-foot .btn.primary | Submitting M-206 for check needs the discipline's pre-check list ticked. Karthik, the HVAC checker, is notified at once. |
| 04:55 | `#/reviews`<br>`#/reviews?open=rv8299`<br>`#/reviews?open=rv8313` | zoom in; click #rq-approve-btn | Anil checks his queue oldest first, and every return carries a comment or redline. Approving A-107 sends it on to senior QC, which stage four requires. |
| 05:06 | `#/reviews?open=rv_mvt1wc8z1ioa`<br>`#/reviews?open=rv8331` | click #rq-approve-btn | Sunita, the senior reviewer, approves it, and A-107 is approved for issue. |

## 06 · Issue and issue tracking

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 05:12 | (card) | hold | Part six, in detail: issue, and issue tracking. |
| 05:16 | `#/` | zoom in | Deepa, the document controller, sees the approved sheets ready to issue. |
| 05:21 | `#/projects/p1/issue` | click main a.btn[href="#/projects/p1/issue"]; zoom in; highlight | The issue composer reserves the next transmittal number. A-104 is blocked by the naming rule, and E-102 has no PDF yet. |
| 05:30 | `#/projects/p1/issue` | click [data-act=sd-rename]; click [data-act=ic-all]; choose GFC in select[data-change=ic-purpose]; zoom in | One click renames A-104's file, and all approved sheets are selected. Every issue needs a purpose, here good for construction, and recipients get a secure link by email. |
| 05:42 | `#/projects/p1/issue` | click [data-act=ic-preview]; zoom in | The cover sheet previews exactly as recipients will receive it. |
| 05:47 | `#/projects/p1/issue` | click [data-act=ic-issue]; zoom in; click #cf-ok | One confirmation issues the set on a single transmittal. In the same step, earlier revisions are superseded, recipients are emailed, and anyone holding an older revision is told. |
| 05:59 | `#/projects/p1/transmittals`<br>`#/projects/p1/transmittals?view=matrix` | zoom in; click [data-act=tm-view][data-v=matrix] | The transmittal log tracks every issue, its recipients and acknowledgements, including bounced emails. The matrix shows which revision each recipient holds. |
| 06:09 | `#/projects/p1/transmittals/tm_mvt1wq2v1w67` | zoom in | Each transmittal records delivery, download and acknowledgement times per recipient. Unacknowledged transmittals are flagged, and a sent transmittal is never edited: a correction is a new one. |

## 07 · The client's side

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 06:22 | (card) | hold | Part seven, in detail: the client's side. No account, and nothing to install. |
| 06:27 | `#/mailbox`<br>`#/mailbox?m=em_mvt1wq2v2alj` | click a.mail-item:has-text("2026-014-TR-0033"):has-text("Vikram") >> nth=0; zoom in | The client receives an ordinary email with a secure link, shown here in the demonstration mailbox. |
| 06:34 | `#/t/twf860uupn0?r=k_vn` | click .email-frame a.btn.primary; click [data-act=ext-zip] | The link opens the transmittal, with every drawing and its revision. Drawings download one at a time, or as a zip with the cover sheet. |
| 06:43 | `#/t/twf860uupn0?r=k_vn` | click [data-act=ext-ack]; zoom in | Acknowledging receipt records the date and time. |
| 06:46 | (card) | hold | On site, a phone view shows only the current issued set, so nobody builds from a superseded sheet. |
| 06:53 | `#/projects/p1/transmittals/tm_mvt1wq2v1w67` | zoom in | Back in DrawingOps, Deepa already sees the acknowledgement. |

## 08 · Client comments and approvals

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 06:57 | (card) | hold | Part eight, in brief: client comments and stage approvals. |
| 07:01 | `#/projects/p1/comments` | zoom in | Client comments from any channel are logged, linked to sheets and assigned. Each closes only with a written response, and overdue ones are flagged. |
| 07:11 | `#/projects/p5/stages` | click [data-act=sp-approve]; upload sample-client-approval-letter.pdf; zoom in; click .dialog-foot .btn.primary | When every deliverable of a stage is issued, Priya records the client's approval, with the letter as evidence, and the Mysuru stage becomes ready to invoice. |

## 09 · Billing signals

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 07:21 | (card) | hold | Part nine, in detail: billing signals. |
| 07:24 | `#/admin/integrations` | zoom in | The administrator connects the accounting system once, with a webhook address that is checked for safety. It is simulated here. |
| 07:32 | `#/`<br>`#/billing` | zoom in | Meera, in Accounts, sees what is ready to invoice on her home page. Each signal shows the stage, its share of the fee, the amount, the wait, and the client approval, including the Mysuru stage approved a moment ago. |
| 07:46 | `#/billing` | click [data-act=bl-csv]; click [data-act=bl-push]; zoom in | Signals export as CSV, or push to the accounting system as a signed message, shown here instead of sent. |
| 07:53 | `#/billing` | click .dialog-foot .btn.primary; click [data-act=bl-mark] >> nth=0; zoom in | When the invoice is raised, Meera records its reference, and the stage's fee percentage locks. |
| 08:00 | `#/billing/invoiced`<br>`#/projects/p1` | highlight | Invoicing and tax stay in the accounting software, and Accounts never sees drawings or individual hours. |

## 10 · Everything else, in brief

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 08:07 | (card) | hold | Part ten, in brief: everything else. |
| 08:10 | `#/workload` | zoom in | Workload shows planned hours against capacity, eight weeks ahead, and weekly timesheets build on it. |
| 08:17 | `#/projects/p4/construction/rfis` | zoom in | On site, RFIs, submittals, site reports, change orders and clashes link to the sheets they affect. |
| 08:25 | `#/projects` | type "A-101"; zoom in | Control K finds anything, and knowledge search finds the reasoning behind past decisions. |
| 08:31 | `#/reports?tab=baseline` | zoom in | Reports track the four baseline measures the firm agreed to improve. |
| 08:36 | `#/admin/automation` | zoom in | Ten automation rules run themselves, and running a sweep twice never sends anything twice. |
| 08:42 | `#/admin/intelligence` | zoom in | Forecasts and AI drawing checks are advisory, labelled, and gated on the firm's own history. The figures here are simulated. |
| 08:51 | `#/admin/audit` | zoom in | And administrators manage users, rules and integrations, with every change in an insert-only audit trail. |

## 11 · Email: how everything stays tracked

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 08:59 | (card) | hold | Part eleven, in detail: email. DrawingOps works through the inbox people already use. It sends every alert and transmittal, logs client emails that come in, and tracks each one. |
| 09:11 | `#/mailbox` | zoom in | The demonstration mailbox collects every email the product sends: transmittals, notifications, revision notices, digests and summaries. In production they go through the firm's own mail server; here, nothing is actually sent. |
| 09:26 | `#/mailbox?m=em_mvt1w6me1bn1` | choose karthik.iyer@firm.example in select[data-change=mail-filter]; click a.mail-item:has-text("M-206") >> nth=0; zoom in | Filtering by recipient shows what each person received. When Rahul submitted M-206, Karthik, the HVAC checker, was emailed at once, with a button that opens the sheet in DrawingOps. |
| 09:39 | `#/mailbox?m=em_mvt1x5ij3679` | choose accounts@firm.example in select[data-change=mail-filter]; click a.mail-item:has-text("Ready to invoice") >> nth=0; zoom in | Meera's ready-to-invoice alert arrived the same way. Must-not-miss alerts like this one are always sent instantly. |
| 09:46 | `#/projects/p1/transmittals/tm8635` | zoom in; highlight; click main section.card:has-text("Recipients") tr:has(.pill.bad) [data-act=td-resend] | Transmittal emails are tracked per recipient. One email on the previous HSR transmittal bounced. It shows here, and Deepa resends it with one click. |
| 09:56 | `#/projects/p1/comments` | highlight; click [data-act=cm-sim]; click [data-act=cm-queue]; zoom in; click [data-act=iq-accept] >> nth=0 | Email comes in, too. A client email forwarded to the project's own address is logged as a comment, matched to the sender; that is simulated here. Unknown senders wait in a queue until accepted. |
| 10:09 | `#/settings/notifications`<br>`#/mailbox?m=em_mvt1y4ss42rb` | zoom in; click [data-act=pf-digest] | Each person chooses instant alerts, a morning digest, or none, with critical alerts locked on. Rahul's digest gathers the rest into one email. |
| 10:19 | `#/mailbox?m=em_mvt1uv4ypox` | zoom in | And every Monday, the owner gets a weekly summary by email. |

## 12 · How the roles work together

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 10:24 | (card) | hold | Part twelve: how the roles work together. Each role owns one part of a sheet's journey, and every hand-off tells the next person, in the app and by email. Nobody chases anybody. |
| 10:35 | `#/` | click [data-act=notifications]; zoom in; highlight | In this recording, that chain ran end to end. Sunita's bell shows the senior QC request for A-107, sent the moment Anil approved it. |
| 10:45 | `#/` | click [data-act=notifications]; zoom in; highlight | Deepa was told A-107 was ready to issue, and that the client had acknowledged 2026-014-TR-0033. |
| 10:57 | `#/` | click [data-act=notifications]; zoom in; highlight | Priya, the project lead, gets a copy of every transmittal and acknowledgement on her projects. |
| 11:03 | `#/` | click [data-act=notifications]; zoom in; highlight | Meera was told the moment the Mysuru stage was ready to invoice. |
| 11:08 | `#/projects/p1/activity` | zoom in | And Nikhil sees the whole chain in the project's activity feed. Each person sees only what their role allows, so hand-offs are quick and safe. |

## 13 · Close

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 11:17 | (card) | hold | Underneath, permissions are enforced on the server, issued files never change, the audit trail is insert-only, and every project exports in full. |
| 11:27 | (card) | hold | DrawingOps gives the whole firm one live record of every sheet, from planned to invoiced. It is built by LatentIQ. To see it with your own projects, talk to the LatentIQ team. Thank you for watching. |

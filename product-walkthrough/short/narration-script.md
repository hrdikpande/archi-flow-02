# DrawingOps · 12-minute cut · narration script

The complete narration, in the order and at the times it plays in `drawingops-walkthrough-12min.mp4`. Generated from the recording (`pipeline/report.py`), so it always matches the video. The same text is burned into the picture as subtitles and saved as `drawingops-walkthrough-12min.srt`.

Voice: Kokoro-82M (Apache-2.0), voice `af_heart`, synthesised offline. Total running time 11:42.

## 00 · Introduction  (00:00)

**[00:00]** This is DrawingOps: drawing and deliverable control for architecture and MEP design firms. It works alongside AutoCAD and Revit, and gives everyone one live record of every sheet, review, transmittal, deadline and fee stage.

**[00:17]** Everything revolves around the sheet. Every sheet moves through the same states, from planned to issued, and fee stages move with their sheets, all the way to ready to invoice.

**[00:27]** It was recorded in the interactive prototype with fictional data. Outside connections, such as Microsoft sign-in, email delivery, the CAD plugins and accounting, are simulated, and labelled where they appear. Every part is covered briefly, and the core of daily work in detail.

## 01 · Signing in and roles  (00:46)

**[00:46]** Part one, in brief: signing in, and roles.

**[00:50]** Staff sign in with the firm's Microsoft or Google account, and administrators add an authenticator code. There is no public sign-up.

**[00:59]** Eight roles share one system, from owner to accounts. Clients, consultants and contractors need no account at all.

**[01:06]** Navigation follows the role. Rahul, a designer, sees his own work. Nikhil, the owner, also sees the portfolio, reports and billing.

## 02 · The owner's portfolio  (01:16)

**[01:16]** Part two, in detail: the owner's portfolio.

**[01:19]** The portfolio is the owner's home page: every active project in the firm, on one page.

**[01:26]** Five numbers lead the page. 20 sheets are late, and 22 are at risk. The oldest review has waited 5 days. 2 people over-allocated this week, and 2 stages are ready to invoice.

**[01:38]** Every number opens the exact list behind it. Late and at risk are computed each morning from planned dates and the working calendar.

**[01:46]** The projects table shows each project's fee stage, progress, late and at-risk counts, lead and next stage date. Every count opens that project's register, already filtered.

**[01:58]** Below, discipline workload shows which teams are over capacity, and an advisory forecast lists the sheets most likely to slip, with its reasons.

**[02:08]** The late list exports to Excel, PDF or CSV, and the bell collects the owner's alerts.

## 03 · Projects, fee stages and teams  (02:15)

**[02:15]** Part three, in detail: projects, fee stages and teams.

**[02:19]** Opening a project shows its dashboard. HSR Block B, a hospital, is in stage four, working drawings. The headline numbers show progress against plan, late sheets, sheets waiting for check, unacknowledged transmittals and open client comments.

**[02:36]** The burn-up chart compares planned and issued sheets, and the stage timeline shows each fee stage with its share of the fee, dates and state.

**[02:44]** Priya, the project lead, creates projects from a fee-stage template. The stage plan mirrors the appointment letter: each stage's share and amount, dates, required issue purposes, and senior QC. Stages move by themselves as their sheets move.

**[03:00]** The team tab controls who can access the project, with each person's role and load, and the activity feed records every change.

## 04 · The register and drawing management  (03:09)

**[03:09]** Part four, in detail: the drawing register.

**[03:12]** The register is the heart of DrawingOps: every sheet the firm owes, with its owner, checker, state, planned date, revision and flags. All one hundred and thirty-two sheets render instantly.

**[03:25]** Search covers numbers, titles and owners: OT duct finds the operating-theatre ductwork. Filters combine, and here are the late HVAC sheets.

**[03:35]** Owners, checkers and dates edit in place, audited and undoable. Selecting sheets brings up the bulk bar: assign, shift dates on the working calendar, change state, issue or export.

**[03:47]** Most firms start from Excel. The import wizard checks every row before anything is created, and explains each problem in plain words.

**[03:56]** PDFs are matched to their sheets by file name, or by reading a scan's title block, and become draft revisions. A file that breaks the naming rule cannot be issued until it is renamed.

**[04:09]** Sheet lists can also sync from Revit and AutoCAD, simulated here, as proposals that a lead accepts.

**[04:16]** Each sheet has its own page. M-205 is in progress and late by 2 working days. The current drawing opens in the built-in viewer, beside every review and a record of who holds which revision.

**[04:29]** An older revision shows a superseded banner, and every download of it is stamped SUPERSEDED.

## 05 · Drafting and checking  (04:36)

**[04:36]** Part five, in brief: drafting and checking.

**[04:39]** Rahul's My work lists his sheets by due date, with the next action on each. Starting one is a single click.

**[04:46]** Submitting M-206 for check needs the discipline's pre-check list ticked. Karthik, the HVAC checker, is notified at once.

**[04:55]** Anil checks his queue oldest first, and every return carries a comment or redline. Approving A-107 sends it on to senior QC, which stage four requires.

**[05:06]** Sunita, the senior reviewer, approves it, and A-107 is approved for issue.

## 06 · Issue and issue tracking  (05:12)

**[05:12]** Part six, in detail: issue, and issue tracking.

**[05:16]** Deepa, the document controller, sees the approved sheets ready to issue.

**[05:21]** The issue composer reserves the next transmittal number. A-104 is blocked by the naming rule, and E-102 has no PDF yet.

**[05:30]** One click renames A-104's file, and all approved sheets are selected. Every issue needs a purpose, here good for construction, and recipients get a secure link by email.

**[05:42]** The cover sheet previews exactly as recipients will receive it.

**[05:47]** One confirmation issues the set on a single transmittal. In the same step, earlier revisions are superseded, recipients are emailed, and anyone holding an older revision is told.

**[05:59]** The transmittal log tracks every issue, its recipients and acknowledgements, including bounced emails. The matrix shows which revision each recipient holds.

**[06:09]** Each transmittal records delivery, download and acknowledgement times per recipient. Unacknowledged transmittals are flagged, and a sent transmittal is never edited: a correction is a new one.

## 07 · The client's side  (06:22)

**[06:22]** Part seven, in detail: the client's side. No account, and nothing to install.

**[06:27]** The client receives an ordinary email with a secure link, shown here in the demonstration mailbox.

**[06:34]** The link opens the transmittal, with every drawing and its revision. Drawings download one at a time, or as a zip with the cover sheet.

**[06:43]** Acknowledging receipt records the date and time.

**[06:46]** On site, a phone view shows only the current issued set, so nobody builds from a superseded sheet.

**[06:53]** Back in DrawingOps, Deepa already sees the acknowledgement.

## 08 · Client comments and approvals  (06:57)

**[06:57]** Part eight, in brief: client comments and stage approvals.

**[07:01]** Client comments from any channel are logged, linked to sheets and assigned. Each closes only with a written response, and overdue ones are flagged.

**[07:11]** When every deliverable of a stage is issued, Priya records the client's approval, with the letter as evidence, and the Mysuru stage becomes ready to invoice.

## 09 · Billing signals  (07:21)

**[07:21]** Part nine, in detail: billing signals.

**[07:24]** The administrator connects the accounting system once, with a webhook address that is checked for safety. It is simulated here.

**[07:32]** Meera, in Accounts, sees what is ready to invoice on her home page. Each signal shows the stage, its share of the fee, the amount, the wait, and the client approval, including the Mysuru stage approved a moment ago.

**[07:46]** Signals export as CSV, or push to the accounting system as a signed message, shown here instead of sent.

**[07:53]** When the invoice is raised, Meera records its reference, and the stage's fee percentage locks.

**[08:00]** Invoicing and tax stay in the accounting software, and Accounts never sees drawings or individual hours.

## 10 · Everything else, in brief  (08:07)

**[08:07]** Part ten, in brief: everything else.

**[08:10]** Workload shows planned hours against capacity, eight weeks ahead, and weekly timesheets build on it.

**[08:17]** On site, RFIs, submittals, site reports, change orders and clashes link to the sheets they affect.

**[08:25]** Control K finds anything, and knowledge search finds the reasoning behind past decisions.

**[08:31]** Reports track the four baseline measures the firm agreed to improve.

**[08:36]** Ten automation rules run themselves, and running a sweep twice never sends anything twice.

**[08:42]** Forecasts and AI drawing checks are advisory, labelled, and gated on the firm's own history. The figures here are simulated.

**[08:51]** And administrators manage users, rules and integrations, with every change in an insert-only audit trail.

## 11 · Email: how everything stays tracked  (08:59)

**[08:59]** Part eleven, in detail: email. DrawingOps works through the inbox people already use. It sends every alert and transmittal, logs client emails that come in, and tracks each one.

**[09:11]** The demonstration mailbox collects every email the product sends: transmittals, notifications, revision notices, digests and summaries. In production they go through the firm's own mail server; here, nothing is actually sent.

**[09:26]** Filtering by recipient shows what each person received. When Rahul submitted M-206, Karthik, the HVAC checker, was emailed at once, with a button that opens the sheet in DrawingOps.

**[09:39]** Meera's ready-to-invoice alert arrived the same way. Must-not-miss alerts like this one are always sent instantly.

**[09:46]** Transmittal emails are tracked per recipient. One email on the previous HSR transmittal bounced. It shows here, and Deepa resends it with one click.

**[09:56]** Email comes in, too. A client email forwarded to the project's own address is logged as a comment, matched to the sender; that is simulated here. Unknown senders wait in a queue until accepted.

**[10:09]** Each person chooses instant alerts, a morning digest, or none, with critical alerts locked on. Rahul's digest gathers the rest into one email.

**[10:19]** And every Monday, the owner gets a weekly summary by email.

## 12 · How the roles work together  (10:24)

**[10:24]** Part twelve: how the roles work together. Each role owns one part of a sheet's journey, and every hand-off tells the next person, in the app and by email. Nobody chases anybody.

**[10:35]** In this recording, that chain ran end to end. Sunita's bell shows the senior QC request for A-107, sent the moment Anil approved it.

**[10:45]** Deepa was told A-107 was ready to issue, and that the client had acknowledged 2026-014-TR-0033.

**[10:57]** Priya, the project lead, gets a copy of every transmittal and acknowledgement on her projects.

**[11:03]** Meera was told the moment the Mysuru stage was ready to invoice.

**[11:08]** And Nikhil sees the whole chain in the project's activity feed. Each person sees only what their role allows, so hand-offs are quick and safe.

## 13 · Close  (11:17)

**[11:17]** Underneath, permissions are enforced on the server, issued files never change, the audit trail is insert-only, and every project exports in full.

**[11:27]** DrawingOps gives the whole firm one live record of every sheet, from planned to invoiced. It is built by LatentIQ. To see it with your own projects, talk to the LatentIQ team. Thank you for watching.


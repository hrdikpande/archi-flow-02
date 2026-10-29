# DrawingOps · video storyboard

Chapter order, scenes, on-screen actions and narration for `complete-product-walkthrough.mp4` (1920×1080, 30 fps). Generated from the recorded timeline, so times, screens and actions are what the video actually shows. Screens are demo routes (`demo/demo.html#…`); `(card)` is a title or explainer card rendered in the product's own design tokens.

| # | Chapter | Starts | Length | Main role on screen |
|---|---|---|---|---|
| 00 | Introduction | 00:00 | 02:04 | Cards |
| 01 | Signing in and roles | 02:04 | 01:12 | Rahul Kumar · Designer (HVAC); Nikhil Prasad · Owner / Principal |
| 02 | Owner: portfolio dashboard | 03:17 | 01:47 | Nikhil Prasad · Owner / Principal |
| 03 | Project dashboard | 05:04 | 01:36 | Nikhil Prasad · Owner / Principal |
| 04 | Projects, fee stages and teams | 06:40 | 02:11 | Nikhil Prasad · Owner / Principal; Priya Sharma · Project lead |
| 05 | The drawing register | 08:51 | 01:59 | Priya Sharma · Project lead |
| 06 | Getting drawings in: import, PDFs and CAD sync | 10:51 | 01:59 | Priya Sharma · Project lead |
| 07 | The sheet page | 12:50 | 01:36 | Priya Sharma · Project lead |
| 08 | Designer: my work and pre-checks | 14:26 | 01:20 | Priya Sharma · Project lead; Rahul Kumar · Designer (HVAC) |
| 09 | Checking and senior QC | 15:47 | 01:39 | Rahul Kumar · Designer (HVAC); Anil Kapoor · Discipline lead (Architecture); Sunita Rao · Senior reviewer |
| 10 | Issue and transmittals | 17:26 | 02:02 | Sunita Rao · Senior reviewer; Deepa Chandra · Document controller |
| 11 | The client's side | 19:29 | 01:06 | Deepa Chandra · Document controller; Dr. Vikram Nair · Client · Navjeevan Health Trust |
| 12 | Client comments, decisions and approvals | 20:35 | 01:45 | Deepa Chandra · Document controller; Priya Sharma · Project lead |
| 13 | Billing signals | 22:20 | 01:26 | Priya Sharma · Project lead; Asha Menon · System admin; Meera Thomas · Accounts |
| 14 | Workload and timesheets | 23:46 | 01:35 | Priya Sharma · Project lead; Rahul Kumar · Designer (HVAC); Anil Kapoor · Discipline lead (Architecture) |
| 15 | Notifications, alerts and automation | 25:21 | 01:30 | Anil Kapoor · Discipline lead (Architecture); Rahul Kumar · Designer (HVAC); Asha Menon · System admin |
| 16 | The construction stage | 26:52 | 01:32 | Asha Menon · System admin; Priya Sharma · Project lead |
| 17 | Search and knowledge | 28:24 | 01:03 | Priya Sharma · Project lead |
| 18 | Reports and baseline metrics | 29:27 | 01:01 | Priya Sharma · Project lead; Nikhil Prasad · Owner / Principal |
| 19 | Intelligence: forecasts and drawing checks | 30:28 | 01:27 | Nikhil Prasad · Owner / Principal; Sunita Rao · Senior reviewer; Asha Menon · System admin |
| 20 | Administration | 31:56 | 02:36 | Asha Menon · System admin |
| 21 | Built for everyday use and for trust | 34:32 | 01:16 | Asha Menon · System admin |

## 00 · Introduction

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 00:00 | (card) | hold | This is DrawingOps: drawing and deliverable control for architecture and MEP design firms. It works alongside the AutoCAD and Revit tools your teams already use, and gives everyone one live record of every sheet, review, transmittal, deadline and fee stage. |
| 00:18 | (card) | hold | The goal is simple. A principal should be able to see, without phone calls, which projects are at which stage, which drawings are late or about to be late, who is overloaded, and what is waiting for review. And the site should never build from a superseded drawing. |
| 00:34 | (card) | hold | This walkthrough uses the interactive DrawingOps prototype, populated with a fictional firm, Prasad Rao Associates, and fictional projects, people and fees. Connections to outside systems, such as Microsoft sign-in, email delivery, the Revit and AutoCAD plugins, and accounting, are simulated in this demonstration, and each simulation is labelled where it appears. |
| 00:59 | (card) | hold | Eight roles work in DrawingOps. The owner watches the portfolio. Project leads plan projects, fee stages and teams. Discipline leads plan sheets and do the first check. Designers move their own sheets forward. Senior reviewers carry out quality checks. Document controllers issue drawings. Accounts receives billing signals, and the administrator configures the firm. Clients, consultants and contractors receive drawings through secure links, with no account needed. |
| 01:28 | (card) | hold | Everything revolves around the sheet. A sheet exists from the day it is planned, before any file is drawn. Every sheet moves through the same states: planned, in progress, ready for check, in check, approved for issue, and issued. Issuing a new revision supersedes the old one automatically. And fee stages move as their sheets move, all the way to ready to invoice. |
| 01:51 | (card) | hold | We will follow that lifecycle from the owner's dashboard, through planning, drafting, checking and issuing, out to the client, and on to billing, the construction stage, reporting, intelligence and administration. |

## 01 · Signing in and roles

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 02:04 | (card) | hold | Chapter one: signing in, and how roles shape what each person sees. |
| 02:09 | `#/sign-in` | highlight | People sign in with the firm's Microsoft 365 or Google Workspace account, so there is no new password to remember. There is deliberately no public sign-up: accounts come from single sign-on, or from an invitation sent by the administrator. |
| 02:26 | `#/sso` | click a.sso-btn; zoom in | In this demonstration the Microsoft step is simulated with an account picker. In production, people see their firm's own Microsoft sign-in page. |
| 02:36 | `#/sign-in` | type "admin@firm.example"; type the password (masked on screen); click form[data-submit=signin] button.primary; zoom in | Administrators, and anyone without a firm account, use an email and password, protected by a six-digit code from an authenticator app. |
| 02:45 | `#/forgot` | hold | Local accounts can also reset a forgotten password with a code sent by email. |
| 02:51 | `#/` | highlight | Once signed in, navigation follows the person's role. A designer, such as Rahul, sees his own work, projects, reviews, workload, timesheets, knowledge and contacts. |
| 03:02 | `#/` | highlight | The owner, Nikhil, also sees the portfolio, reports, billing signals and the audit trail. Permissions combine an organisation role with a role on each project, and the same rules apply to every screen, list and action. |

## 02 · Owner: portfolio dashboard

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 03:17 | (card) | hold | Chapter two: the owner's portfolio. |
| 03:20 | `#/portfolio` | hold | The portfolio is the owner's home page: every active project in the firm, with data never more than fifteen minutes old. |
| 03:28 | (same screen) | zoom in; highlight | Five numbers lead the page. 20 sheets are late, and 22 are at risk. The oldest review has been waiting 5 days. 2 people over-allocated this week, and 2 stages are ready to invoice. Each card also shows the change since last week. |
| 03:44 | `#/sheets?flag=late` | click a.metric >> nth=0; zoom in | Every number opens the exact list behind it. Here are the 20 late sheets across the practice, with their project, owner, state and planned date. The count always matches the card. |
| 03:56 | (same screen) | highlight | Late and at risk are flags. They are computed every morning from each sheet's planned issue date and the firm's working calendar, so nobody has to remember to set them. |
| 04:06 | `#/portfolio` | zoom in | Back on the portfolio, the projects table shows each project's current fee stage, sheets issued against planned, late and at-risk counts, the project lead, and the next stage date. Columns sort, and every count opens the project's register, already filtered. |
| 04:23 | (same screen) | highlight | The forecast column is advisory. It counts open sheets that a model expects are likely to go late. We will return to forecasting later in the walkthrough. |
| 04:32 | (same screen) | zoom in | Further down, discipline workload for the next four weeks shows which teams are over or under capacity, and a forecast lists the individual sheets most likely to slip, with the reasons behind each prediction. |
| 04:46 | `#/portfolio?lead=u_pl` | choose u_pl in select[data-change=pf-filter][data-k=lead]; click [data-act=export-late]; zoom in | Filters narrow the page by project lead or project type, and the late and at-risk list can be exported to Excel, PDF or CSV. |
| 04:55 | `#/portfolio` | choose (all) in select[data-change=pf-filter][data-k=lead]; click [data-act=notifications]; zoom in | The bell collects the alerts that matter to this person, such as the weekly owner summary and stages that are ready to invoice. |

## 03 · Project dashboard

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 05:04 | (card) | hold | Chapter three: the project dashboard. |
| 05:07 | `#/projects/p1` | click main table a[href="#/projects/p1"]; highlight | Opening a project shows its dashboard. HSR Block B is a hospital for the Navjeevan Health Trust, now in stage four, working drawings. Tabs along the top lead to the register, stages, transmittals, team, activity, client comments, construction and decisions. |
| 05:25 | (same screen) | zoom in | The headline numbers show sheets issued against planned, late and at-risk sheets, sheets waiting for a check, transmittals that recipients have not yet acknowledged, and open client comments. Each one opens its list. |
| 05:38 | `#/projects/p1?disc=M` | zoom in; choose M in select[data-change=po-disc] | The burn-up chart compares sheets planned with sheets actually issued, for the whole project or for one discipline. Every chart can also be shown as a table, for accessibility and for export. |
| 05:50 | `#/projects/p1` | choose (all) in select[data-change=po-disc]; zoom in | Below the chart, the stage timeline shows each fee stage with its share of the fee, its dates and its state, followed by the list of late sheets. |
| 06:00 | (same screen) | zoom in | On the right, the project card holds the client, fee, CAD versions and the appointment letter. Each project also has its own email address for client comments, and a site-view link for the current drawing set. |
| 06:13 | (same screen) | zoom in | Further down are this week's team allocation, with anyone over capacity flagged, the latest transmittals with acknowledgement counts, open client comments, and an advisory forecast of the sheets most likely to go late. |
| 06:27 | `#/projects/p1` | click [data-act=po-export]; zoom in | The project lead or owner can export the whole project at any time: every record as structured data, plus the issued PDFs, in one zip file. The firm's data is never locked in. |

## 04 · Projects, fee stages and teams

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 06:40 | (card) | hold | Chapter four: projects, fee stages and teams, from the project lead's point of view. |
| 06:46 | `#/projects` | hold | The projects list shows every project this person can see, with client, type, current stage, lead, sheets issued against planned, and late counts. It can be searched, filtered by state and type, and exported. |
| 07:00 | `#/projects/new` | click a[href="#/projects/new"]; type "Sarjapur Road Cancer Centre"; type "Navjeevan Health Trust"; type "Sarjapur Road, Bengaluru"; type "4,20,00,000"; zoom in | Creating a project takes a minute: a code in the firm's format, the name, client, type, location, fee value, dates, the project lead, the document controller, and a fee-stage template. |
| 07:12 | `#/projects/new` | type "2026-014"; click form[data-submit=np-create] button.primary; zoom in | Project codes must be unique across the firm. Reusing the code of HSR Block B is refused, with a message that says exactly why. |
| 07:21 | `#/projects/p_mvt1vwgxy1w/stages` | type "2026-027"; click form[data-submit=np-create] button.primary | With a fresh code, creating the project lays out its fee stages from the template, with dates spread across the project period. |
| 07:30 | (same screen) | zoom in | The stage plan mirrors the appointment letter: each stage's share of the fee and its amount, planned dates, the issue purposes the stage requires, and whether it needs senior quality control. |
| 07:42 | `#/projects/p_mvt1vwgxy1w/stages` | type "12"; highlight | Fees must total one hundred percent before the plan can be saved as final. Until then it stays a draft, and the total is flagged. |
| 07:50 | `#/projects/p_mvt1vwgxy1w/stages` | type "10"; click [data-act=sp-final]; zoom in | Correcting the figure brings the total back to one hundred percent, and the plan is saved as final. Every change to the plan is written to the audit trail. |
| 08:00 | `#/projects/p1/stages` | zoom in | On a live project such as HSR Block B, the appointment letter is attached, stages one and two are invoiced with their fee percentage locked, stage three is ready to invoice, and stage four is active. Stages move by themselves as their sheets are started and issued. |
| 08:17 | `#/projects/p1/team` | hold | The team tab lists everyone on the project with their project role and discipline, their hours here this week, and their load across all projects. Hours are visible only to the person, their discipline lead, the project lead and the owner. |
| 08:32 | `#/projects/p1/team` | click [data-act=tm-add]; choose u_tan in #tm-u; choose Designer in #tm-r; click .dialog-foot .btn.primary | Adding someone to the team gives them access to the project, and they are notified in the app and by email. |
| 08:39 | `#/projects/p1/activity`<br>`#/projects/p1/activity?type=transmittal` | choose transmittal in select[data-change=act-filter][data-k=type] | The activity feed records every state change, issue, transmittal, stage event, import and client comment, newest first, and can be filtered by person, event type or discipline. |

## 05 · The drawing register

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 08:51 | (card) | hold | Chapter five: the drawing register. |
| 08:54 | `#/projects/p1/register` | zoom in | The register is the heart of DrawingOps. It lists every sheet the firm owes on the project, with number, title, discipline, package, owner, checker, state, planned date, current revision and flags. All one hundred and thirty-two sheets of HSR Block B render instantly. |
| 09:12 | `#/projects/p1/register?q=OT+duct` | type "OT duct" | Search covers sheet numbers, titles, earlier numbers and owners. Typing OT duct finds the operating-theatre ductwork sheets straight away. |
| 09:21 | `#/projects/p1/register?disc=M`<br>`#/projects/p1/register?disc=M&flag=late` | choose M in select[data-change=reg-f][data-k=disc] | Filters combine: discipline, stage, state, owner and package, plus quick toggles for late or at-risk sheets only. Here are the late HVAC sheets. |
| 09:31 | `#/projects/p1/register?group=discipline` | choose discipline in select[data-change=reg-f][data-k=group]; click [data-act=reg-views]; zoom in | The register can be grouped by discipline, package or stage, with a running count of issued and late sheets in each group. Any combination of filters, grouping and sort can be saved as a named view, and columns can be shown or hidden. |
| 09:46 | `#/projects/p1/register?state=planned` | choose u_pl in select.cell[data-k=ownerId] >> nth=1; zoom in | Owners, checkers, packages and planned dates can be edited right in the table. Each change saves immediately, is audited, and can be undone from the confirmation. |
| 09:57 | `#/projects/p1/register?state=planned` | click input[data-act=reg-sel] >> nth=0; click input[data-act=reg-sel] >> nth=1; click input[data-act=reg-sel] >> nth=2; click input[data-act=reg-sel] >> nth=3; zoom in | Selecting several sheets brings up the bulk bar: assign an owner or a checker, shift planned dates, move sheets into a package, change their state, issue them, or export the selection. |
| 10:09 | `#/projects/p1/register?state=planned` | click [data-act=bulk-shift]; type "5"; click .dialog-foot .btn.primary | Shifting dates counts working days on the firm's calendar, so weekends and holidays are skipped. Every sheet gets its own audit entry, and the whole change can be undone. |
| 10:19 | `#/projects/p1/register?state=planned` | click [data-act=bulk-state]; zoom in | Changing state in bulk moves only the sheets that are allowed to move, and reports the others with the reason they were skipped. |
| 10:27 | `#/projects/p1/register?state=planned` | click [data-act=bulk-clear]; click [data-act=reg-new]; type "A1O1"; type "A-118"; type "Seventh Floor Plan" | A new sheet can be added at any time. It exists from the day it is planned, before any file, and its number is checked against the discipline's numbering rule as you type. |
| 10:38 | `#/projects/p1/register` | click [data-act=reg-export]; zoom in | Every list exports to Excel, PDF or CSV with the current filters applied. And for people who live in the register, keyboard shortcuts move, select and open rows without the mouse. |

## 06 · Getting drawings in: import, PDFs and CAD sync

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 10:51 | (card) | hold | Chapter six: getting sheets and drawings into the system. |
| 10:55 | `#/projects/p1/import` | click [data-act=imp-sample] | Most firms start from an Excel sheet list. The import wizard accepts an Excel workbook or a CSV file, and recognises common column headings automatically. |
| 11:06 | `#/projects/p1/import` | click [data-act=imp-preview]; zoom in | The preview checks every row before anything is created. This sample contains three deliberate problems: a sheet number that already exists, an unknown discipline, and a date that does not exist. Each is explained in plain words. |
| 11:20 | `#/projects/p1/import` | click tr[style*="danger"] [data-act=imp-skip] >> nth=0; click [data-act=imp-commit] | Imports are all or nothing. Once the problem rows are skipped, the valid sheets are created in one step, and the whole import can be undone for twenty-four hours, as long as none of the new sheets has moved. |
| 11:33 | `#/projects/p1/import` | click [data-act=imp-undo] >> nth=0; click #cf-ok | Undoing removes the five imported sheets again. |
| 11:37 | `#/projects/p1/upload` | upload M-206_C01.pdf, scan_0042.pdf, A104 ground floor rev.pdf; zoom in | Drawings arrive as PDFs. Dropping a batch of files matches each one to its sheet by the number in the file name, or, for scans and badly named files, by reading the text of the title block: here, a scanned file called scan_0042 is recognised as F-101 from its title block. Each file becomes a draft revision with the next revision code. |
| 12:02 | `#/projects/p1/upload` | click [data-act=up-go] | Every file is checked on the way in: it must be a real PDF, under the size limit, and not a duplicate of a file already uploaded. A file whose name breaks the firm's naming rule is kept as a draft, but blocked from issue until it is renamed. |
| 12:18 | `#/projects/p1/cad-sync` | zoom in | With the Revit add-in and the AutoCAD plugin, sheet lists sync straight from the model. In this demonstration the plugins are simulated. New sheets arrive as proposals, and nothing is created until a lead accepts them. When a title in the model differs from the register, the lead decides which one wins. |
| 12:36 | `#/projects/p1/cad-sync` | click [data-act=cad-accept] >> nth=0; highlight | Accepting a proposal creates the sheet in the register. Alongside, a file-storage connector reports CAD file activity, so everyone can see when a drawing file was last saved, and by whom. |

## 07 · The sheet page

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 12:50 | (card) | hold | Chapter seven: the sheet page, where everything about one drawing comes together. |
| 12:55 | `#/projects/p1/sheets/s89` | zoom in | Here is M-205, OT ductwork for level two. The header shows its discipline, stage, package, owner, checker and planned date. It is in progress, late by 2 working days, and the advisory forecast puts its late risk at 97 percent. |
| 13:11 | (same screen) | zoom in | The current revision opens in the built-in viewer: a real A3 drawing with the firm's full title block. It can be downloaded, opened in a new tab, or shown full screen. |
| 13:23 | `#/projects/p1/sheets/s89` | click [data-act=sd-rev] >> nth=-1; zoom in | Every revision stays on record. Opening an earlier one shows a clear superseded banner, and downloading it stamps a diagonal SUPERSEDED watermark and the date on every page, so an old print is never mistaken for the current one. |
| 13:38 | (same screen) | zoom in | On the right, the reviews card lists every check and senior QC decision for each revision, with the reviewer and the date. |
| 13:46 | `#/projects/p1/sheets/s89` | zoom in | Who has which revision shows every person and organisation that received this sheet, which revision they hold, and on which transmittal, so a superseded copy in someone's hands is never a mystery. |
| 13:58 | (same screen) | hold | Below that, the activity timeline shows every state change with who made it, when, and why, followed by CAD file activity and the results of AI drawing checks, which we will see later. |
| 14:11 | `#/projects/p1/sheets/s89` | click [data-act=sd-more]; zoom in | The more menu holds the less frequent actions: editing sheet details, working notes, and, for the project lead, overriding a workflow step with a written reason. Even an override stays within the allowed transitions, and is audited. |

## 08 · Designer: my work and pre-checks

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 14:26 | (card) | hold | Chapter eight: a designer's day. |
| 14:29 | `#/` | zoom in | Rahul is an HVAC designer. My work lists his sheets across every project by due date, each with its state, its flags, and the one next action that makes sense right now. |
| 14:41 | `#/` | click button[data-act=quick-transition][data-a=start] >> nth=0 | Starting a planned sheet is a single click at the moment the work begins. If it is the first sheet of its stage, the stage becomes active automatically. |
| 14:50 | `#/` | highlight | Further down, Returned to you lists sheets that came back from a check, with who returned them, when, and the checker's comment. On the right, hours this week compares time logged with capacity, and flags a missing timesheet. |
| 15:04 | `#/projects/p1/sheets/s90` | highlight | When a drawing is ready, Rahul opens the sheet and submits it for check. Here, M-206 already has a draft check print attached. |
| 15:12 | `#/projects/p1/sheets/s90` | click #sd-submit; zoom in; click .dialog-foot .btn.primary | Submitting opens the discipline's pre-check list. Mandatory items must be ticked, and the submission is refused until they are. |
| 15:21 | `#/projects/p1/sheets/s90` | click .dialog-foot .btn.primary | With every item ticked, the sheet moves to ready for check, the ticks are stored with the review, and Karthik, the HVAC checker, is notified straight away. |
| 15:30 | `#/projects/p1/sheets/s88` | zoom in | A sheet that comes back carries the checker's comment and any redline files on its page. M-204 was returned because the return-air path is not allowed through the corridor ceiling in the ICU zone. Starting the revision puts it back in progress. |

## 09 · Checking and senior QC

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 15:47 | (card) | hold | Chapter nine: checking, returning and approving. |
| 15:51 | `#/` | zoom in | Anil leads the architecture team. His My work shows what is waiting for his check, and how long the oldest has waited. |
| 15:58 | `#/reviews` | zoom in | The review queue lists every sheet waiting for him, oldest first, with the working days waited. Anything open for more than three working days is flagged as overdue, and the daily sweep escalates it. A senior QC tag shows that a sheet's stage needs a second check. |
| 16:14 | `#/reviews?open=rv8313` | hold | Opening a review puts the drawing and the check side by side, with the designer, the submission time and the review round. |
| 16:22 | `#/reviews?open=rv8313`<br>`#/reviews?open=rv8308` | zoom in; type "Grid C dimension chain does not close; check the toilet core walls."; click form[data-submit=rq-return] button.danger | Returning a sheet needs a comment or a redline file, so the designer always knows what to fix. Anil writes his comment and returns A-401 to Meghna, who is notified at once. |
| 16:35 | `#/reviews?open=rv8299`<br>`#/reviews?open=rv8308` | click #rq-approve-btn | For A-107, the check passes. Because stage four requires senior quality control, Anil's approval sends the sheet on to the senior reviewer as a second step. It stays in check until she approves. |
| 16:48 | `#/reviews` | click [data-act=rq-delegate]; zoom in | Going on leave? A reviewer can delegate their queue to a colleague for a date range. Reviews route to the delegate automatically, and overdue escalations follow them. |
| 16:58 | `#/disciplines/A` | hold | The discipline dashboard gives Anil one view of his team: late and at-risk sheets, the check queue, sheets approved but not yet issued, assignments per person, and capacity this week and next. |
| 17:11 | `#/reviews` | highlight | Sunita, the senior reviewer, now finds A-107 in her queue, tagged senior QC. |
| 17:17 | `#/reviews?open=rv_mvt1y0d52sm3`<br>`#/reviews?open=rv8331` | click #rq-approve-btn | Her approval moves the sheet to approved for issue. The sheet's owner and the document controller are both notified that it is ready. |

## 10 · Issue and transmittals

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 17:26 | (card) | hold | Chapter ten: issuing drawings with transmittals. |
| 17:30 | `#/` | zoom in | Deepa is the document controller. Her My work lists the approved sheets that are ready to issue, project by project. |
| 17:37 | `#/projects/p1/issue` | click main a.btn[href="#/projects/p1/issue"] | The issue composer has three steps: sheets, purpose and recipients, and a preview. The next transmittal number is reserved in sequence for the project, and numbers are never reused. |
| 17:49 | (same screen) | zoom in; highlight | Each approved sheet shows its draft PDF and whether it is ready. A-104 is blocked because its file name breaks the naming rule, and E-102 has no PDF yet. |
| 18:01 | `#/projects/p1/issue` | click [data-act=sd-rename]; click [data-act=ic-all] | A-104 is fixed with one click, which renames the file to the valid name. Choosing all approved sheets then selects everything that is ready, and E-102 waits behind for its PDF. |
| 18:13 | `#/projects/p1/issue` | choose GFC in select[data-change=ic-purpose]; type "Working drawings for review on site, ground to fourth floor."; zoom in | The purpose of the issue is required. Here it is good for construction. Recipients receive a secure link by email, paper copies handed over in person can be recorded too, and a note can be added for everyone. |
| 18:27 | `#/projects/p1/issue` | click [data-act=ic-preview]; zoom in | The preview shows the numbered cover sheet exactly as recipients will receive it: the project, purpose, recipients, and every drawing with its revision. |
| 18:37 | `#/projects/p1/issue` | click [data-act=ic-issue]; zoom in | Issuing asks for one final confirmation. |
| 18:40 | `#/projects/p1/issue` | click #cf-ok; zoom in | One click issues the whole set on a single transmittal. In the same step, earlier revisions of those sheets are superseded, recipients get their secure link, and anyone who received an older revision is told a newer one exists. |
| 18:54 | `#/projects/p1/transmittals` | zoom in | The transmittal log lists every issue with its purpose, sheets, recipients and acknowledgement status, including emails that bounced, so nothing is assumed to have arrived. |
| 19:06 | `#/projects/p1/transmittals?view=matrix` | click [data-act=tm-view][data-v=matrix] | Switching to the matrix view shows, for every sheet, which revision each recipient holds. |
| 19:12 | `#/projects/p1/transmittals/tm8635` | zoom in | Each transmittal has its own page, with delivery, download and acknowledgement times for every recipient, and a resend button for a bounced email. Transmittals are never edited after sending: a correction is a new transmittal that references the original. |

## 11 · The client's side

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 19:29 | (card) | hold | Chapter eleven: what the client, consultant or contractor sees. No account, and no software to install. |
| 19:36 | `#/mailbox`<br>`#/mailbox?m=em_mvt1yiks3key` | click a.mail-item:has-text("2026-014-TR-0033"):has-text("Vikram") >> nth=0; zoom in | Recipients get an ordinary email in their own inbox. In this demonstration, emails land in a demonstration mailbox instead of being sent. |
| 19:46 | `#/t/tg5zwjx9vlv?r=k_vn` | click .email-frame a.btn.primary | The link opens a secure page with no sign-in: the transmittal number, project, purpose, sender and expiry date, and every drawing with its revision. |
| 19:56 | `#/t/tg5zwjx9vlv?r=k_vn` | click [data-act=ext-zip] | Drawings download one at a time, or all together as a zip file that includes the cover sheet. |
| 20:03 | `#/t/tg5zwjx9vlv?r=k_vn` | click [data-act=ext-ack]; zoom in | Acknowledging receipt records the date and time, and the sender sees it on the transmittal immediately. |
| 20:09 | `#/mailbox?m=undefined` | zoom in | People who hold an older revision are emailed automatically when a newer one is issued, and told to stop using the old one. |
| 20:17 | (card) | hold | On site, the project's site-view link shows only the current issued set, on a phone, with search and large touch targets. Superseded drawings never appear, so nobody builds from an old sheet. |
| 20:30 | `#/projects/p1/transmittals/tm_mvt1yikr36fx` | zoom in | Back in DrawingOps, the client's acknowledgement already shows on the transmittal. |

## 12 · Client comments, decisions and approvals

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 20:35 | (card) | hold | Chapter twelve: client comments, decisions, and client approval of a stage. |
| 20:41 | `#/projects/p1/comments` | zoom in | Client comments arrive by email, letter, phone call, WhatsApp or in meetings. Each one is logged with a number, linked to the sheets it affects, assigned to a person, and tracked until it has a written response. |
| 20:54 | `#/projects/p1/comments?overdue=1` | hold | A comment with no response after five days is flagged as overdue, and the daily sweep reminds the person it is assigned to, and the project lead. |
| 21:04 | `#/projects/p1/comments` | click [data-act=cm-new]; type "Please add a visitor toilet near the OPD waiting area."; choose u_meg in #cn-a; click .dialog-foot .btn.primary | Logging a new comment takes seconds: what the client asked for, where it came from, the sheets it concerns, and who should answer it. The person is notified straight away. |
| 21:14 | `#/projects/p1/comments` | click tr[data-act=cm-open] >> nth=0; type "Visitor toilet added at grid B/2 on A-101; revised plan to follow."; click [data-act=cm-op][data-op=close] | A comment can only be closed with a written response. The answer becomes part of the project record, and is searchable later. |
| 21:23 | `#/projects/p1/comments` | click [data-act=cm-sim] | Each project also has its own email address. Forwarding a client's email to it logs the comment automatically, matched to the sender. In this demonstration the forwarding is simulated. |
| 21:35 | `#/projects/p1/comments` | click [data-act=cm-queue]; zoom in; click [data-act=iq-accept] >> nth=0 | Emails from senders the system does not recognise wait in a review queue, so nothing is logged against a project until a person accepts it. |
| 21:44 | `#/projects/p1/decisions` | click [data-act=dc-new]; type "Visitor toilet added at grid B/2"; type "Agreed with Navjeevan at the design review; OPD waiting area."; click .drawer-foot .btn.primary, .dialog-foot .btn.primary | Decisions agreed with the client are recorded too, with their context and the sheets they affect. They are searchable across projects, so the reasoning behind a design choice is never lost. |
| 21:57 | `#/projects/p5/stages` | click [data-act=sp-approve]; upload sample-client-approval-letter.pdf; zoom in | On the Mysuru heritage hotel, every deliverable of stage five, tender, has been issued. The project lead now records the client's approval, attaching the approval letter as evidence. |
| 22:09 | `#/projects/p5/stages` | click .dialog-foot .btn.primary; zoom in | With every deliverable issued and the client's approval on record, the stage becomes ready to invoice automatically, and Accounts, the owner and the project lead are notified. |

## 13 · Billing signals

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 22:20 | (card) | hold | Chapter thirteen: billing signals, for Accounts. |
| 22:24 | `#/admin/integrations` | zoom in | First, the administrator connects the firm's accounting system: choose the columns to send, give a webhook address, and switch it on. The address is checked, so it can never point inside the firm's own network. In this demonstration the connection is simulated. |
| 22:40 | `#/` | zoom in | Meera, in Accounts, sees the stages that are ready to invoice on her home page. |
| 22:45 | `#/billing` | zoom in | Billing signals lists every stage ready to invoice, with the project, the stage, its share of the fee and the amount, how long it has been waiting, and the client approval behind it. The Mysuru stage approved a moment ago is already here. |
| 23:01 | `#/billing` | click [data-act=bl-csv]; click [data-act=bl-push]; zoom in | The list exports as a CSV file in the columns the accounting tool expects, or pushed straight to the accounting system as a signed message. In this demonstration the push is simulated, and the message is shown instead of sent. |
| 23:15 | `#/billing` | click .dialog-foot .btn.primary; click [data-act=bl-mark] >> nth=0; zoom in | Once the invoice is raised in the accounting tool, Accounts marks the stage invoiced with its reference and date, and the stage's fee percentage locks. |
| 23:24 | `#/billing/invoiced` | hold | Invoiced stages stay on record with their reference. Invoicing, tax and ledgers deliberately remain in the firm's accounting software: DrawingOps supplies the signal, not the invoice. |
| 23:36 | `#/projects/p1` | highlight | Accounts sees projects in a deliberately narrow way: stages and fees only, never drawings, reviews or individual people's hours. |

## 14 · Workload and timesheets

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 23:46 | (card) | hold | Chapter fourteen: workload and timesheets. |
| 23:50 | `#/workload` | zoom in | Workload is a heat map of planned hours against capacity, person by person, for the next eight weeks. Above one hundred and ten percent is flagged as over-allocated, and below fifty percent as under-allocated, always with an icon and a word as well as colour. |
| 24:07 | `#/workload?disc=M` | choose M in select[data-change=wl-f][data-k=disc] | Filters narrow the map to a discipline, a project, or only the people who are over or under. Here is the HVAC team. |
| 24:15 | `#/workload?disc=M` | click button[data-act=wl-cell] >> nth=0; zoom in; click element | Clicking a cell shows where that person's hours go, project by project and stage by stage. Hours can be edited in place, or copied forward to the next three weeks. |
| 24:26 | `#/workload?disc=M` | click [data-act=wl-allocate]; zoom in; type "10"; type "2"; click .dialog-foot .btn.primary, .drawer-foot .btn.primary | New allocations are added for a person, a project stage and a number of weeks, and the heat map updates at once. |
| 24:34 | `#/workload/staff` | hold | The staff directory holds each person's discipline, weekly capacity and leave. Leave and the firm's holidays reduce capacity automatically, so the heat map stays honest. |
| 24:45 | `#/timesheets` | type "6"; type "2"; type "5.5"; type "3"; highlight | Timesheets are weekly, by project and stage, and start from the person's own allocations. Rahul enters his hours for the week. People who track time elsewhere can import a CSV file instead. |
| 24:58 | `#/timesheets` | click [data-act=ts-submit]; zoom in; click #cf-ok | Submitting the week locks it and sends it for approval. A timesheet missing by Tuesday noon raises a reminder. |
| 25:05 | `#/timesheets/approvals` | click [data-act=ap-ok] >> nth=0 | Discipline leads and project leads approve submitted timesheets, or return them with a reason, and can remind anyone whose week is still missing. Individual hours are only ever visible to the person, their discipline lead, the project lead and the owner. |

## 15 · Notifications, alerts and automation

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 25:21 | (card) | hold | Chapter fifteen: notifications, alerts, and the automations behind them. |
| 25:27 | `#/` | click [data-act=notifications]; zoom in | Everyone has one notification centre. Rahul's shows his assignments, review results and deadline alerts, each linking straight to the sheet. |
| 25:36 | `#/settings/notifications` | zoom in | Preferences decide how each kind of alert arrives: instantly, in a daily digest, or not at all. Alerts that must not be missed, such as a sheet returned with redlines, are locked on. Quiet hours hold notifications overnight. |
| 25:51 | `#/settings/notifications`<br>`#/mailbox?m=em_mvt208up5neh` | click [data-act=pf-digest]; zoom in | Everything set to digest arrives together in one email each morning. |
| 25:56 | `#/admin/automation` | zoom in | Behind the alerts are ten automation rules, all visible to the administrator in one place: at-risk and late flags, superseding on issue, naming checks, allocation and timesheet checks, overdue reviews and client comments, the ready-to-invoice signal, and RFI due dates. Each has its schedule and its threshold. |
| 26:16 | `#/admin/automation` | click [data-act=au-run]; zoom in | The daily sweep runs at eight every morning. Running it now sends the reminders and escalations that are due today. |
| 26:24 | `#/admin/automation` | click [data-act=au-run]; zoom in | Running it a second time sends nothing twice. Every alert goes out once per day, and the duplicates are counted and skipped. People can trust their inbox. |
| 26:33 | `#/admin/automation` | highlight | The run log records every sweep with its counts and duration, and a warning appears if the morning sweep ever fails to run. |
| 26:41 | `#/mailbox?m=em_mvt1uv2zpde` | zoom in | And every Monday morning the owner receives a weekly summary by email: late and at-risk sheets, overloaded people, and money waiting to be invoiced. |

## 16 · The construction stage

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 26:52 | (card) | hold | Chapter sixteen: the construction stage. |
| 26:55 | `#/projects/p4/construction/rfis` | zoom in | Once a project is on site, the construction tab brings the site's paperwork into the same system. Koramangala Tech Park is in stage six, construction. RFIs are logged with the question, who raised it, whose court the ball is in, the due date, the linked sheets and any cost or time impact. RFIs due within two working days are flagged. |
| 27:17 | `#/projects/p4/construction/rfis` | click tr[data-act=rfi-open] >> nth=0; type "Upturn 450 mm at the parapet; detail revised on A-004."; zoom in; click [data-act=rf-op][data-op=answer] | Answering an RFI can start the next revision of every linked sheet in the same step, so a drawing change is never forgotten. |
| 27:26 | `#/projects/p4/construction/submittals` | click [data-act=sb-review] >> nth=0; type "Provide a 600 mm access door on the filter section."; zoom in; click .dialog-foot .btn.primary | Submittals from contractors, such as shop drawings, samples and product data, are reviewed by the right person and stamped: approved, approved as noted, revise and resubmit, or rejected. The stamped PDF is ready to send back. |
| 27:41 | `#/projects/p4/construction/site` | click [data-act=sv-new]; type "Level 8 slab reinforcement inspected; cover blocks missing at grid D/4."; upload site-photo-2.jpg; zoom in; click .drawer-foot .btn.primary | Site visit reports are filed from a phone: who attended, the weather, observations linked to sheets, and photos. Photos are compressed and their location data is removed, and every report exports as a PDF. |
| 27:55 | `#/projects/p4/construction/changes` | click [data-act=co-approve] >> nth=0; zoom in | Change orders record cost and time, where they came from, often an RFI, and the sheets they affect. The project lead approves or rejects them, and the approved total is always up to date. |
| 28:08 | `#/projects/p4/construction/clashes` | upload sample-clashes.bcfzip; zoom in | Clash results from Navisworks, or any tool that exports BCF, are imported as issues with their viewpoints, disciplines, sheets, assignee and status. Importing again updates the existing issues by their unique ID, instead of duplicating them. |

## 17 · Search and knowledge

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 28:24 | (card) | hold | Chapter seventeen: finding anything, fast. |
| 28:28 | `#/projects` | type "A-101"; zoom in | Command search opens from anywhere with Control K. Typing a sheet number finds it on every project the person can see, and the same box finds projects, transmittals and contacts, and jumps to any page. |
| 28:41 | (same screen) | type "OT duct" | Words work too: OT duct finds the operating-theatre ductwork sheets on both hospital projects, and the search reports how long it took. Results only ever include projects the person can see. |
| 28:54 | `#/knowledge`<br>`#/knowledge?q=OT+ceiling+HEPA` | type "OT ceiling HEPA"; zoom in | Knowledge search goes deeper. It searches decisions, client comments, RFI answers and review comments, highlights the matching words, and links every result to its project and sheets. Here, OT ceiling HEPA finds the review comment, the client comment and the decision behind the operating-theatre ceilings. |
| 29:14 | `#/contacts` | hold | Contacts hold every outside person and organisation, by kind: client, consultant, contractor or authority. Adding someone whose email already exists raises a warning, so the list stays clean. |

## 18 · Reports and baseline metrics

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 29:27 | (card) | hold | Chapter eighteen: reports. |
| 29:30 | `#/reports?tab=baseline` | zoom in | The baseline report tracks the four measures the firm agreed to improve: the share of sheets issued after their planned date, the average working days a sheet spends in check, hours logged against hours planned, and the days from deliverables issued to invoice. |
| 29:46 | `#/reports?tab=baseline` | click [data-act=export-baseline] | Each measure is broken down by month and by project, for any date range, with the definitions printed on the report itself. The report downloads as a PDF for the monthly review. |
| 29:58 | `#/reports?tab=hours` | hold | Hours by project and stage compares planned and logged hours for every fee stage. |
| 30:04 | `#/reports?tab=util` | highlight | Utilisation compares billable hours with available hours, by discipline and by person. People are listed alphabetically, never ranked: DrawingOps is not a productivity league table. |
| 30:17 | `#/reports?tab=review`<br>`#/reports?tab=missing` | hold | Review cycle shows the average working days in check by discipline and by checker, and how long sheets spend in each state. And the missing timesheets list sends reminders with one click. |

## 19 · Intelligence: forecasts and drawing checks

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 30:28 | (card) | hold | Chapter nineteen: intelligence. Every forecast and AI check in DrawingOps is advisory, clearly labelled, and switched on only after the firm has built up enough of its own history. |
| 30:40 | `#/portfolio` | zoom in | A model scores every open sheet's risk of going late, and explains its reasons: working days left, progress so far, the owner's load this week, the number of review rounds, and how often that discipline's sheets have run late. Forecasts never change any data. |
| 30:57 | `#/disciplines/M` | zoom in | The workload forecast projects each discipline's hours for the next eight weeks beside planned allocations and capacity, and shows its own measured error, so people know how far to trust it. |
| 31:09 | `#/intelligence/findings` | zoom in | AI drawing checks read the title blocks and cross-references of uploaded PDFs, and raise findings, such as an empty checked-by field, or a callout that points to a sheet missing from the register. Each finding shows its confidence. |
| 31:24 | `#/intelligence/findings` | click [data-act=fd-set][data-s=accepted] >> nth=0 | Nothing changes until a person decides. Accepting a finding records the decision and tells the sheet's owner; dismissing it is recorded too. |
| 31:34 | `#/admin/intelligence` | zoom in | The administrator controls each capability, off, evaluation or on. They unlock only after a gate: at least six months of clean history and two thousand issued revisions, with back-tested accuracy shown against simple rules. In this demonstration, the history, accuracy and forecast figures are simulated stand-ins. |

## 20 · Administration

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 31:56 | (card) | hold | Chapter twenty: administration. |
| 31:59 | `#/admin/organisation` | zoom in | Administration starts with the organisation: the firm's name and address, time zone, project code format, default weekly capacity, digest time, how long transmittal links stay valid, and when an unacknowledged transmittal is flagged. Dates, times and rupee amounts follow Indian formats throughout. |
| 32:19 | `#/admin/disciplines` | hold | Disciplines each carry their own sheet-number rule, with a live test beside it. |
| 32:24 | `#/admin/stage-templates` | hold | Stage templates mirror the firm's standard appointment letters, with their fee percentages, and one is the default. |
| 32:31 | `#/admin/codes` | hold | Revision codes follow the firm's scheme, P for preliminary and C for construction. A purpose is required on every issue, and ISO 19650 suitability codes are available for firms that use them. |
| 32:45 | `#/admin/naming-rules` | type "A101 ground floor rev.pdf"; zoom in; type "A-101_C02.pdf" | Naming rules come with a live tester. Paste a file name, and see immediately whether it passes, and if not, exactly why, with a valid example. |
| 32:55 | `#/admin/checklists`<br>`#/admin/calendar` | hold | Pre-check checklists are defined for each discipline and stage, with their mandatory items, and the working calendar sets the working week and holidays that every deadline, escalation and working-day count relies on. |
| 33:08 | `#/admin/users` | click [data-act=us-invite]; type "Kiran Bhat"; type "kiran.bhat@firm.example"; zoom in; click .dialog-foot .btn.primary | Users and roles shows each person's organisation role, how they sign in, and when they were last seen. People can be deactivated, but never deleted, so their history stays intact. New people are invited by email. |
| 33:22 | `#/mailbox?m=em_mvt221uu9lnv`<br>`#/invite/inv-gkd08qtq` | zoom in | The invitation arrives by email. The new person chooses a password, or signs in with the firm's Microsoft account, and sees projects once a project lead adds them to a team. |
| 33:34 | `#/admin/integrations` | hold | Integrations lists every connection with its status: single sign-on, local accounts with two-factor, outbound and inbound email, the Revit and AutoCAD plugins, the file-storage connector, clash import, and accounting. Scoped API tokens are created here and shown only once. Options that depend on the firm's tools, such as Autodesk Forma and Bluebeam, are marked as conditional. |
| 34:00 | `#/admin/onboarding` | click [data-act=ob-sample]; click [data-act=ob-load] | Onboarding loads a live project from a template workbook and a folder of issued PDFs, including historic revisions, without sending a single notification. Problems in the workbook are listed before anything is loaded. |
| 34:15 | `#/admin/audit` | zoom in; click [data-act=au-export] | Finally, the audit trail records every change: who made it, when, what it was before and after, from which address, with a request ID. Rows can never be edited or deleted, and the full trail exports as a background job that emails a link when it is ready. |

## 21 · Built for everyday use and for trust

| Time | Screen | Actions on screen | Narration |
|---|---|---|---|
| 34:32 | (card) | hold | Chapter twenty-one: the qualities that run through the whole product. |
| 34:36 | `#/portfolio` | click [data-act=user-menu]; zoom in; click .menu .mi:has-text("Dark") | Every screen also works in a dark theme, chosen from the account menu, and in a compact or comfortable row height. |
| 34:44 | `#/portfolio` | zoom in | Status is always shown with colour, an icon and a word, never colour alone. Every chart has a table view, and keyboard shortcuts cover the most frequent actions. |
| 34:54 | (card) | hold | Underneath, DrawingOps is designed so that the record can be trusted. Permissions are enforced on the server for every request, for each person's organisation role and project role. Issued files are never altered or overwritten. The audit trail is insert-only. Automations are safe to run twice. And a project's full record can be exported at any time. |
| 35:17 | (card) | hold | DrawingOps gives an architecture and MEP firm one live record of every sheet, from the day it is planned to the day it is invoiced: who owns it, where it stands, what is late, who is overloaded, and what the client holds. It works alongside the CAD tools the firm already uses, and it keeps the site on the current set. |
| 35:37 | (card) | hold | DrawingOps is built by LatentIQ. To see it working with your own projects and sheet lists, talk to the LatentIQ team. Thank you for watching. |

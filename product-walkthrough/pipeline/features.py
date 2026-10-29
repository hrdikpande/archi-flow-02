"""Feature catalogue and feature-to-video coverage map.

Every discovered feature with: id, name, module, roles, route, what it does, demo status (from the
demo code and demo/feature-coverage.md), how the video shows it, the step ids that show it, and the
coverage status. report.py checks every step id against the recorded timeline and writes
feature-inventory.md and coverage-report.md.

Coverage status:
  live       exercised in the recording against the demo's own implementation
  simulated  exercised in the recording; the outside system is simulated and labelled
  shown      on screen and narrated, without a dedicated interaction
  card       explained on a card or in narration only (not demonstrable in a browser)
  excluded   not in the video (reason given)
Roles: O owner, PL project lead, DL discipline lead, D designer, SR senior reviewer,
DC document controller, ACC accounts, ADM admin, EXT external, ALL everyone.
"""

F = [
  # ---------------- Platform: sign-in and access
  ("F-40a", "Sign in with Microsoft (SSO)", "Platform", "ALL", "#/sign-in, #/sso", "Staff sign in with the firm's Microsoft 365 / Google Workspace account; no new password.", "Simulated (account picker)", "Click Sign in with Microsoft; account picker", ["signin.02", "signin.03"], "simulated"),
  ("F-40b", "Local sign-in with TOTP two-factor", "Platform", "ADM", "#/sign-in", "Email and password plus a 6-digit authenticator code for admins and non-SSO users.", "Implemented in demo", "Type admin email and password; code prompt", ["signin.04"], "live"),
  ("F-40c", "Forgot / reset password by emailed code", "Platform", "ALL", "#/forgot, #/reset", "Local accounts request a 6-digit code by email and set a new password.", "Simulated email (demo mailbox)", "Forgot password page", ["signin.05"], "shown"),
  ("F-40d", "Show password, keep me signed in", "Platform", "ALL", "#/sign-in", "Reveal password toggle and persistent session option.", "Implemented in demo", "Visible on the sign-in form", ["signin.02", "signin.04"], "shown"),
  ("F-40e", "No public sign-up", "Platform", "ALL", "#/sign-in", "Accounts come only from SSO or an admin invitation.", "Implemented in demo", "Narrated on the sign-in page", ["signin.02"], "shown"),
  ("F-38", "Role-based navigation and access per project", "Platform", "ALL", "all", "Navigation, pages and actions follow the organisation role plus each project role.", "Implemented in demo (browser-enforced)", "Designer vs owner navigation; Accounts project tabs; role-specific My work", ["signin.06", "signin.07", "billing.08", "designer.02", "review.02", "issue.02", "billing.03"], "live"),
  ("F-38b", "No-access page for routes outside a role", "Platform", "ALL", "e.g. #/portfolio as designer", "Clear message instead of the page when a role lacks access.", "Implemented in demo", "Not shown on screen (navigation simply omits the item)", [], "excluded", "Shown indirectly: the designer's navigation has no Portfolio item. A dedicated no-access screen adds no client value."),
  ("INV", "User invitations by email", "Platform", "ADM", "#/admin/users, #/invite/:token", "Admin invites by email; invitee sets a password or uses SSO.", "Simulated email", "Invite user dialog, invitation email, accept page", ["admin.08", "admin.09"], "simulated"),
  ("PROF", "Profile and delegation settings", "Platform", "ALL", "#/settings/profile", "Personal details and review delegation.", "Implemented in demo", "Delegation shown from the review queue", ["review.07"], "live"),

  # ---------------- Dashboards
  ("D-04", "My work (designer)", "Dashboards", "D", "#/", "Own sheets by due date with state, flags and one next action; returned sheets; hours this week.", "Implemented in demo", "Rahul's My work; Start in one click", ["designer.02", "designer.03", "designer.04"], "live"),
  ("D-04b", "My work variants per role", "Dashboards", "DL, DC, ACC, PL, ADM", "#/", "Waiting for your check (DL/SR), ready to issue (DC), ready to invoice (ACC/O), projects you lead (PL), firm set-up (ADM).", "Implemented in demo", "Anil, Deepa and Meera's home pages", ["review.02", "issue.02", "billing.03"], "live"),
  ("D-01", "Owner portfolio dashboard", "Dashboards", "O, PL, ADM", "#/portfolio", "Five metric cards with week-on-week delta, project table, discipline load, forecast list.", "Implemented in demo", "Portfolio walk-through", ["portfolio.02", "portfolio.03", "portfolio.06", "portfolio.08"], "live"),
  ("D-01b", "Every number opens the list behind it", "Dashboards", "O", "#/sheets?flag=late", "Metric cards open the exact filtered list; counts match.", "Implemented in demo", "Click Late sheets", ["portfolio.04"], "live"),
  ("D-01c", "Portfolio filters (lead, type) and sorting", "Dashboards", "O", "#/portfolio", "Filter by project lead or type; sortable columns.", "Implemented in demo", "Filter by Priya Sharma", ["portfolio.09"], "live"),
  ("D-02", "Project dashboard", "Dashboards", "PL, O, all members", "#/projects/:pid", "Metrics, burn-up, stage timeline, late sheets, project card, team load, transmittals, comments, change orders, forecast.", "Implemented in demo", "HSR Block B overview", ["project.02", "project.03", "project.04", "project.05", "project.06", "project.07"], "live"),
  ("D-02b", "Burn-up chart with discipline filter and table view", "Dashboards", "PL", "#/projects/:pid", "Planned vs issued cumulative sheets; chart can be read as a table.", "Implemented in demo", "Discipline filter set to HVAC", ["project.04"], "live"),
  ("D-03", "Discipline dashboard", "Dashboards", "DL", "#/disciplines/:code", "Late, at risk, check queue, approved-not-issued, assignments, capacity, workload forecast.", "Implemented in demo", "Architecture dashboard; HVAC forecast", ["review.08", "intel.03"], "live"),
  ("SL", "Sheets list (behind dashboard numbers)", "Dashboards", "ALL", "#/sheets", "Cross-project sheet list with flag, discipline and text filters, pagination and export.", "Implemented in demo", "Late sheets list", ["portfolio.04", "portfolio.05"], "live"),
  ("F-52a", "Portfolio late/at-risk export", "Dashboards", "O", "#/portfolio", "Export late and at-risk sheets to Excel, PDF or CSV.", "Implemented in demo", "Export menu opened", ["portfolio.09"], "live"),

  # ---------------- Projects and stages
  ("PL-LIST", "Projects list", "Projects", "ALL", "#/projects", "Search, state and type filters, issued/planned and late counts, export.", "Implemented in demo", "Projects list", ["stages.02"], "shown"),
  ("F-01", "New project (record, client, type, fee, dates, lead, DC, CAD versions)", "Projects", "O, PL, ADM", "#/projects/new", "Creates the project with stages from a template; client added to contacts.", "Implemented in demo", "Fill the form and create", ["stages.03", "stages.05"], "live"),
  ("F-01b", "Unique project code validation", "Projects", "PL", "#/projects/new", "Duplicate code refused with the name of the project that uses it.", "Implemented in demo", "Re-use 2026-014", ["stages.04"], "live"),
  ("F-01c", "Edit project (name, end date, fee, state)", "Projects", "PL, O, ADM", "#/projects/:pid", "Edit drawer; closing keeps all records.", "Implemented in demo", "Edit button visible on the project card", ["project.06"], "shown"),
  ("F-02", "Fee-stage plan from appointment letter, 100% rule", "Projects", "PL", "#/projects/:pid/stages", "Editable fee %, dates, required purposes, senior QC; total must be 100% to save as final.", "Implemented in demo", "Change a fee %, see the warning, fix, save as final", ["stages.06", "stages.07", "stages.08"], "live"),
  ("F-02b", "Appointment letter attach and download", "Projects", "PL", "#/projects/:pid/stages", "Attach the letter as PDF; download from the project card.", "Implemented in demo", "Attached letter shown on HSR Block B stages and card", ["stages.09", "project.06"], "shown"),
  ("F-02c", "Apply stage template; add stage", "Projects", "PL", "#/projects/:pid/stages", "Replace a not-started plan with a template; add stages.", "Implemented in demo", "Apply template control visible; template applied on creation", ["stages.05", "stages.06"], "shown"),
  ("F-03", "Stage states roll up from sheets", "Projects", "PL", "#/projects/:pid/stages", "Planned → Active (first sheet started) → Deliverables issued (all issued) → Client approved → Ready to invoice → Invoiced → Closed; fee % locks after invoicing.", "Implemented in demo", "Live stage states on HSR Block B; lifecycle card", ["intro.05", "stages.09", "designer.03"], "live"),
  ("TEAM", "Team and project roles; add/remove member", "Projects", "PL, ADM", "#/projects/:pid/team", "Members with project role, discipline, hours here and load; add notifies by app and email.", "Implemented in demo", "Add Tanvi Shah as designer", ["stages.10", "stages.11"], "live"),
  ("F-45", "Project activity feed", "Projects", "ALL members", "#/projects/:pid/activity", "Every state change, issue, transmittal, stage event, import and comment; filters.", "Implemented in demo", "Filter to transmittals", ["stages.12"], "live"),
  ("N-06", "Full project export (JSON + issued PDFs)", "Projects", "PL, O, ADM", "#/projects/:pid", "One ZIP with every record and current issued PDFs.", "Implemented in demo", "Export data", ["project.08"], "live"),
  ("F-43", "Contacts and external organisations", "Projects", "ALL", "#/contacts", "Clients, consultants, contractors, authorities; duplicate-email warning; export.", "Implemented in demo", "Contacts list", ["search.05"], "shown"),
  ("SITE-LINK", "Project email address and site-view link", "Projects", "PL", "#/projects/:pid", "Per-project inbound email address; copy the site view link.", "Simulated inbound email", "Project card", ["project.06", "comments.06"], "shown"),

  # ---------------- Register
  ("F-04", "Sheet register", "Register", "PL, DL, all members", "#/projects/:pid/register", "Every sheet with number, title, discipline, package, owner, checker, state, planned date, revision, flags.", "Implemented in demo", "Register of 132 sheets", ["register.02"], "live"),
  ("F-04b", "Register search (number, title, alias, owner)", "Register", "ALL", "#/projects/:pid/register", "Instant text search.", "Implemented in demo", "Type OT duct", ["register.03"], "live"),
  ("F-04c", "Register filters and Late / At-risk toggles", "Register", "ALL", "#/projects/:pid/register", "Discipline, stage, state, owner, package filters; flag toggles.", "Implemented in demo", "HVAC + Late only", ["register.04"], "live"),
  ("F-04d", "Grouping, sorting, column chooser", "Register", "ALL", "#/projects/:pid/register", "Group by discipline/package/stage with counts; sortable; show/hide columns.", "Implemented in demo", "Group by discipline", ["register.05"], "live"),
  ("SV", "Saved views", "Register", "ALL", "#/projects/:pid/register", "Save filters, grouping and sort as a named view.", "Implemented in demo", "Saved views menu", ["register.05"], "shown"),
  ("F-04e", "Inline edit with undo", "Register", "PL, DL", "#/projects/:pid/register", "Owner, checker, package, planned date edited in the table; audited; undo.", "Implemented in demo", "Change an owner; Undo toast", ["register.06"], "live"),
  ("F-46", "Bulk actions with skipped report", "Register", "PL, DL, DC", "#/projects/:pid/register", "Assign owner/checker, shift dates ± working days, move to package, change state, issue, export selected.", "Implemented in demo", "Select 4, shift +5 working days, change-state menu", ["register.07", "register.08", "register.09"], "live"),
  ("F-49", "Packages with planned dates", "Register", "PL, DL", "#/projects/:pid/register", "Sheets without their own date inherit the package date; new package.", "Implemented in demo", "Package column, 'pkg' inherited dates", ["register.06", "register.07"], "shown"),
  ("F-04f", "New sheet with live number check", "Register", "PL, DL", "#/projects/:pid/register", "Sheet exists before any file; number checked against the discipline rule.", "Implemented in demo", "Type A1O1 (invalid) then A-118", ["register.10"], "live"),
  ("F-52", "Exports to Excel / PDF / CSV", "Register", "ALL", "lists", "Every list exports with current filters; over 5,000 rows run as a background job.", "Implemented in demo", "Register export menu; audit export job", ["register.11", "admin.12"], "live"),
  ("KB", "Keyboard shortcuts", "Platform", "ALL", "global", "Ctrl/⌘K, ?, g-m/g-r/g-w/g-v, j/k/x/Enter in the register, s and a.", "Implemented in demo", "Shortcut hint and the shortcuts dialog", ["register.11", "platform.03"], "shown"),
  ("F-05", "Excel/CSV import wizard with mapping, preview, undo", "Register", "PL, DL", "#/projects/:pid/import", "Upload, auto-mapped columns, row-level problems, all-or-nothing commit, undo within 24 h.", "Implemented in demo", "Sample with 3 errors; skip; import; undo", ["intake.02", "intake.03", "intake.04", "intake.05"], "live"),
  ("F-06", "Revisions: PDF upload creates the next draft code", "Register", "D, PL, DC", "#/projects/:pid/upload, sheet page", "Each PDF becomes a draft revision (P01, C01…); one current revision per sheet.", "Implemented in demo", "Upload 3 PDFs", ["intake.06", "intake.07"], "live"),
  ("F-50", "Title-block reading for unmatched PDFs", "Register", "PL, DC", "#/projects/:pid/upload", "A scan with no sheet number in its name is matched from its title-block text.", "Implemented in demo", "scan_0042.pdf matched to F-101", ["intake.06"], "live"),
  ("F-35", "Naming checks on upload (A-04)", "Quality", "ALL", "upload, issue composer", "File name and sheet number rules; issue blocked with rule text and a valid example.", "Implemented in demo", "A104 ground floor rev.pdf blocked; renamed in the composer", ["intake.06", "intake.07", "issue.04", "issue.05"], "live"),
  ("N-03a", "Upload safety checks", "Platform", "ALL", "upload", "PDF magic-byte check, 200 MB limit, SHA-256 duplicate check.", "Implemented in demo", "Narrated during upload", ["intake.07"], "shown"),
  ("F-09", "Revit / AutoCAD sheet-list sync (proposals)", "Integrations", "PL, DL", "#/projects/:pid/cad-sync", "Plugins propose new sheets and title changes; nothing is created until a lead accepts.", "Simulated plugins", "Proposals list; accept M-210", ["intake.08", "intake.09"], "simulated"),
  ("I-02", "File-storage connector (CAD file activity)", "Integrations", "ALL", "CAD sync, sheet page", "Shows when a CAD file was last saved and by whom.", "Simulated", "File storage activity card; CAD file activity on the sheet", ["intake.09", "sheet.07"], "simulated"),
  ("F-54", "Onboarding of a live project with historic revisions", "Register", "ADM", "#/admin/onboarding", "Template workbook + PDFs; problems listed first; loads silently.", "Implemented in demo", "Sample workbook, load project", ["admin.11"], "live"),

  # ---------------- Sheet page
  ("F-47", "Sheet page with PDF viewer", "Sheet", "ALL", "#/projects/:pid/sheets/:sid", "Header, state, flags, forecast, viewer with download/new tab/full screen.", "Implemented in demo", "M-205 sheet page", ["sheet.02", "sheet.03"], "live"),
  ("F-48", "Superseded banner and SUPERSEDED watermark", "Sheet", "ALL", "sheet page, downloads", "Old revisions show a red banner and download with a diagonal watermark and date.", "Implemented in demo", "Open P01 of M-205", ["sheet.04"], "live"),
  ("REV", "Revisions list and reviews history", "Sheet", "ALL", "sheet page", "Every revision with purpose and transmittal; every check and senior QC decision.", "Implemented in demo", "Revisions and Reviews cards", ["sheet.04", "sheet.05"], "shown"),
  ("DIST", "Who has which revision (distribution)", "Sheet", "ALL", "sheet page; transmittals matrix", "Per recipient: revision held, transmittal, download and acknowledgement.", "Implemented in demo", "Distribution card; matrix view", ["sheet.06", "issue.11"], "shown"),
  ("TL", "Sheet activity timeline", "Sheet", "ALL", "sheet page", "Every transition with who, when and why.", "Implemented in demo", "Activity card", ["sheet.07"], "shown"),
  ("F-41", "CAD file link (linked, not copied)", "Sheet", "ALL", "sheet page", "Copy the CAD file path; issued PDFs held in object storage.", "Simulated storage", "CAD file path with Copy path", ["sheet.07"], "shown"),
  ("NOTES", "Working notes, edit details", "Sheet", "PL, DL, D (notes)", "sheet page › More", "Working notes and sheet detail edits, audited.", "Implemented in demo", "More menu", ["sheet.08"], "shown"),
  ("OVR", "Project-lead override with reason; hold, cancel, supersede, delete", "Workflow", "PL", "sheet page › More", "Override stays within the transition table; hold/cancel/supersede need a reason; never-issued sheets can be deleted.", "Implemented in demo", "More menu items shown", ["sheet.08"], "shown"),

  # ---------------- Workflow and review
  ("F-10", "Sheet state machine, one-click transitions, audit", "Workflow", "D, DL, SR, DC, PL", "My work, sheet page, reviews", "One transition table for every sheet; allowed actions per role.", "Implemented in demo", "Start, Submit, Return, Approve, Issue throughout", ["intro.05", "designer.03", "designer.07", "review.05", "review.06", "review.10", "issue.09"], "live"),
  ("F-13", "Designer pre-check checklists", "Workflow", "D", "Submit for check", "Mandatory items block submission; ticks stored with the review.", "Implemented in demo", "Submit blocked, then ticked and submitted", ["designer.05", "designer.06", "designer.07"], "live"),
  ("F-11", "Return with comment or redlines (required)", "Workflow", "DL, SR", "#/reviews", "Return needs a comment or redline file; designer notified.", "Implemented in demo", "Return A-401 with a comment", ["review.04", "review.05", "designer.08"], "live"),
  ("F-12", "Review queue, oldest first, waiting days; delegation", "Workflow", "DL, SR", "#/reviews", "Queue with working days waited, overdue flag, scope and kind filters; set a delegate for dates.", "Implemented in demo", "Anil's queue; delegate dialog", ["review.03", "review.07"], "live"),
  ("SQC", "Senior QC as a second step", "Workflow", "SR", "#/reviews", "Stages that need senior QC hold the sheet in check until the senior reviewer approves.", "Implemented in demo", "A-107: first check, then Sunita approves", ["review.06", "review.09", "review.10"], "live"),
  ("RESTART", "Start revisions after a return", "Workflow", "D", "My work, sheet page", "Returned sheet goes back to In progress.", "Implemented in demo", "Start revisions button on M-204", ["designer.04", "designer.08"], "shown"),

  # ---------------- Issue and transmittals
  ("F-14", "Issue composer and numbered transmittals", "Transmittals", "DC, PL", "#/projects/:pid/issue", "Sheets, purpose, recipients (email and by hand), note, preview, confirm; sequential numbers.", "Implemented in demo", "Issue 13 sheets as GFC on 2026-014-TR-0033", ["issue.03", "issue.04", "issue.05", "issue.06", "issue.07", "issue.08", "issue.09"], "live"),
  ("F-08", "Purpose (and suitability) per issue", "Transmittals", "DC", "issue composer; admin codes", "Purpose required; ISO 19650 suitability optional.", "Implemented in demo", "Choose Good for Construction", ["issue.06", "admin.05"], "live"),
  ("COVER", "Transmittal cover sheet PDF", "Transmittals", "DC, EXT", "issue composer, transmittal page", "Generated cover with project, purpose, recipients and drawings.", "Implemented in demo", "Preview cover sheet", ["issue.07", "issue.12"], "live"),
  ("F-07", "Automatic superseding on issue (A-03)", "Transmittals", "DC", "issue", "Earlier revisions superseded in the same step; earlier recipients emailed.", "Implemented in demo", "7 earlier revisions superseded; New revision email", ["issue.08", "issue.09", "client.06"], "live"),
  ("TLOG", "Transmittal log, filters, matrix, export", "Transmittals", "ALL members", "#/projects/:pid/transmittals", "Every issue with purpose, sheets, recipients, acknowledgement and bounce status.", "Implemented in demo", "Log and matrix view", ["issue.10", "issue.11"], "live"),
  ("TDET", "Transmittal detail, resend, correction transmittal", "Transmittals", "DC", "#/projects/:pid/transmittals/:tid", "Per-recipient delivery, download and acknowledgement; resend; corrections are new transmittals.", "Implemented in demo", "TR-0032 with a bounced email and Resend", ["issue.12", "client.08"], "shown"),
  ("I-12", "Outbound email (SMTP)", "Integrations", "ALL", "demo mailbox", "Transmittals, notifications, resets, invitations, digests and summaries by email.", "Simulated (demo mailbox)", "Mailbox messages", ["client.02", "alerts.04", "alerts.09", "admin.09"], "simulated"),

  # ---------------- External
  ("S-15", "External transmittal page (no login)", "External", "EXT", "#/t/:token", "Secure link page with transmittal details and every drawing.", "Implemented in demo", "Open drawings from the email", ["client.03"], "live"),
  ("ZIP", "Download one or all as ZIP with cover", "External", "EXT", "#/t/:token", "Single downloads or ZIP including the cover sheet.", "Implemented in demo", "Download all (ZIP)", ["client.04"], "live"),
  ("F-15", "Recipient acknowledgement of receipt", "External", "EXT", "#/t/:token", "Records date and time; sender sees it immediately.", "Implemented in demo", "Acknowledge, then see it on the transmittal", ["client.05", "client.08"], "live"),
  ("F-51", "Site view: current issued set on a phone", "External", "EXT", "#/site/:token", "Phone-first list of current issued revisions only, with search.", "Implemented in demo", "Phone-size capture on a card", ["client.07"], "live"),

  # ---------------- Client comments and approvals
  ("F-24", "Client comment log", "Comments", "PL, DL, DC", "#/projects/:pid/comments", "Numbered comments with source, sheets, assignee, status; response required to close; reject; export.", "Implemented in demo", "Log a comment; close with a response", ["comments.02", "comments.04", "comments.05"], "live"),
  ("A-08", "Client comment overdue (A-08)", "Automation", "PL", "comments", "No response after N days flags and reminds.", "Implemented in demo", "Overdue filter", ["comments.03"], "live"),
  ("F-25", "Capture comments from forwarded email; unknown-sender queue", "Comments", "PL", "#/projects/:pid/comments", "Project email address logs known senders; unknown senders wait for review.", "Simulated inbound email", "Simulate forwarded email; accept from queue", ["comments.06", "comments.07"], "simulated"),
  ("F-58a", "Decisions log", "Knowledge", "PL", "#/projects/:pid/decisions", "Decisions with context and sheets; searchable.", "Implemented in demo", "Record a decision", ["comments.08"], "live"),
  ("F-26", "Client approval per stage with evidence", "Comments", "PL", "#/projects/:pid/stages", "Approved by, date, evidence file, note.", "Implemented in demo", "Record approval for Mysuru stage 5 with the letter", ["comments.09", "comments.10"], "live"),

  # ---------------- Billing
  ("A-09", "Ready-to-invoice signal (A-09)", "Billing", "PL, ACC, O", "stages, billing", "Deliverables issued + client approval → ready to invoice; Accounts, owner, PL notified.", "Implemented in demo", "Stage 5 becomes ready to invoice", ["comments.10", "billing.03", "billing.04"], "live"),
  ("F-27", "Billing signals list", "Billing", "ACC, O, PL", "#/billing", "Ready stages with fee %, amount, waiting days and approval evidence.", "Implemented in demo", "Meera's billing signals", ["billing.04"], "live"),
  ("F-28", "Accounting export (CSV) and webhook push; mark invoiced", "Billing", "ACC", "#/billing", "CSV in configured columns; signed webhook; invoice reference and date.", "Partially simulated (webhook)", "Export CSV, push (simulated), mark invoiced", ["billing.05", "billing.06"], "simulated"),
  ("INVD", "Invoiced history", "Billing", "ACC, O", "#/billing/invoiced", "Invoiced stages with reference and days from deliverables to invoice.", "Implemented in demo", "Invoiced tab", ["billing.07"], "shown"),
  ("I-08", "Accounting integration settings (columns, webhook, SSRF guard)", "Integrations", "ADM", "#/admin/integrations", "Choose CSV columns, webhook URL with private-address guard, enable, test event.", "Simulated webhook", "Enable the webhook", ["billing.02"], "simulated"),
  ("F-29", "Invoicing, GST, ledger", "Billing", "—", "—", "Deliberately out of scope; stays in the accounting tool.", "Out of scope by design", "Stated in narration", ["billing.07"], "card"),
  ("ACCV", "Accounts' narrow project view", "Platform", "ACC", "#/projects/:pid", "Stages and fees only.", "Implemented in demo", "Overview and Stages tabs only", ["billing.08"], "live"),

  # ---------------- People
  ("F-19", "Workload heat map (over/under, A-05)", "People", "PL, DL, O", "#/workload", "Planned hours vs capacity per person and week; icon + word + %; filters.", "Implemented in demo", "Heat map; HVAC filter", ["people.02", "people.03"], "live"),
  ("F-17", "Allocations per person × project-stage × week", "People", "PL, DL", "#/workload", "Cell drawer with inline edit and copy to next 3 weeks; Allocate dialog.", "Implemented in demo", "Copy forward; new allocation", ["people.04", "people.05"], "live"),
  ("F-16", "Staff directory: discipline, capacity, leave", "People", "DL, ADM, all", "#/workload/staff", "Capacity and leave drive the heat map.", "Implemented in demo", "Staff directory", ["people.06"], "shown"),
  ("F-18", "Weekly timesheets; CSV import; submit and lock", "People", "ALL except ADM", "#/timesheets", "Rows from allocations; day grid; import CSV; submit locks the week.", "Implemented in demo", "Enter hours, submit week 44", ["people.07", "people.08"], "live"),
  ("F-18b", "Timesheet approvals; return; remind", "People", "DL, PL", "#/timesheets/approvals", "Approve, return with reason, approve all, remind missing people.", "Implemented in demo", "Approve a week", ["people.09"], "live"),
  ("N-10", "Hours visibility and no ranking", "People", "ALL", "team, reports", "Hours visible to self, DL, PL and owner; utilisation never ranks people.", "Implemented in demo", "Narrated with team and utilisation screens", ["stages.10", "reports.05", "billing.08"], "shown"),

  # ---------------- Alerts and automation
  ("F-20", "At-risk and late flags (A-01, A-02)", "Automation", "ALL", "register, dashboards", "Computed from planned dates and the working calendar; escalation after 3 working days.", "Implemented in demo", "Flags throughout; late list", ["portfolio.03", "portfolio.05", "register.04"], "live"),
  ("F-21", "Notification centre", "Alerts", "ALL", "bell panel", "Today / earlier, unread, link to the item, mark all read.", "Implemented in demo", "Owner and designer panels", ["portfolio.10", "alerts.02"], "live"),
  ("F-21b", "Notification preferences, mandatory alerts, quiet hours, digest", "Alerts", "ALL", "#/settings/notifications", "Instant / digest / off per event; mandatory locked; quiet hours; send digest now.", "Implemented in demo", "Preferences table; digest email", ["alerts.03", "alerts.04"], "live"),
  ("AUTO", "Automation rules A-01..A-10 with thresholds", "Automation", "ADM", "#/admin/automation", "Ten rules with schedule, condition, thresholds and on/off.", "Implemented in demo", "Automation table", ["alerts.05"], "shown"),
  ("SWEEP", "Idempotent daily sweep and run log; missing-sweep warning (N-05)", "Automation", "ADM", "#/admin/automation", "Run now; second run sends nothing twice; run log with counts and durations.", "Implemented in demo", "Run twice; run log", ["alerts.06", "alerts.07", "alerts.08"], "live"),
  ("A-03", "Supersede and tell earlier recipients (A-03)", "Automation", "DC", "issue", "On issue.", "Implemented in demo", "New revision email", ["issue.09", "client.06"], "live"),
  ("A-05", "Over/under allocation (A-05)", "Automation", "PL, DL", "workload", "Weekly > 110% / < 50%.", "Implemented in demo", "Heat map flags", ["people.02"], "shown"),
  ("A-06", "Timesheet missing (A-06)", "Automation", "ALL", "timesheets, approvals, reports", "Reminder after Tuesday 12:00.", "Implemented in demo", "Hours missing flags, missing timesheets report", ["people.08", "people.09", "reports.06"], "shown"),
  ("A-07", "Review overdue (A-07)", "Automation", "DL, SR", "reviews", "Open > 3 working days escalates to delegate or DL.", "Implemented in demo", "Overdue badges in the queue", ["review.03"], "shown"),
  ("A-10", "RFI due (A-10)", "Automation", "PL", "construction", "RFI due within 2 working days flagged and reminded.", "Implemented in demo", "Due in 1 d flags", ["construction.02"], "shown"),
  ("SUMMARY", "Weekly owner summary email", "Alerts", "O", "email", "Monday morning summary of late, at-risk, overloaded and ready-to-invoice.", "Simulated email", "Summary email in the mailbox", ["alerts.09"], "simulated"),

  # ---------------- Construction
  ("F-30", "RFI log; answer starts next revision", "Construction", "PL, DL", "#/projects/:pid/construction/rfis", "Question, raised by, ball in court, due, sheets, impact; answering can restart linked sheets.", "Implemented in demo", "Answer RFI-011 with next revision", ["construction.02", "construction.03"], "live"),
  ("F-31", "Submittal log and stamped review", "Construction", "PL, DL", "#/projects/:pid/construction/submittals", "Review and stamp (approved, as noted, revise, rejected); stamped PDF.", "Implemented in demo", "Stamp a submittal Approved as noted", ["construction.04"], "live"),
  ("F-32", "Site visit reports with photos", "Construction", "PL, DL", "#/projects/:pid/construction/site", "Attendees, weather, observations, photos compressed and EXIF removed, PDF export.", "Implemented in demo", "File a report with a photo", ["construction.05"], "live"),
  ("F-33", "Change-order log", "Construction", "PL", "#/projects/:pid/construction/changes", "Cost, time, source, sheets; PL approves; approved total.", "Implemented in demo", "Approve CO-01", ["construction.06"], "live"),
  ("F-34", "Clash import (BCF) as issues", "Coordination", "PL, DL", "#/projects/:pid/construction/clashes", "Viewpoints, disciplines, sheets, assignee, status; re-import updates by GUID.", "Implemented in demo (sample BCF)", "Import sample .bcfzip: 2 new, 1 updated", ["construction.07"], "live"),

  # ---------------- Search, knowledge, reports
  ("F-44", "Command search (⌘K / Ctrl+K)", "Search", "ALL", "global", "Sheets, projects, transmittals, contacts and actions across visible projects.", "Implemented in demo", "Search A-101 and OT duct", ["search.02", "search.03"], "live"),
  ("F-58", "Knowledge search", "Knowledge", "ALL", "#/knowledge", "Decisions, comments, RFIs and review comments with highlights and filters.", "Implemented in demo", "OT ceiling HEPA", ["search.04"], "live"),
  ("F-53", "Baseline metrics report (D-05) with PDF", "Reports", "O, ADM", "#/reports?tab=baseline", "Four measures, by month and project, definitions printed.", "Implemented in demo", "Baseline tab; export PDF", ["reports.02", "reports.03"], "live"),
  ("RPT-H", "Hours by project and stage", "Reports", "O, PL, DL, ACC", "#/reports?tab=hours", "Planned vs logged hours per stage; export.", "Implemented in demo", "Hours tab", ["reports.04"], "shown"),
  ("RPT-U", "Utilisation (never ranked)", "Reports", "O, PL, DL", "#/reports?tab=util", "Billable / available by discipline and person, alphabetical.", "Implemented in demo", "Utilisation tab", ["reports.05"], "shown"),
  ("RPT-R", "Review cycle report", "Reports", "O, PL, DL, ACC", "#/reports?tab=review", "Days in check by discipline and checker; time in each state.", "Implemented in demo", "Review cycle tab (passes on screen briefly)", ["reports.06"], "shown"),
  ("RPT-M", "Missing timesheets with reminders", "Reports", "O, PL, DL", "#/reports?tab=missing", "List for last week; send reminders now.", "Implemented in demo", "Missing timesheets tab", ["reports.06"], "shown"),

  # ---------------- Intelligence
  ("F-55", "Late-risk prediction (advisory)", "Intelligence", "O, PL, DL", "portfolio, overview, sheet", "Probability with reasons; never changes data.", "Simulated model (deterministic stand-in)", "Forecast list, forecast chips", ["portfolio.07", "intel.02", "sheet.02"], "simulated"),
  ("F-56", "Workload forecast (advisory)", "Intelligence", "O, PL, DL", "discipline, workload", "8-week forecast beside allocations and capacity, with MAPE.", "Simulated model", "HVAC forecast chart", ["intel.03", "people.03"], "simulated"),
  ("F-57", "AI drawing checks, human-approved", "Intelligence", "SR, DC, ADM", "#/intelligence/findings", "Findings with confidence; accept or dismiss; owner told.", "Simulated model", "Accept a finding", ["intel.04", "intel.05"], "simulated"),
  ("G3", "Intelligence modes and gate G3", "Intelligence", "ADM", "#/admin/intelligence", "Off / evaluation / on; unlocks after 6 months and 2,000 issued revisions; back-test figures.", "Simulated figures", "Admin intelligence page", ["intel.06"], "simulated"),

  # ---------------- Administration
  ("F-42a", "Organisation settings", "Admin", "ADM", "#/admin/organisation", "Name, address, time zone, code format, capacity, digest time, link validity, acknowledgement days.", "Implemented in demo", "Organisation page", ["admin.02"], "shown"),
  ("F-42b", "Disciplines and sheet-number rules", "Admin", "ADM", "#/admin/disciplines", "Per-discipline regex with live test.", "Implemented in demo", "Disciplines page", ["admin.03"], "shown"),
  ("F-42c", "Stage templates", "Admin", "ADM", "#/admin/stage-templates", "Standard fee-stage templates; default.", "Implemented in demo", "Templates page", ["admin.04"], "shown"),
  ("F-42d", "Revision and purpose codes; ISO 19650 suitability", "Admin", "ADM", "#/admin/codes", "Revision scheme (P/C), purpose list, optional suitability codes.", "Implemented in demo", "Codes page", ["admin.05"], "shown"),
  ("F-42e", "Naming rules with live tester", "Admin", "ADM", "#/admin/naming-rules", "Rules for sheet numbers and file names; pass/fail with reason.", "Implemented in demo", "Test a failing and a passing name", ["admin.06"], "live"),
  ("F-42f", "Checklists admin", "Admin", "ADM", "#/admin/checklists", "Pre-check items per discipline and stage.", "Implemented in demo", "Checklists page (brief)", ["admin.07"], "shown"),
  ("F-42g", "Working calendar and holidays", "Admin", "ADM", "#/admin/calendar", "Working week and holidays used by every automation.", "Implemented in demo", "Calendar page", ["admin.07"], "shown"),
  ("USERS", "Users and roles; deactivate (never delete)", "Admin", "ADM", "#/admin/users", "Org role, sign-in method, last seen; invitations waiting; resend/withdraw.", "Implemented in demo", "Users page", ["admin.08"], "shown"),
  ("I-INT", "Integrations overview and API tokens", "Integrations", "ADM", "#/admin/integrations", "Status of every integration; scoped tokens shown once; conditional items.", "Simulated integrations", "Integrations page", ["admin.10"], "shown"),
  ("F-39", "Audit trail (insert-only) and background export", "Platform", "ADM, O", "#/admin/audit", "Actor, time, entity, before/after, IP, request ID; export as background job with emailed link.", "Implemented in demo", "Audit table; export", ["admin.12"], "live"),
  ("ADM-CONTACTS", "Contacts in admin", "Admin", "ADM", "#/admin/contacts", "Same contact list under admin.", "Implemented in demo", "Not shown separately", [], "excluded", "Same screen as Contacts (shown in chapter 17)."),

  # ---------------- Platform qualities
  ("THEME", "Dark theme and row density", "Platform", "ALL", "account menu", "Light/dark/system theme; compact or comfortable rows.", "Implemented in demo", "Switch to dark", ["platform.02"], "live"),
  ("N-04", "Accessibility: colour + icon + word, table views, focus, skip link", "Platform", "ALL", "all", "WCAG 2.2 AA target; axe-checked in the demo.", "Implemented in demo", "Narrated with chips, chart tables and shortcuts", ["platform.03", "project.04"], "shown"),
  ("N-07", "Desktop, tablet and phone layouts", "Platform", "ALL", "all", "Responsive from 390 px.", "Implemented in demo", "Phone site view", ["client.07"], "shown"),
  ("N-08", "Indian formats (dates, ₹ grouping, IST)", "Platform", "ALL", "all", "23-Oct-2026 dates, 24-hour IST, ₹ with Indian grouping.", "Implemented in demo", "Visible throughout; narrated in admin", ["admin.02"], "shown"),
  ("TRUST", "Server-side permissions, immutable issued files, insert-only audit, idempotent sweeps", "Platform", "—", "architecture", "Design guarantees of the production system.", "Not demonstrable in a browser prototype (server-side)", "Explained on a card", ["platform.04"], "card"),
  ("N-01", "Performance targets", "Platform", "—", "—", "p95 API < 300 ms; register < 1 s; dashboards < 2 s.", "Partially simulated (browser only)", "Register 'rendered in 1 ms' visible; not narrated as a target", [], "excluded", "No production measurement exists; claiming targets as results would mislead."),
  ("N-02", "Availability, backups, restore drill", "Platform", "—", "—", "Operational requirements.", "Not applicable to a browser demo", "—", [], "excluded", "Infrastructure; nothing to show and no production deployment to cite."),
  ("N-09", "Capacity 300 users, 100k sheets", "Platform", "—", "—", "Scale target.", "Not applicable", "—", [], "excluded", "Not verified in production."),

  # ---------------- Integrations with no product UI yet
  ("I-05", "Autodesk Forma", "Integrations", "—", "#/admin/integrations", "Conditional on the firm using Forma.", "Not built (conditional)", "Listed as Conditional on the integrations page", ["admin.10"], "card"),
  ("I-06", "Bluebeam Studio", "Integrations", "—", "#/admin/integrations", "Conditional on developer access.", "Not built (conditional)", "Listed as Conditional", ["admin.10"], "card"),
  ("I-10", "WhatsApp Business API", "Integrations", "—", "#/admin/integrations", "Decision pending (privacy); WhatsApp is a manual comment source.", "Not built (decision pending)", "Comment source shown; API not claimed", ["comments.02"], "card"),
  ("I-13", "Paperless-ngx archive", "Integrations", "—", "#/admin/integrations", "Decision pending.", "Not built (decision pending)", "Not narrated", [], "excluded", "Decision pending; not a product capability today."),

  # ---------------- Demo-only aids
  ("DEMO-MB", "Demo mailbox (stands in for email)", "Demo only", "—", "#/mailbox", "Shows every email the product would send.", "Demo-only", "Used and labelled as a demonstration mailbox", ["client.02", "alerts.04", "alerts.09", "admin.09"], "card"),
  ("DEMO-CTL", "Demo menu, guided tour, reset, Demo Access panel", "Demo only", "—", "Demo button", "Prototype harness controls.", "Demo-only", "Hidden in the recording on purpose", [], "excluded", "Not part of the product; the Demo Access panel shows prototype passwords."),
  ("F-36/F-37", "AI drawing checks before Phase 4; drawing authoring", "Out of scope", "—", "—", "Never built in P1–P3 / never built.", "Out of scope", "—", [], "excluded", "Out of scope by design."),
]

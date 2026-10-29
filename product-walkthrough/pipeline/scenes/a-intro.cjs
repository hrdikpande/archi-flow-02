/* Chapters 00 to 03: introduction, sign-in and roles, owner portfolio, project dashboard. */
const chapterCard = (num, title, lead, roles, items) => ({ type: "chapter", num, title, lead, roles, items });

module.exports = [
  {
    id: "intro", num: "00", title: "Introduction",
    steps: [
      {
        say: "This is DrawingOps: drawing and deliverable control for architecture and MEP design firms. It works alongside the AutoCAD and Revit tools your teams already use, and gives everyone one live record of every sheet, review, transmittal, deadline and fee stage.",
        act: async (r) => { await r.card({ type: "title", tagline: "Drawing and deliverable control for architecture and MEP design firms, on top of AutoCAD and Revit.", pills: [{ icon: "file-text", text: "Sheet register" }, { icon: "check-check", text: "Reviews" }, { icon: "send-horizontal", text: "Transmittals" }, { icon: "clock-alert", text: "Deadlines" }, { icon: "layout-grid", text: "Workload" }, { icon: "receipt-indian-rupee", text: "Fee stages" }], by: "Built by LatentIQ" }); },
      },
      {
        say: "The goal is simple. A principal should be able to see, without phone calls, which projects are at which stage, which drawings are late or about to be late, who is overloaded, and what is waiting for review. And the site should never build from a superseded drawing.",
        act: async (r) => { await r.card({ type: "statement", eyebrow: "The outcome", title: "See every project, sheet and deadline without a phone call.", items: [{ icon: "layers", text: "Which projects are at which fee stage" }, { icon: "alarm-clock-off", text: "Which sheets are late, or about to be late" }, { icon: "users", text: "Who is overloaded, and who has capacity" }, { icon: "search-check", text: "What is waiting for review, and for how long" }, { icon: "shield-check", text: "Site never works from a superseded drawing" }] }); },
      },
      {
        say: "This walkthrough uses the interactive DrawingOps prototype, populated with a fictional firm, Prasad Rao Associates, and fictional projects, people and fees. Connections to outside systems, such as Microsoft sign-in, email delivery, the Revit and AutoCAD plugins, and accounting, are simulated in this demonstration, and each simulation is labelled where it appears.",
        act: async (r) => { await r.card({ type: "statement", eyebrow: "About this walkthrough", title: "Recorded in the interactive DrawingOps prototype.", items: [{ icon: "building-complex", text: "A fictional firm, Prasad Rao Associates, with 9 projects, 27 people and about 750 sheets" }, { icon: "plug", text: "Microsoft sign-in, email delivery, Revit and AutoCAD plugins, and accounting are simulated" }, { icon: "inbox", text: "Emails the product would send are shown in a demonstration mailbox" }, { icon: "sparkles", text: "Forecasts and AI checks are advisory and labelled as such" }], note: "All people, firms, projects and amounts are fictional." }); },
      },
      {
        say: "Eight roles work in DrawingOps. The owner watches the portfolio. Project leads plan projects, fee stages and teams. Discipline leads plan sheets and do the first check. Designers move their own sheets forward. Senior reviewers carry out quality checks. Document controllers issue drawings. Accounts receives billing signals, and the administrator configures the firm. Clients, consultants and contractors receive drawings through secure links, with no account needed.",
        act: async (r) => {
          await r.card({ type: "tiles", eyebrow: "Who uses it", title: "Eight roles, plus the people you send drawings to", cols: 3, tiles: [
            { icon: "layout-dashboard", title: "Owner / Principal", who: "Nikhil Prasad", text: "Portfolio, reports, billing signals, everyone's hours, audit trail" },
            { icon: "folder-kanban", title: "Project lead", who: "Priya Sharma", text: "Projects, fee stages, team, client approvals, issue" },
            { icon: "list-checks", title: "Discipline lead", who: "Anil Kapoor", text: "Plans sheets and dates, first check, allocates hours" },
            { icon: "pen-tool", title: "Designer", who: "Rahul Kumar", text: "Own sheets through the workflow, check prints, own hours" },
            { icon: "badge-check", title: "Senior reviewer", who: "Sunita Rao", text: "Senior QC on milestone stages, redlines, AI findings" },
            { icon: "send-horizontal", title: "Document controller", who: "Deepa Chandra", text: "Issues drawings with numbered transmittals" },
            { icon: "receipt-indian-rupee", title: "Accounts", who: "Meera Thomas", text: "Ready-to-invoice signals, export, mark invoiced" },
            { icon: "settings", title: "System admin", who: "Asha Menon", text: "Users, rules, calendar, integrations, onboarding" },
            { icon: "users", title: "External parties", who: "No account needed", text: "Clients, consultants, contractors: secure links and site view" },
          ] });
        },
      },
      {
        say: "Everything revolves around the sheet. A sheet exists from the day it is planned, before any file is drawn. Every sheet moves through the same states: planned, in progress, ready for check, in check, approved for issue, and issued. Issuing a new revision supersedes the old one automatically. And fee stages move as their sheets move, all the way to ready to invoice.",
        act: async (r) => { await r.card({ type: "lifecycle", title: "One lifecycle, from planned sheet to invoice", note: "At risk and Late are flags computed from planned dates and the firm's working calendar, not states that anyone has to set." }); },
      },
      {
        say: "We will follow that lifecycle from the owner's dashboard, through planning, drafting, checking and issuing, out to the client, and on to billing, the construction stage, reporting, intelligence and administration.",
        act: async (r) => { await r.card({ type: "tiles", eyebrow: "In this walkthrough", title: "Chapters", cols: 4, tiles: [
          { icon: "key-round", title: "01 Sign-in and roles", text: "Single sign-on, two-factor, role-based navigation" },
          { icon: "layout-dashboard", title: "02–03 Portfolio and project", text: "Owner and project dashboards" },
          { icon: "layers", title: "04 Projects and fee stages", text: "New project, stage plan, team, activity" },
          { icon: "list", title: "05–07 Register and sheets", text: "Register, import, PDFs, CAD sync, sheet page" },
          { icon: "pen-tool", title: "08–09 Drafting and checking", text: "My work, pre-checks, reviews, senior QC" },
          { icon: "send-horizontal", title: "10–11 Issue and client", text: "Transmittals, secure links, site view" },
          { icon: "message-square-text", title: "12–13 Comments and billing", text: "Client comments, approvals, ready to invoice" },
          { icon: "layout-grid", title: "14–15 People and alerts", text: "Workload, timesheets, notifications, automation" },
          { icon: "hard-hat", title: "16 Construction stage", text: "RFIs, submittals, site reports, change orders, clashes" },
          { icon: "book-open", title: "17–18 Search and reports", text: "Command search, knowledge, baseline metrics" },
          { icon: "sparkles", title: "19 Intelligence", text: "Advisory forecasts and drawing checks" },
          { icon: "settings", title: "20–21 Admin and platform", text: "Settings, users, integrations, audit, trust" },
        ] }); },
      },
    ],
  },

  {
    id: "signin", num: "01", title: "Signing in and roles",
    steps: [
      {
        say: "Chapter one: signing in, and how roles shape what each person sees.",
        act: async (r) => { await r.card(chapterCard("01", "Signing in and roles", "Single sign-on for staff, two-factor for administrators, and navigation that follows each person's role.")); },
      },
      {
        say: "People sign in with the firm's Microsoft 365 or Google Workspace account, so there is no new password to remember. There is deliberately no public sign-up: accounts come from single sign-on, or from an invitation sent by the administrator.",
        act: async (r) => {
          await r.as("client", { lt: false });
          await r.go("#/sign-in", { wait: 900 });
          await r.hl("a.sso-btn");
        },
      },
      {
        say: "In this demonstration the Microsoft step is simulated with an account picker. In production, people see their firm's own Microsoft sign-in page.",
        act: async (r) => { await r.click("a.sso-btn", { wait: 700 }); await r.zoom(".auth-card", { pad: 40, max: 1.35 }); },
      },
      {
        say: "Administrators, and anyone without a firm account, use an email and password, protected by a six-digit code from an authenticator app.",
        act: async (r) => {
          await r.go("#/sign-in", { wait: 700 });
          await r.type("#si-email", "admin@firm.example", { chunk: 3 });
          await r.type("#si-pw", "Demo@2026", { chunk: 3 });
          await r.click("form[data-submit=signin] button.primary", { wait: 1200 });
          await r.zoom(".auth-card", { pad: 40, max: 1.4 });
        },
      },
      {
        say: "Local accounts can also reset a forgotten password with a code sent by email.",
        act: async (r) => { await r.eval(() => { DO.ui.state.signin = null; }); await r.go("#/forgot", { wait: 600 }); },
      },
      {
        say: "Once signed in, navigation follows the person's role. A designer, such as Rahul, sees his own work, projects, reviews, workload, timesheets, knowledge and contacts.",
        act: async (r) => { await r.as("designer"); await r.go("#/", { wait: 800 }); await r.hl("#primary-nav ul"); },
      },
      {
        say: "The owner, Nikhil, also sees the portfolio, reports, billing signals and the audit trail. Permissions combine an organisation role with a role on each project, and the same rules apply to every screen, list and action.",
        act: async (r) => { await r.as("owner"); await r.go("#/", { wait: 800 }); await r.hl("#primary-nav ul"); },
      },
    ],
  },

  {
    id: "portfolio", num: "02", title: "Owner: portfolio dashboard",
    steps: [
      {
        say: "Chapter two: the owner's portfolio.",
        act: async (r) => { await r.card(chapterCard("02", "Owner: portfolio dashboard", "Every active project on one page. Every number opens the list behind it.", [{ icon: "layout-dashboard", text: "Nikhil Prasad · Owner / Principal" }])); },
      },
      {
        say: "The portfolio is the owner's home page: every active project in the firm, with data never more than fifteen minutes old.",
        act: async (r, d) => {
          await r.go("#/portfolio", { wait: 900 });
          r.lowerThird("Nikhil Prasad", "Owner / Principal");
          const m = await r.eval(() => [...document.querySelectorAll("a.metric .metric-n")].map((x) => x.textContent.trim()));
          Object.assign(d, { pfLate: m[0], pfRisk: m[1], pfOldest: m[2], pfOver: m[3], pfReady: m[4] });
        },
      },
      {
        say: (d) => `Five numbers lead the page. ${d.pfLate} sheets are late, and ${d.pfRisk} are at risk. The oldest review has been waiting ${d.pfOldest}. ${d.pfOver} over-allocated this week, and ${d.pfReady} are ready to invoice. Each card also shows the change since last week.`,
        act: async (r) => { await r.zoom(".metrics", { pad: 20, max: 1.5 }); await r.pause(1.2); await r.hl("a.metric >> nth=0"); },
      },
      {
        say: (d) => `Every number opens the exact list behind it. Here are the ${d.pfLate} late sheets across the practice, with their project, owner, state and planned date. The count always matches the card.`,
        act: async (r) => { await r.click("a.metric >> nth=0", { wait: 900, trans: "fade" }); await r.zoom("main .card", { pad: 16, max: 1.3, anchor: "top" }); },
      },
      {
        say: "Late and at risk are flags. They are computed every morning from each sheet's planned issue date and the firm's working calendar, so nobody has to remember to set them.",
        act: async (r) => { await r.hl("main tbody tr:nth-child(1) td:nth-child(4)"); },
      },
      {
        say: "Back on the portfolio, the projects table shows each project's current fee stage, sheets issued against planned, late and at-risk counts, the project lead, and the next stage date. Columns sort, and every count opens the project's register, already filtered.",
        act: async (r) => { await r.go("#/portfolio", { wait: 800 }); await r.scrollIntoView("main table", 0.12); await r.zoom("main table", { pad: 12, max: 1.35, anchor: "top" }); },
      },
      {
        say: "The forecast column is advisory. It counts open sheets that a model expects are likely to go late. We will return to forecasting later in the walkthrough.",
        act: async (r) => { await r.hl("main table thead th:nth-child(6)"); },
      },
      {
        say: "Further down, discipline workload for the next four weeks shows which teams are over or under capacity, and a forecast lists the individual sheets most likely to slip, with the reasons behind each prediction.",
        act: async (r) => { await r.scrollBy(520); await r.zoom("main .grid.g-2", { pad: 16, max: 1.4 }); },
      },
      {
        say: "Filters narrow the page by project lead or project type, and the late and at-risk list can be exported to Excel, PDF or CSV.",
        act: async (r) => {
          await r.scrollTo(0);
          await r.select("select[data-change=pf-filter][data-k=lead]", "u_pl", { wait: 700 });
          await r.click("[data-act=export-late]", { wait: 400 });
          await r.zoom(".menu", { pad: 120, max: 1.5 });
        },
      },
      {
        say: "The bell collects the alerts that matter to this person, such as the weekly owner summary and stages that are ready to invoice.",
        act: async (r) => {
          await r.key("Escape", { shot: false });
          await r.select("select[data-change=pf-filter][data-k=lead]", "", { shot: false, wait: 500 });
          await r.frame("cut");
          await r.click("[data-act=notifications]", { wait: 600 });
          await r.zoom("#notif-panel", { pad: 10, max: 1.5, anchor: "top" });
        },
      },
    ],
  },

  {
    id: "project", num: "03", title: "Project dashboard",
    steps: [
      {
        say: "Chapter three: the project dashboard.",
        act: async (r) => { await r.card(chapterCard("03", "Project dashboard", "One project at a glance: progress against plan, stages, late sheets, team load, transmittals and client comments.")); },
      },
      {
        say: "Opening a project shows its dashboard. HSR Block B is a hospital for the Navjeevan Health Trust, now in stage four, working drawings. Tabs along the top lead to the register, stages, transmittals, team, activity, client comments, construction and decisions.",
        act: async (r) => { await r.go("#/portfolio", { wait: 700, shot: false }); await r.click('main table a[href="#/projects/p1"]', { wait: 900, trans: "fade" }); await r.hl("main nav.tabs"); },
      },
      {
        say: "The headline numbers show sheets issued against planned, late and at-risk sheets, sheets waiting for a check, transmittals that recipients have not yet acknowledged, and open client comments. Each one opens its list.",
        act: async (r) => { await r.zoom(".metrics", { pad: 16, max: 1.6 }); },
      },
      {
        say: "The burn-up chart compares sheets planned with sheets actually issued, for the whole project or for one discipline. Every chart can also be shown as a table, for accessibility and for export.",
        act: async (r) => {
          await r.zoom("main .grid.g-side .stack >> nth=0", { pad: 10, max: 1.5, anchor: "top" });
          await r.pause(1.5);
          await r.select("select[data-change=po-disc]", "M", { wait: 700 });
        },
      },
      {
        say: "Below the chart, the stage timeline shows each fee stage with its share of the fee, its dates and its state, followed by the list of late sheets.",
        act: async (r) => { await r.select("select[data-change=po-disc]", "", { shot: false, wait: 500 }); await r.scrollIntoView(".stage-tl", 0.2); await r.frame("cut"); await r.zoom(".stage-tl", { pad: 30, max: 1.6 }); },
      },
      {
        say: "On the right, the project card holds the client, fee, CAD versions and the appointment letter. Each project also has its own email address for client comments, and a site-view link for the current drawing set.",
        act: async (r) => { await r.scrollTo(0); await r.zoom("main .grid.g-side > .stack:nth-child(2) > .card:nth-child(1)", { pad: 16, max: 1.6 }); },
      },
      {
        say: "Further down are this week's team allocation, with anyone over capacity flagged, the latest transmittals with acknowledgement counts, open client comments, and an advisory forecast of the sheets most likely to go late.",
        act: async (r) => { await r.scrollBy(560); await r.zoom("main .grid.g-side > .stack:nth-child(2)", { pad: 10, max: 1.3, anchor: "top" }); },
      },
      {
        say: "The project lead or owner can export the whole project at any time: every record as structured data, plus the issued PDFs, in one zip file. The firm's data is never locked in.",
        act: async (r) => { await r.scrollTo(0); await r.click("[data-act=po-export]", { wait: 900 }); await r.zoom(".toast", { pad: 60, max: 1.6 }); },
      },
    ],
  },
];

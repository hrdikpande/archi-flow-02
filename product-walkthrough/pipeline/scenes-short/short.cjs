/* The 12-minute cut: every part of the product in brief, and portfolio, projects, register, issue
   tracking, the client's side, billing, email and the roles working together in detail.
   Same recorder and demo as the full walkthrough; selectors and flows are the proven ones from scenes/. */
const path = require("path");

const part = (num, title, depth, lead, roles) => ({ type: "chapter", num, title, eyebrow: `Part ${Number(num)} · ${depth}`, lead, roles });
const sheetId = (r, n, pid = "p1") => r.eval(([n, pid]) => DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n).id, [n, pid]);
const openReviewId = (r, n, kind) => r.eval(([n, kind]) => { const s = DO.store.S.sheets.find((x) => x.projectId === "p1" && x.number === n); return DO.store.S.reviews.find((v) => v.sheetId === s.id && v.state === "open" && (!kind || v.kind === kind))?.id; }, [n, kind]);
const bell = async (r, role, item) => {
  await r.as(role);
  await r.go("#/", { wait: 700 });
  await r.click("[data-act=notifications]", { wait: 600 });
  await r.zoom("#notif-panel", { pad: 10, max: 1.5, anchor: "top" });
  if (item) await r.hl(`#notif-panel a.notif:has-text("${item}") >> nth=0`);
};
const mail = async (r, recipient, subject) => {
  await r.go("#/mailbox", { wait: 600, shot: false });
  await r.select("select[data-change=mail-filter]", recipient, { wait: 700, shot: false });
  await r.click(`a.mail-item:has-text("${subject}") >> nth=0`, { wait: 700, trans: "fade" });
  await r.zoom(".email-frame", { pad: 20, max: 1.5 });
};
const mailReset = (r) => r.eval(() => { DO.ui.state.mailFilter = ""; });

module.exports = [
  {
    id: "intro", num: "00", title: "Introduction",
    steps: [
      {
        say: "This is DrawingOps: drawing and deliverable control for architecture and MEP design firms. It works alongside AutoCAD and Revit, and gives everyone one live record of every sheet, review, transmittal, deadline and fee stage.",
        act: async (r) => { await r.card({ type: "title", tagline: "Drawing and deliverable control for architecture and MEP design firms, on top of AutoCAD and Revit.", pills: [{ icon: "file-text", text: "Sheet register" }, { icon: "check-check", text: "Reviews" }, { icon: "send-horizontal", text: "Transmittals" }, { icon: "clock-alert", text: "Deadlines" }, { icon: "layout-grid", text: "Workload" }, { icon: "receipt-indian-rupee", text: "Fee stages" }], by: "Built by LatentIQ" }); },
      },
      {
        say: "Everything revolves around the sheet. Every sheet moves through the same states, from planned to issued, and fee stages move with their sheets, all the way to ready to invoice.",
        act: async (r) => { await r.card({ type: "lifecycle", title: "One lifecycle, from planned sheet to invoice", note: "At risk and Late are flags computed from planned dates and the firm's working calendar." }); },
      },
      {
        say: "It was recorded in the interactive prototype with fictional data. Outside connections, such as Microsoft sign-in, email delivery, the CAD plugins and accounting, are simulated, and labelled where they appear. Every part is covered briefly, and the core of daily work in detail.",
        act: async (r) => { await r.card({ type: "tiles", eyebrow: "In this video", title: "Every part in brief, the core in detail", cols: 4, tiles: [
          { icon: "key-round", title: "1 Sign-in and roles", text: "In brief" },
          { icon: "layout-dashboard", title: "2 Portfolio", text: "In detail" },
          { icon: "folder-kanban", title: "3 Projects and stages", text: "In detail" },
          { icon: "list", title: "4 Register and drawings", text: "In detail" },
          { icon: "pen-tool", title: "5 Drafting and checking", text: "In brief" },
          { icon: "send-horizontal", title: "6 Issue and tracking", text: "In detail" },
          { icon: "users", title: "7 The client's side", text: "In detail" },
          { icon: "message-square-text", title: "8 Comments and approvals", text: "In brief" },
          { icon: "receipt-indian-rupee", title: "9 Billing signals", text: "In detail" },
          { icon: "layout-grid", title: "10 Everything else", text: "Workload, site, search, reports, AI, admin" },
          { icon: "mail", title: "11 Email", text: "In detail" },
          { icon: "activity", title: "12 Roles together", text: "In detail" },
        ], note: "Recorded in the interactive prototype. All people, firms, projects and amounts are fictional; outside connections are simulated and labelled." }); },
      },
    ],
  },

  {
    id: "signin", num: "01", title: "Signing in and roles",
    steps: [
      {
        say: "Part one, in brief: signing in, and roles.",
        act: async (r) => { await r.card(part("01", "Signing in and roles", "In brief", "Single sign-on for staff, two-factor for administrators, and navigation that follows each person's role.")); },
      },
      {
        say: "Staff sign in with the firm's Microsoft or Google account, and administrators add an authenticator code. There is no public sign-up.",
        act: async (r) => { await r.as("client", { lt: false }); await r.go("#/sign-in", { wait: 900 }); await r.hl("a.sso-btn"); },
      },
      {
        say: "Eight roles share one system, from owner to accounts. Clients, consultants and contractors need no account at all.",
        act: async (r) => {
          await r.card({ type: "tiles", eyebrow: "Who uses it", title: "Eight roles, plus the people you send drawings to", cols: 3, tiles: [
            { icon: "layout-dashboard", title: "Owner / Principal", who: "Nikhil Prasad", text: "Portfolio, reports, billing signals, audit trail" },
            { icon: "folder-kanban", title: "Project lead", who: "Priya Sharma", text: "Projects, fee stages, team, client approvals" },
            { icon: "list-checks", title: "Discipline lead", who: "Anil Kapoor", text: "Plans sheets and dates, first check, hours" },
            { icon: "pen-tool", title: "Designer", who: "Rahul Kumar", text: "Own sheets through the workflow, own hours" },
            { icon: "badge-check", title: "Senior reviewer", who: "Sunita Rao", text: "Senior QC on milestone stages" },
            { icon: "send-horizontal", title: "Document controller", who: "Deepa Chandra", text: "Issues drawings with numbered transmittals" },
            { icon: "receipt-indian-rupee", title: "Accounts", who: "Meera Thomas", text: "Ready-to-invoice signals, mark invoiced" },
            { icon: "settings", title: "System admin", who: "Asha Menon", text: "Users, rules, integrations, audit" },
            { icon: "users", title: "External parties", who: "No account needed", text: "Secure links and a phone site view" },
          ] });
        },
      },
      {
        say: "Navigation follows the role. Rahul, a designer, sees his own work. Nikhil, the owner, also sees the portfolio, reports and billing.",
        act: async (r) => {
          await r.as("designer"); await r.go("#/", { wait: 800 }); await r.hl("#primary-nav ul"); await r.pause(1.2);
          await r.as("owner"); await r.go("#/", { wait: 800 }); await r.hl("#primary-nav ul");
        },
      },
    ],
  },

  {
    id: "portfolio", num: "02", title: "The owner's portfolio",
    steps: [
      {
        say: "Part two, in detail: the owner's portfolio.",
        act: async (r) => { await r.card(part("02", "The owner's portfolio", "In detail", "Every active project on one page. Every number opens the list behind it.", [{ icon: "layout-dashboard", text: "Nikhil Prasad · Owner / Principal" }])); },
      },
      {
        say: "The portfolio is the owner's home page: every active project in the firm, on one page.",
        act: async (r, d) => {
          await r.go("#/portfolio", { wait: 900 });
          r.lowerThird("Nikhil Prasad", "Owner / Principal");
          const m = await r.eval(() => [...document.querySelectorAll("a.metric .metric-n")].map((x) => x.textContent.trim()));
          Object.assign(d, { pfLate: m[0], pfRisk: m[1], pfOldest: m[2], pfOver: m[3], pfReady: m[4] });
        },
      },
      {
        say: (d) => `Five numbers lead the page. ${d.pfLate} sheets are late, and ${d.pfRisk} are at risk. The oldest review has waited ${d.pfOldest}. ${d.pfOver} over-allocated this week, and ${d.pfReady} are ready to invoice.`,
        act: async (r) => { await r.zoom(".metrics", { pad: 20, max: 1.5 }); await r.pause(1.2); await r.hl("a.metric >> nth=0"); },
      },
      {
        say: "Every number opens the exact list behind it. Late and at risk are computed each morning from planned dates and the working calendar.",
        act: async (r) => { await r.click("a.metric >> nth=0", { wait: 900, trans: "fade" }); await r.zoom("main .card", { pad: 16, max: 1.3, anchor: "top" }); },
      },
      {
        say: "The projects table shows each project's fee stage, progress, late and at-risk counts, lead and next stage date. Every count opens that project's register, already filtered.",
        act: async (r) => { await r.go("#/portfolio", { wait: 800 }); await r.scrollIntoView("main table", 0.12); await r.zoom("main table", { pad: 12, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Below, discipline workload shows which teams are over capacity, and an advisory forecast lists the sheets most likely to slip, with its reasons.",
        act: async (r) => { await r.scrollBy(520); await r.zoom("main .grid.g-2", { pad: 16, max: 1.4 }); },
      },
      {
        say: "The late list exports to Excel, PDF or CSV, and the bell collects the owner's alerts.",
        act: async (r) => {
          await r.scrollTo(0);
          await r.click("[data-act=export-late]", { wait: 400 });
          await r.zoom(".menu", { pad: 120, max: 1.5 });
          await r.pause(1.2);
          await r.key("Escape", { shot: false }); r.zoomOut();
          await r.click("[data-act=notifications]", { wait: 600 });
          await r.zoom("#notif-panel", { pad: 10, max: 1.5, anchor: "top" });
        },
      },
    ],
  },

  {
    id: "projects", num: "03", title: "Projects, fee stages and teams",
    steps: [
      {
        say: "Part three, in detail: projects, fee stages and teams.",
        act: async (r) => { await r.card(part("03", "Projects, fee stages and teams", "In detail", "A dashboard per project, fee stages from the appointment letter, and the team that does the work.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "Opening a project shows its dashboard. HSR Block B, a hospital, is in stage four, working drawings. The headline numbers show progress against plan, late sheets, sheets waiting for check, unacknowledged transmittals and open client comments.",
        act: async (r) => { await r.go("#/portfolio", { wait: 700, shot: false }); await r.click('main table a[href="#/projects/p1"]', { wait: 900, trans: "fade" }); await r.zoom(".metrics", { pad: 16, max: 1.6 }); },
      },
      {
        say: "The burn-up chart compares planned and issued sheets, and the stage timeline shows each fee stage with its share of the fee, dates and state.",
        act: async (r) => {
          await r.zoom("main .grid.g-side .stack >> nth=0", { pad: 10, max: 1.5, anchor: "top" });
          await r.pause(1.2);
          await r.scrollIntoView(".stage-tl", 0.2); await r.frame("cut"); await r.zoom(".stage-tl", { pad: 30, max: 1.6 });
        },
      },
      {
        say: "Priya, the project lead, creates projects from a fee-stage template. The stage plan mirrors the appointment letter: each stage's share and amount, dates, required issue purposes, and senior QC. Stages move by themselves as their sheets move.",
        act: async (r) => { await r.as("lead"); await r.go("#/projects/p1/stages", { wait: 900 }); await r.zoom("main .card", { pad: 10, max: 1.3, anchor: "top" }); },
      },
      {
        say: "The team tab controls who can access the project, with each person's role and load, and the activity feed records every change.",
        act: async (r) => { await r.go("#/projects/p1/team", { wait: 800 }); await r.pause(1.5); await r.go("#/projects/p1/activity", { wait: 800 }); },
      },
    ],
  },

  {
    id: "register", num: "04", title: "The register and drawing management",
    steps: [
      {
        say: "Part four, in detail: the drawing register.",
        act: async (r) => { await r.card(part("04", "The register and drawing management", "In detail", "Every sheet from the day it is planned: search, filter, edit in place, act in bulk, import, upload PDFs, CAD sync, and one page per sheet.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "The register is the heart of DrawingOps: every sheet the firm owes, with its owner, checker, state, planned date, revision and flags. All one hundred and thirty-two sheets render instantly.",
        act: async (r) => { await r.go("#/projects/p1/register", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "Search covers numbers, titles and owners: OT duct finds the operating-theatre ductwork. Filters combine, and here are the late HVAC sheets.",
        act: async (r) => {
          r.zoomOut(); await r.type("#reg-q", "OT duct", { chunk: 1, after: 500 }); await r.frame("cut");
          await r.pause(1);
          await r.go("#/projects/p1/register", { wait: 700, shot: false });
          await r.select("select[data-change=reg-f][data-k=disc]", "M", { wait: 700 });
          await r.check('label.fchip input[data-k=late]', { wait: 700 });
        },
      },
      {
        say: "Owners, checkers and dates edit in place, audited and undoable. Selecting sheets brings up the bulk bar: assign, shift dates on the working calendar, change state, issue or export.",
        act: async (r) => {
          await r.go("#/projects/p1/register?state=planned", { wait: 800 });
          const sel = "select.cell[data-k=ownerId] >> nth=1";
          const vals = await r.page.locator(sel).evaluate((el) => ({ cur: el.value, opts: [...el.options].map((o) => o.value) }));
          await r.select(sel, vals.opts.find((v) => v !== vals.cur), { wait: 600 });
          await r.zoom(".toast", { pad: 80, max: 1.5 });
          await r.pause(1);
          r.zoomOut();
          const undo = r.page.locator(".toast [data-undo]").first();
          if (await undo.count()) { await undo.click(); await r.wait(400); }
          await r.clearToasts();
          for (let i = 0; i < 4; i++) await r.click(`input[data-act=reg-sel] >> nth=${i}`, { wait: 200, shot: i === 3 });
          await r.zoom(".bulkbar", { pad: 40, max: 1.5 });
        },
      },
      {
        say: "Most firms start from Excel. The import wizard checks every row before anything is created, and explains each problem in plain words.",
        act: async (r) => {
          r.zoomOut(); await r.click("[data-act=bulk-clear]", { wait: 300, shot: false });
          await r.go("#/projects/p1/import", { wait: 800, shot: false });
          await r.click("[data-act=imp-sample]", { wait: 1200, trans: "fade" });
          await r.click("[data-act=imp-preview]", { wait: 900 });
          await r.scrollIntoView("[data-act=imp-commit]", 0.75); await r.frame("cut");
          await r.zoom("main .card >> nth=-1", { pad: 8, max: 1.35, anchor: "top" });
        },
      },
      {
        say: "PDFs are matched to their sheets by file name, or by reading a scan's title block, and become draft revisions. A file that breaks the naming rule cannot be issued until it is renamed.",
        act: async (r, d) => {
          r.zoomOut();
          await r.go("#/projects/p1/upload", { wait: 800 });
          const dir = path.join(d.DOCS, "sample-pdfs");
          await r.files("#up-in", [path.join(dir, "M-206_C01.pdf"), path.join(dir, "scan_0042.pdf"), path.join(dir, "A104 ground floor rev.pdf")], { wait: 1500, pointAt: "main .dropzone, main [data-act=up-drop], main .card" });
          await r.zoom("main .card >> nth=-1", { pad: 8, max: 1.4, anchor: "top" });
          await r.pause(1.2);
          r.zoomOut(); await r.click("[data-act=up-go]", { wait: 1500, trans: "fade" });
        },
      },
      {
        say: "Sheet lists can also sync from Revit and AutoCAD, simulated here, as proposals that a lead accepts.",
        act: async (r) => { await r.go("#/projects/p1/cad-sync", { wait: 900 }); await r.zoom('main section.card:has-text("Proposed")', { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: (d) => `Each sheet has its own page. M-205 is ${d.m205.state} and ${d.m205.flag}. The current drawing opens in the built-in viewer, beside every review and a record of who holds which revision.`,
        act: async (r, d) => {
          r.zoomOut();
          const id = await sheetId(r, "M-205");
          await r.go(`#/projects/p1/sheets/${id}`, { wait: 2200 });
          d.m205 = await r.eval((id) => { const s = DO.store.sheet(id); const f = DO.store.flagsFor(s)[0]; return { state: DO.store.label(s.state).toLowerCase(), flag: f ? (f.kind === "late" ? `late by ${f.n} working day${f.n === 1 ? "" : "s"}` : f.text.toLowerCase()) : "on track" }; }, id);
          await r.zoom(["main h2.display", "[data-act=sd-more]"], { pad: 16, max: 1.6 });
          await r.pause(1.2); r.zoomOut();
          await r.zoom("main iframe", { pad: 40, max: 1.45 });
        },
      },
      {
        say: "An older revision shows a superseded banner, and every download of it is stamped SUPERSEDED.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=sd-rev] >> nth=-1", { wait: 2200 }); await r.zoom("main iframe", { pad: 60, max: 1.35 }); },
      },
    ],
  },

  {
    id: "flow", num: "05", title: "Drafting and checking",
    steps: [
      {
        say: "Part five, in brief: drafting and checking.",
        act: async (r) => { await r.card(part("05", "Drafting and checking", "In brief", "My work with the next action on every sheet, a checklist before each submission, a review queue, and senior QC.", [{ icon: "pen-tool", text: "Rahul Kumar · Designer" }, { icon: "list-checks", text: "Anil Kapoor · Discipline lead" }, { icon: "badge-check", text: "Sunita Rao · Senior reviewer" }])); },
      },
      {
        say: "Rahul's My work lists his sheets by due date, with the next action on each. Starting one is a single click.",
        act: async (r) => { await r.as("designer"); await r.go("#/", { wait: 800 }); await r.click("button[data-act=quick-transition][data-a=start] >> nth=0", { wait: 900 }); },
      },
      {
        say: "Submitting M-206 for check needs the discipline's pre-check list ticked. Karthik, the HVAC checker, is notified at once.",
        act: async (r) => {
          await r.clearToasts();
          const id = await sheetId(r, "M-206");
          await r.go(`#/projects/p1/sheets/${id}`, { wait: 2000, shot: false });
          await r.click("#sd-submit", { wait: 600, trans: "fade" });
          await r.zoom(".dialog", { pad: 30, max: 1.6 });
          const n = await r.page.locator("form[data-submit=pc-go] input[type=checkbox]").count();
          for (let i = 0; i < n; i++) await r.check(`form[data-submit=pc-go] input[type=checkbox] >> nth=${i}`, { wait: 150, shot: i === n - 1 });
          await r.click(".dialog-foot .btn.primary", { wait: 900 });
          r.zoomOut();
        },
      },
      {
        say: "Anil checks his queue oldest first, and every return carries a comment or redline. Approving A-107 sends it on to senior QC, which stage four requires.",
        act: async (r) => {
          await r.clearToasts();
          await r.as("checker"); await r.go("#/reviews", { wait: 800 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" });
          await r.pause(1.2);
          const id = await openReviewId(r, "A-107");
          await r.go(`#/reviews?open=${id}`, { wait: 2200 });
          await r.scrollIntoView("#rq-approve-btn", 0.6); await r.frame("cut");
          await r.click("#rq-approve-btn", { wait: 900 });
        },
      },
      {
        say: "Sunita, the senior reviewer, approves it, and A-107 is approved for issue.",
        act: async (r) => {
          await r.clearToasts();
          await r.as("senior");
          const id = await openReviewId(r, "A-107", "senior_qc");
          await r.go(`#/reviews?open=${id}`, { wait: 2200 });
          await r.scrollIntoView("#rq-approve-btn", 0.6); await r.frame("cut");
          await r.click("#rq-approve-btn", { wait: 900 });
        },
      },
    ],
  },

  {
    id: "issue", num: "06", title: "Issue and issue tracking",
    steps: [
      {
        say: "Part six, in detail: issue, and issue tracking.",
        act: async (r) => { await r.clearToasts(); await r.card(part("06", "Issue and issue tracking", "In detail", "Numbered transmittals with a cover sheet and secure links, automatic superseding, and per-recipient tracking.", [{ icon: "send-horizontal", text: "Deepa Chandra · Document controller" }])); },
      },
      {
        say: "Deepa, the document controller, sees the approved sheets ready to issue.",
        act: async (r) => { await r.as("dc"); await r.go("#/", { wait: 800 }); await r.zoom('main section.card:has-text("Approved and ready to issue")', { pad: 14, max: 1.6 }); },
      },
      {
        say: "The issue composer reserves the next transmittal number. A-104 is blocked by the naming rule, and E-102 has no PDF yet.",
        act: async (r) => {
          r.zoomOut(); await r.click('main a.btn[href="#/projects/p1/issue"]', { wait: 1000, trans: "fade" });
          await r.zoom("main .card >> nth=0", { pad: 6, max: 1.35, anchor: "top" }); await r.pause(1); await r.hl("main tr:has-text('A-104')");
        },
      },
      {
        say: "One click renames A-104's file, and all approved sheets are selected. Every issue needs a purpose, here good for construction, and recipients get a secure link by email.",
        act: async (r) => {
          r.hlOff(); r.zoomOut();
          await r.click("[data-act=sd-rename]", { wait: 500 });
          await r.click("[data-act=ic-all]", { wait: 600 });
          await r.scrollIntoView("select[data-change=ic-purpose]", 0.3);
          await r.select("select[data-change=ic-purpose]", "GFC", { wait: 500 });
          await r.zoom('main section.card:has-text("Purpose and recipients")', { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "The cover sheet previews exactly as recipients will receive it.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=ic-preview]", { wait: 2200 }); await r.zoom('iframe[title="Cover sheet preview"]', { pad: 20, max: 1.6 }); },
      },
      {
        say: "One confirmation issues the set on a single transmittal. In the same step, earlier revisions are superseded, recipients are emailed, and anyone holding an older revision is told.",
        act: async (r, d) => {
          r.zoomOut(); await r.click("[data-act=ic-issue]", { wait: 600 }); await r.zoom(".dialog", { pad: 40, max: 1.6 });
          await r.pause(1);
          r.zoomOut(); await r.click("#cf-ok", { wait: 1200, trans: "fade" });
          d.tr = await r.eval(() => { const t = DO.store.S.transmittals[DO.store.S.transmittals.length - 1]; return { id: t.id, number: t.number, n: t.items.length }; });
          await r.zoom("main .card >> nth=-1", { pad: 20, max: 1.6 });
        },
      },
      {
        say: "The transmittal log tracks every issue, its recipients and acknowledgements, including bounced emails. The matrix shows which revision each recipient holds.",
        act: async (r) => {
          await r.clearToasts(); await r.go("#/projects/p1/transmittals", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" });
          await r.pause(1.2); r.zoomOut();
          await r.click("[data-act=tm-view][data-v=matrix]", { wait: 900 });
        },
      },
      {
        say: "Each transmittal records delivery, download and acknowledgement times per recipient. Unacknowledged transmittals are flagged, and a sent transmittal is never edited: a correction is a new one.",
        act: async (r, d) => { await r.go(`#/projects/p1/transmittals/${d.tr.id}`, { wait: 900 }); await r.zoom('main section.card:has-text("Recipients")', { pad: 10, max: 1.5, anchor: "top" }); },
      },
    ],
  },

  {
    id: "client", num: "07", title: "The client's side",
    steps: [
      {
        say: "Part seven, in detail: the client's side. No account, and nothing to install.",
        act: async (r) => { await r.card(part("07", "The client's side", "In detail", "A secure link, every drawing and its revision, download all as a zip, acknowledge receipt, and a phone view for site.", [{ icon: "users", text: "Clients, consultants, contractors · no sign-in" }])); },
      },
      {
        say: "The client receives an ordinary email with a secure link, shown here in the demonstration mailbox.",
        act: async (r, d) => {
          await r.as("client", { lt: false });
          await mailReset(r);
          await r.go("#/mailbox", { wait: 900 });
          r.lowerThird("Dr. Vikram Nair", "Client · Navjeevan Health Trust");
          await r.click(`a.mail-item:has-text("${d.tr.number}"):has-text("Vikram") >> nth=0`, { wait: 700 }).catch(async () => { await r.click(`a.mail-item:has-text("${d.tr.number}") >> nth=0`, { wait: 700 }); });
          await r.zoom(".email-frame", { pad: 20, max: 1.5 });
        },
      },
      {
        say: "The link opens the transmittal, with every drawing and its revision. Drawings download one at a time, or as a zip with the cover sheet.",
        act: async (r) => { r.zoomOut(); await r.click(".email-frame a.btn.primary", { wait: 1000, trans: "fade" }); await r.pause(1); await r.click("[data-act=ext-zip]", { wait: 900 }); },
      },
      {
        say: "Acknowledging receipt records the date and time.",
        act: async (r) => { await r.clearToasts(); await r.click("[data-act=ext-ack]", { wait: 900 }); await r.zoom("main .card >> nth=0", { pad: 20, max: 1.5 }); },
      },
      {
        say: "On site, a phone view shows only the current issued set, so nobody builds from a superseded sheet.",
        act: async (r) => {
          r.zoomOut(); await r.clearToasts();
          const token = await r.eval(() => DO.store.project("p1").siteToken);
          await r.page.setViewportSize({ width: 390, height: 844 });
          await r.page.evaluate((t) => { location.hash = `#/site/${t}`; }, token);
          await r.wait(1200);
          await r.prep();
          const buf = await r.page.screenshot({ type: "png" });
          await r.page.setViewportSize({ width: 1440, height: 810 });
          await r.page.evaluate(() => { location.hash = "#/mailbox"; }); await r.wait(500);
          await r.card({ type: "device", eyebrow: "Site view · phone", title: "The current set, in the pocket of everyone on site", img: `data:image/png;base64,${buf.toString("base64")}`, items: [{ icon: "shield-check", text: "Only current issued revisions, never superseded ones" }, { icon: "search", text: "Search by sheet number or title" }, { icon: "smartphone", text: "Phone first, no sign-in" }] });
        },
      },
      {
        say: "Back in DrawingOps, Deepa already sees the acknowledgement.",
        act: async (r, d) => { await r.as("dc"); await r.go(`#/projects/p1/transmittals/${d.tr.id}`, { wait: 900 }); await r.zoom('main section.card:has-text("Recipients")', { pad: 10, max: 1.5, anchor: "top" }); },
      },
    ],
  },

  {
    id: "comments", num: "08", title: "Client comments and approvals",
    steps: [
      {
        say: "Part eight, in brief: client comments and stage approvals.",
        act: async (r) => { await r.card(part("08", "Client comments and approvals", "In brief", "Every comment logged, assigned and answered; decisions kept with their reasons; stage approvals recorded with evidence.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "Client comments from any channel are logged, linked to sheets and assigned. Each closes only with a written response, and overdue ones are flagged.",
        act: async (r) => { await r.as("lead"); await r.go("#/projects/p1/comments", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "When every deliverable of a stage is issued, Priya records the client's approval, with the letter as evidence, and the Mysuru stage becomes ready to invoice.",
        act: async (r, d) => {
          r.zoomOut(); await r.go("#/projects/p5/stages", { wait: 900 });
          await r.click("[data-act=sp-approve]", { wait: 600 });
          await r.files("#ap-e", path.join(d.DOCS, "sample-client-approval-letter.pdf"), { wait: 500, pointAt: "#ap-e" });
          await r.zoom(".dialog", { pad: 24, max: 1.5 });
          await r.pause(1);
          r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 900 }); await r.zoom(".toast", { pad: 80, max: 1.5 });
        },
      },
    ],
  },

  {
    id: "billing", num: "09", title: "Billing signals",
    steps: [
      {
        say: "Part nine, in detail: billing signals.",
        act: async (r) => { await r.card(part("09", "Billing signals", "In detail", "Stages ready to invoice, with the amount and the evidence; export or push to accounting; record the invoice reference.", [{ icon: "settings", text: "Asha Menon · System admin" }, { icon: "receipt-indian-rupee", text: "Meera Thomas · Accounts" }])); },
      },
      {
        say: "The administrator connects the accounting system once, with a webhook address that is checked for safety. It is simulated here.",
        act: async (r) => {
          await r.as("admin"); await r.go("#/admin/integrations", { wait: 800, shot: false });
          await r.scrollIntoView("input[data-change=ig-wh-on]", 0.5); await r.frame("fade");
          await r.check("input[data-change=ig-wh-on]", { wait: 500 });
          await r.zoom("input[data-change=ig-wh-on] >> xpath=ancestor::section[1]", { pad: 10, max: 1.5 });
        },
      },
      {
        say: "Meera, in Accounts, sees what is ready to invoice on her home page. Each signal shows the stage, its share of the fee, the amount, the wait, and the client approval, including the Mysuru stage approved a moment ago.",
        act: async (r) => {
          await r.as("accounts"); await r.go("#/", { wait: 800 }); await r.zoom('main section.card:has-text("Ready to invoice")', { pad: 14, max: 1.5 });
          await r.pause(1.2);
          await r.go("#/billing", { wait: 900 }); await r.zoom("main table", { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "Signals export as CSV, or push to the accounting system as a signed message, shown here instead of sent.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=bl-csv]", { wait: 700 }); await r.clearToasts(); await r.click("[data-act=bl-push]", { wait: 900 }); await r.zoom(".dialog", { pad: 20, max: 1.5 }); },
      },
      {
        say: "When the invoice is raised, Meera records its reference, and the stage's fee percentage locks.",
        act: async (r) => { r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 500, shot: false }); await r.clearToasts(); await r.frame("cut"); await r.click("[data-act=bl-mark] >> nth=0", { wait: 600 }); await r.zoom(".dialog", { pad: 24, max: 1.6 }); await r.pause(1.2); r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 900 }); },
      },
      {
        say: "Invoicing and tax stay in the accounting software, and Accounts never sees drawings or individual hours.",
        act: async (r) => { await r.clearToasts(); await r.go("#/billing/invoiced", { wait: 800 }); await r.pause(1.2); await r.go("#/projects/p1", { wait: 900 }); await r.hl("main nav.tabs"); },
      },
    ],
  },

  {
    id: "rest", num: "10", title: "Everything else, in brief",
    steps: [
      {
        say: "Part ten, in brief: everything else.",
        act: async (r) => { await r.card(part("10", "Everything else", "In brief", "Workload and timesheets, the construction stage, search, reports, advisory intelligence, automation and administration.")); },
      },
      {
        say: "Workload shows planned hours against capacity, eight weeks ahead, and weekly timesheets build on it.",
        act: async (r) => { await r.as("lead"); await r.go("#/workload", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "On site, RFIs, submittals, site reports, change orders and clashes link to the sheets they affect.",
        act: async (r) => { r.zoomOut(); await r.go("#/projects/p4/construction/rfis", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Control K finds anything, and knowledge search finds the reasoning behind past decisions.",
        act: async (r) => {
          r.zoomOut(); await r.go("#/projects", { wait: 700, shot: false });
          await r.page.keyboard.press("Control+k"); await r.wait(500); await r.frame("fade");
          await r.type("#pal-q", "A-101", { chunk: 1, after: 400 });
          await r.zoom(".dialog", { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "Reports track the four baseline measures the firm agreed to improve.",
        act: async (r) => { await r.key("Escape", { shot: false }); r.zoomOut(); await r.as("owner"); await r.go("#/reports?tab=baseline", { wait: 900 }); await r.zoom(".metrics", { pad: 16, max: 1.6 }); },
      },
      {
        say: "Ten automation rules run themselves, and running a sweep twice never sends anything twice.",
        act: async (r) => { r.zoomOut(); await r.as("admin"); await r.go("#/admin/automation", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "Forecasts and AI drawing checks are advisory, labelled, and gated on the firm's own history. The figures here are simulated.",
        act: async (r) => { r.zoomOut(); await r.go("#/admin/intelligence", { wait: 900 }); await r.zoom("main .card >> nth=0", { pad: 10, max: 1.5 }); },
      },
      {
        say: "And administrators manage users, rules and integrations, with every change in an insert-only audit trail.",
        act: async (r) => { r.zoomOut(); await r.go("#/admin/audit", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
    ],
  },

  {
    id: "email", num: "11", title: "Email: how everything stays tracked",
    steps: [
      {
        say: "Part eleven, in detail: email. DrawingOps works through the inbox people already use. It sends every alert and transmittal, logs client emails that come in, and tracks each one.",
        act: async (r) => { r.zoomOut(); await r.card({ type: "statement", eyebrow: "Part 11 · In detail", title: "Email ties it all together", items: [
          { icon: "send-horizontal", text: "Out: transmittal links, new-revision notices, alerts, daily digests, the weekly owner summary, invitations" },
          { icon: "inbox", text: "In: each project has its own address; forwarded client emails become logged comments" },
          { icon: "mail-check", text: "Tracked: delivery, bounces, downloads and acknowledgements for every recipient" },
          { icon: "bell", text: "Every alert also lands in the app, with a link straight to the sheet, review or stage" },
        ], note: "In production, email goes through the firm's own mail server. In this prototype nothing is sent: every message is collected in a demonstration mailbox." }); },
      },
      {
        say: "The demonstration mailbox collects every email the product sends: transmittals, notifications, revision notices, digests and summaries. In production they go through the firm's own mail server; here, nothing is actually sent.",
        act: async (r) => { await mailReset(r); await r.go("#/mailbox", { wait: 900 }); await r.zoom("main .mail-layout > div >> nth=0", { pad: 6, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Filtering by recipient shows what each person received. When Rahul submitted M-206, Karthik, the HVAC checker, was emailed at once, with a button that opens the sheet in DrawingOps.",
        act: async (r) => { r.zoomOut(); await mail(r, "karthik.iyer@firm.example", "M-206"); },
      },
      {
        say: "Meera's ready-to-invoice alert arrived the same way. Must-not-miss alerts like this one are always sent instantly.",
        act: async (r) => { r.zoomOut(); await mail(r, "accounts@firm.example", "Ready to invoice"); },
      },
      {
        say: "Transmittal emails are tracked per recipient. One email on the previous HSR transmittal bounced. It shows here, and Deepa resends it with one click.",
        act: async (r) => {
          r.zoomOut(); await mailReset(r);
          await r.as("dc");
          const id = await r.eval(() => DO.store.S.transmittals.filter((t) => t.projectId === "p1").find((t) => t.number.endsWith("0032"))?.id);
          await r.go(`#/projects/p1/transmittals/${id}`, { wait: 900 });
          await r.zoom('main section.card:has-text("Recipients")', { pad: 10, max: 1.5, anchor: "top" });
          await r.hl('main section.card:has-text("Recipients") tr:has(.pill.bad)');
          await r.pause(1.2);
          r.hlOff();
          await r.click('main section.card:has-text("Recipients") tr:has(.pill.bad) [data-act=td-resend]', { wait: 900 });
        },
      },
      {
        say: "Email comes in, too. A client email forwarded to the project's own address is logged as a comment, matched to the sender; that is simulated here. Unknown senders wait in a queue until accepted.",
        act: async (r) => {
          r.zoomOut(); await r.clearToasts();
          await r.as("lead"); await r.go("#/projects/p1/comments", { wait: 800 });
          await r.hl('main span.mono:has-text("@") >> nth=0');
          await r.pause(1);
          r.hlOff();
          await r.click("[data-act=cm-sim]", { wait: 1000 });
          await r.clearToasts();
          await r.click("[data-act=cm-queue]", { wait: 600 }); await r.zoom(".dialog, .drawer", { pad: 20, max: 1.5 });
          await r.pause(1);
          await r.click("[data-act=iq-accept] >> nth=0", { wait: 800 }); r.zoomOut();
        },
      },
      {
        say: "Each person chooses instant alerts, a morning digest, or none, with critical alerts locked on. Rahul's digest gathers the rest into one email.",
        act: async (r) => {
          await r.key("Escape", { shot: false }); r.zoomOut();
          await r.as("designer"); await r.go("#/settings/notifications", { wait: 800 }); await r.zoom("main .card >> nth=0", { pad: 8, max: 1.35, anchor: "top" });
          await r.pause(1.2); r.zoomOut();
          await r.click("[data-act=pf-digest]", { wait: 900, shot: false });
          const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "digest")?.id);
          await r.go(`#/mailbox?m=${mid}`, { wait: 800 }); await r.zoom(".email-frame", { pad: 20, max: 1.5 });
        },
      },
      {
        say: "And every Monday, the owner gets a weekly summary by email.",
        act: async (r) => { r.zoomOut(); const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "summary")?.id); await r.go(`#/mailbox?m=${mid}`, { wait: 800 }); await r.zoom(".email-frame", { pad: 20, max: 1.5 }); },
      },
    ],
  },

  {
    id: "together", num: "12", title: "How the roles work together",
    steps: [
      {
        say: "Part twelve: how the roles work together. Each role owns one part of a sheet's journey, and every hand-off tells the next person, in the app and by email. Nobody chases anybody.",
        act: async (r) => { r.zoomOut(); await r.card({ type: "tiles", eyebrow: "Part 12 · In detail", title: "How the roles work together", cols: 3, tiles: [
          { icon: "folder-kanban", title: "1 Project lead plans", who: "Priya", text: "Fee stages, team, issue purposes, senior QC" },
          { icon: "list-checks", title: "2 Discipline lead assigns and checks", who: "Anil · Karthik", text: "Sheets and dates; first check, returns with redlines" },
          { icon: "pen-tool", title: "3 Designer drafts and submits", who: "Rahul", text: "Starts, uploads, submits with the pre-check list" },
          { icon: "badge-check", title: "4 Senior reviewer approves", who: "Sunita", text: "Second check on milestone stages" },
          { icon: "send-horizontal", title: "5 Document controller issues", who: "Deepa", text: "Numbered transmittal; older revisions superseded" },
          { icon: "users", title: "6 Client acknowledges", who: "No account", text: "Downloads and acknowledges; site uses the current set" },
          { icon: "file-check", title: "7 Project lead records approval", who: "Priya", text: "Client approval with evidence; stage ready to invoice" },
          { icon: "receipt-indian-rupee", title: "8 Accounts invoices", who: "Meera", text: "Exports or pushes the signal; records the invoice" },
          { icon: "layout-dashboard", title: "9 Owner sees it all", who: "Nikhil", text: "Portfolio, reports and activity, without a phone call" },
        ] }); },
      },
      {
        say: "In this recording, that chain ran end to end. Sunita's bell shows the senior QC request for A-107, sent the moment Anil approved it.",
        act: async (r) => { await bell(r, "senior", "Senior QC needed: A-107"); },
      },
      {
        say: (d) => `Deepa was told A-107 was ready to issue, and that the client had acknowledged ${d.tr.number}.`,
        act: async (r) => { r.hlOff(); await bell(r, "dc", "A-107 is ready to issue"); },
      },
      {
        say: "Priya, the project lead, gets a copy of every transmittal and acknowledgement on her projects.",
        act: async (r, d) => { r.hlOff(); await bell(r, "lead", `${d.tr.number} sent`); },
      },
      {
        say: "Meera was told the moment the Mysuru stage was ready to invoice.",
        act: async (r) => { r.hlOff(); await bell(r, "accounts", "Ready to invoice"); },
      },
      {
        say: "And Nikhil sees the whole chain in the project's activity feed. Each person sees only what their role allows, so hand-offs are quick and safe.",
        act: async (r) => { r.hlOff(); await r.as("owner"); await r.go("#/projects/p1/activity", { wait: 900 }); await r.zoom("main .card >> nth=-1", { pad: 10, max: 1.3, anchor: "top" }); },
      },
    ],
  },

  {
    id: "close", num: "13", title: "Close",
    steps: [
      {
        say: "Underneath, permissions are enforced on the server, issued files never change, the audit trail is insert-only, and every project exports in full.",
        act: async (r) => { r.zoomOut(); await r.card({ type: "statement", eyebrow: "Designed for trust", title: "A record the whole firm can rely on", items: [
          { icon: "shield-check", text: "Permissions enforced on the server, by organisation role and project role" },
          { icon: "lock", text: "Issued PDFs are immutable; corrections are new revisions and new transmittals" },
          { icon: "list-checks", text: "Insert-only audit trail with before and after values" },
          { icon: "refresh-cw", text: "Automations are safe to run twice: nothing is ever sent twice" },
          { icon: "download", text: "Full project export at any time: structured data plus every issued PDF" },
        ], note: "These describe the product's design. This walkthrough was recorded in the browser prototype, where these rules are simulated in the browser." }); },
      },
      {
        say: "DrawingOps gives the whole firm one live record of every sheet, from planned to invoiced. It is built by LatentIQ. To see it with your own projects, talk to the LatentIQ team. Thank you for watching.",
        act: async (r) => { await r.card({ type: "title", eyebrow: "Thank you", tagline: "One live record of every sheet, from the day it is planned to the day it is invoiced. To see it with your own projects, talk to the LatentIQ team.", pills: [{ icon: "building-complex", text: "Architecture and MEP firms" }, { icon: "layers", text: "On top of AutoCAD and Revit" }, { icon: "shield-check", text: "Your data, always exportable" }], by: "Built by LatentIQ" }); },
      },
    ],
  },
];

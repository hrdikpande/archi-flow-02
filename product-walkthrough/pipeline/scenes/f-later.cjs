/* Chapters 16 to 19: construction stage, search and knowledge, reports, intelligence. */
const path = require("path");
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });

module.exports = [
  {
    id: "construction", num: "16", title: "The construction stage",
    steps: [
      {
        say: "Chapter sixteen: the construction stage.",
        act: async (r) => { await r.card(chapterCard("16", "The construction stage", "RFIs, submittals, site visit reports, change orders and clash results, linked to the sheets they affect.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "Once a project is on site, the construction tab brings the site's paperwork into the same system. Koramangala Tech Park is in stage six, construction. RFIs are logged with the question, who raised it, whose court the ball is in, the due date, the linked sheets and any cost or time impact. RFIs due within two working days are flagged.",
        act: async (r) => { await r.as("lead"); await r.go("#/projects/p4/construction/rfis", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Answering an RFI can start the next revision of every linked sheet in the same step, so a drawing change is never forgotten.",
        act: async (r) => {
          r.zoomOut();
          await r.click("tr[data-act=rfi-open] >> nth=0", { wait: 700 });
          await r.type("#rf-r", "Upturn 450 mm at the parapet; detail revised on A-004.", { chunk: 6 });
          const rev = r.page.locator("input[name=rev]").first();
          if (await rev.count()) await r.check(rev, { wait: 300 });
          await r.zoom(".drawer, .dialog", { pad: 10, max: 1.4, anchor: "top" });
          r.zoomOut();
          await r.click("[data-act=rf-op][data-op=answer]", { wait: 900 });
        },
      },
      {
        say: "Submittals from contractors, such as shop drawings, samples and product data, are reviewed by the right person and stamped: approved, approved as noted, revise and resubmit, or rejected. The stamped PDF is ready to send back.",
        act: async (r) => {
          await r.clearToasts(); await r.go("#/projects/p4/construction/submittals", { wait: 800 });
          await r.click("[data-act=sb-review] >> nth=0", { wait: 600 });
          await r.check("form[data-submit=sb-stamp] input[type=radio] >> nth=1", { wait: 300 });
          await r.type("#sr-n", "Provide a 600 mm access door on the filter section.", { chunk: 6 });
          await r.zoom(".dialog", { pad: 20, max: 1.5 });
          r.zoomOut();
          await r.click(".dialog-foot .btn.primary", { wait: 900 });
        },
      },
      {
        say: "Site visit reports are filed from a phone: who attended, the weather, observations linked to sheets, and photos. Photos are compressed and their location data is removed, and every report exports as a PDF.",
        act: async (r, d) => {
          await r.clearToasts(); await r.go("#/projects/p4/construction/site", { wait: 800 });
          await r.click("[data-act=sv-new]", { wait: 700 });
          await r.type("#sv-s", "Level 8 slab reinforcement inspected; cover blocks missing at grid D/4.", { chunk: 6 });
          await r.files("#sv-ph", path.join(d.ROOT, "demo/assets/images/site/site-photo-2.jpg"), { wait: 1500, pointAt: "#sv-ph" });
          await r.zoom(".drawer", { pad: 0, max: 1.3, anchor: "top" });
          r.zoomOut();
          await r.click(".drawer-foot .btn.primary", { wait: 1200 });
        },
      },
      {
        say: "Change orders record cost and time, where they came from, often an RFI, and the sheets they affect. The project lead approves or rejects them, and the approved total is always up to date.",
        act: async (r) => { await r.clearToasts(); await r.go("#/projects/p4/construction/changes", { wait: 800 }); await r.click("[data-act=co-approve] >> nth=0", { wait: 900 }); await r.zoom("main table", { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Clash results from Navisworks, or any tool that exports BCF, are imported as issues with their viewpoints, disciplines, sheets, assignee and status. Importing again updates the existing issues by their unique ID, instead of duplicating them.",
        act: async (r, d) => {
          r.zoomOut(); await r.clearToasts(); await r.go("#/projects/p4/construction/clashes", { wait: 800 });
          await r.files("input[data-change=cx-import]", path.join(d.DOCS, "sample-clashes.bcfzip"), { wait: 1200, pointAt: "text=Import BCF" });
          await r.zoom(".toast", { pad: 80, max: 1.5 }).catch(() => {});
        },
      },
    ],
  },

  {
    id: "search", num: "17", title: "Search and knowledge",
    steps: [
      {
        say: "Chapter seventeen: finding anything, fast.",
        act: async (r) => { await r.card(chapterCard("17", "Search and knowledge", "A command search from anywhere, and a knowledge search across decisions, comments, RFIs and reviews.")); },
      },
      {
        say: "Command search opens from anywhere with Control K. Typing a sheet number finds it on every project the person can see, and the same box finds projects, transmittals and contacts, and jumps to any page.",
        act: async (r) => {
          r.zoomOut(); await r.clearToasts(); await r.go("#/projects", { wait: 700 });
          await r.page.keyboard.press("Control+k"); await r.wait(500); await r.frame("cut");
          await r.type("#pal-q", "A-101", { chunk: 1, after: 400 });
          await r.zoom(".dialog", { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "Words work too: OT duct finds the operating-theatre ductwork sheets on both hospital projects, and the search reports how long it took. Results only ever include projects the person can see.",
        act: async (r) => { await r.type("#pal-q", "OT duct", { chunk: 1, after: 400 }); },
      },
      {
        say: "Knowledge search goes deeper. It searches decisions, client comments, RFI answers and review comments, highlights the matching words, and links every result to its project and sheets. Here, OT ceiling HEPA finds the review comment, the client comment and the decision behind the operating-theatre ceilings.",
        act: async (r) => {
          await r.key("Escape", { shot: false }); r.zoomOut();
          await r.go("#/knowledge", { wait: 700 });
          await r.type("#kn-q", "OT ceiling HEPA", { chunk: 2 });
          await r.page.keyboard.press("Enter"); await r.wait(800); await r.frame("cut");
          await r.zoom("main .card >> nth=-1", { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "Contacts hold every outside person and organisation, by kind: client, consultant, contractor or authority. Adding someone whose email already exists raises a warning, so the list stays clean.",
        act: async (r) => { r.zoomOut(); await r.go("#/contacts", { wait: 800 }); },
      },
    ],
  },

  {
    id: "reports", num: "18", title: "Reports and baseline metrics",
    steps: [
      {
        say: "Chapter eighteen: reports.",
        act: async (r) => { await r.card(chapterCard("18", "Reports and baseline metrics", "The four numbers the firm agreed to improve, plus hours, utilisation, review cycle and missing timesheets.", [{ icon: "layout-dashboard", text: "Nikhil Prasad · Owner / Principal" }])); },
      },
      {
        say: "The baseline report tracks the four measures the firm agreed to improve: the share of sheets issued after their planned date, the average working days a sheet spends in check, hours logged against hours planned, and the days from deliverables issued to invoice.",
        act: async (r) => { await r.as("owner"); await r.go("#/reports?tab=baseline", { wait: 900 }); await r.zoom(".metrics", { pad: 16, max: 1.6 }); },
      },
      {
        say: "Each measure is broken down by month and by project, for any date range, with the definitions printed on the report itself. The report downloads as a PDF for the monthly review.",
        act: async (r) => { r.zoomOut(); await r.scrollBy(380); await r.scrollTo(0, 6); await r.click("[data-act=export-baseline]", { wait: 900 }); },
      },
      {
        say: "Hours by project and stage compares planned and logged hours for every fee stage.",
        act: async (r) => { await r.clearToasts(); await r.go("#/reports?tab=hours", { wait: 800 }); },
      },
      {
        say: "Utilisation compares billable hours with available hours, by discipline and by person. People are listed alphabetically, never ranked: DrawingOps is not a productivity league table.",
        act: async (r) => { await r.go("#/reports?tab=util", { wait: 800 }); await r.hl("main .alert"); },
      },
      {
        say: "Review cycle shows the average working days in check by discipline and by checker, and how long sheets spend in each state. And the missing timesheets list sends reminders with one click.",
        act: async (r) => { r.hlOff(); await r.go("#/reports?tab=review", { wait: 800 }); await r.go("#/reports?tab=missing", { wait: 700 }); },
      },
    ],
  },

  {
    id: "intel", num: "19", title: "Intelligence: forecasts and drawing checks",
    steps: [
      {
        say: "Chapter nineteen: intelligence. Every forecast and AI check in DrawingOps is advisory, clearly labelled, and switched on only after the firm has built up enough of its own history.",
        act: async (r) => { await r.card(chapterCard("19", "Intelligence: forecasts and drawing checks", "Late-risk prediction, workload forecasting and AI drawing checks. Advisory, labelled, human-approved, and gated on six months of the firm's own history.")); },
      },
      {
        say: "A model scores every open sheet's risk of going late, and explains its reasons: working days left, progress so far, the owner's load this week, the number of review rounds, and how often that discipline's sheets have run late. Forecasts never change any data.",
        act: async (r) => { await r.go("#/portfolio", { wait: 800 }); await r.scrollIntoView('main section.card:has-text("Forecast: sheets most likely")', 0.15); await r.frame("cut"); await r.zoom('main section.card:has-text("Forecast: sheets most likely")', { pad: 10, max: 1.5, anchor: "top" }); },
      },
      {
        say: "The workload forecast projects each discipline's hours for the next eight weeks beside planned allocations and capacity, and shows its own measured error, so people know how far to trust it.",
        act: async (r) => { r.zoomOut(); await r.go("#/disciplines/M", { wait: 900 }); await r.scrollIntoView('main section.card:has-text("Workload forecast")', 0.12); await r.frame("cut"); await r.zoom('main section.card:has-text("Workload forecast")', { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "AI drawing checks read the title blocks and cross-references of uploaded PDFs, and raise findings, such as an empty checked-by field, or a callout that points to a sheet missing from the register. Each finding shows its confidence.",
        act: async (r) => { r.zoomOut(); await r.as("senior"); await r.go("#/intelligence/findings", { wait: 900 }); await r.zoom("main table", { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Nothing changes until a person decides. Accepting a finding records the decision and tells the sheet's owner; dismissing it is recorded too.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=fd-set][data-s=accepted] >> nth=0", { wait: 900 }); },
      },
      {
        say: "The administrator controls each capability, off, evaluation or on. They unlock only after a gate: at least six months of clean history and two thousand issued revisions, with back-tested accuracy shown against simple rules. In this demonstration, the history, accuracy and forecast figures are simulated stand-ins.",
        act: async (r) => { await r.clearToasts(); await r.as("admin"); await r.go("#/admin/intelligence", { wait: 900 }); await r.zoom("main .card >> nth=0", { pad: 10, max: 1.5 }); },
      },
    ],
  },
];

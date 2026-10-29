/* Chapters 04 to 07: projects and fee stages, the drawing register, getting drawings in, the sheet page. */
const path = require("path");
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });
const sheetId = (r, n, pid = "p1") => r.eval(([n, pid]) => DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n).id, [n, pid]);

module.exports = [
  {
    id: "stages", num: "04", title: "Projects, fee stages and teams",
    steps: [
      {
        say: "Chapter four: projects, fee stages and teams, from the project lead's point of view.",
        act: async (r) => { await r.card(chapterCard("04", "Projects, fee stages and teams", "Set up a project from its appointment letter: fee stages, required purposes, senior QC, team and history.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "The projects list shows every project this person can see, with client, type, current stage, lead, sheets issued against planned, and late counts. It can be searched, filtered by state and type, and exported.",
        act: async (r) => { await r.as("lead"); await r.go("#/projects", { wait: 800 }); },
      },
      {
        say: "Creating a project takes a minute: a code in the firm's format, the name, client, type, location, fee value, dates, the project lead, the document controller, and a fee-stage template.",
        act: async (r) => {
          await r.click('a[href="#/projects/new"]', { wait: 700, trans: "fade" });
          await r.type("#np-name", "Sarjapur Road Cancer Centre", { chunk: 4 });
          await r.type("#np-client", "Navjeevan Health Trust", { chunk: 4 });
          await r.type("#np-loc", "Sarjapur Road, Bengaluru", { chunk: 4 });
          await r.type("#np-fee", "4,20,00,000", { chunk: 3 });
          await r.zoom("form[data-submit=np-create]", { pad: 12, max: 1.3, anchor: "top" });
        },
      },
      {
        say: "Project codes must be unique across the firm. Reusing the code of HSR Block B is refused, with a message that says exactly why.",
        act: async (r) => {
          r.zoomOut();
          const code = await r.page.inputValue("#np-code");
          await r.type("#np-code", "2026-014", { chunk: 2 });
          await r.click("form[data-submit=np-create] button.primary", { wait: 700 });
          await r.zoom("#np-code", { pad: 70, max: 1.6 });
          r.newCode = code;
        },
      },
      {
        say: "With a fresh code, creating the project lays out its fee stages from the template, with dates spread across the project period.",
        act: async (r) => { r.zoomOut(); await r.type("#np-code", r.newCode, { chunk: 2 }); await r.click("form[data-submit=np-create] button.primary", { wait: 1000, trans: "fade" }); await r.clearToasts(); await r.frame("none", { dur: 0.05 }); },
      },
      {
        say: "The stage plan mirrors the appointment letter: each stage's share of the fee and its amount, planned dates, the issue purposes the stage requires, and whether it needs senior quality control.",
        act: async (r) => { await r.zoom("main .card", { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Fees must total one hundred percent before the plan can be saved as final. Until then it stays a draft, and the total is flagged.",
        act: async (r) => {
          r.zoomOut();
          const sel = "main input[data-k=pct] >> nth=0";
          await r.type(sel, "12", { chunk: 2 });
          await r.page.keyboard.press("Tab"); await r.wait(600); await r.clearToasts();
          await r.scrollIntoView("main tfoot", 0.55); await r.frame("cut");
          await r.hl("main tfoot");
        },
      },
      {
        say: "Correcting the figure brings the total back to one hundred percent, and the plan is saved as final. Every change to the plan is written to the audit trail.",
        act: async (r) => {
          r.hlOff();
          const orig = await r.eval(() => { const p = DO.store.S.projects[DO.store.S.projects.length - 1]; return String(DO.store.stagesOf(p.id)[0].pct + (100 - DO.store.stagesOf(p.id).reduce((a, s) => a + s.pct, 0))); });
          await r.type("main input[data-k=pct] >> nth=0", orig, { chunk: 2 });
          await r.page.keyboard.press("Tab"); await r.wait(600); await r.frame("cut");
          await r.click("[data-act=sp-final]", { wait: 600 });
          await r.zoom("main .card .card-foot", { pad: 60, max: 1.5 });
        },
      },
      {
        say: "On a live project such as HSR Block B, the appointment letter is attached, stages one and two are invoiced with their fee percentage locked, stage three is ready to invoice, and stage four is active. Stages move by themselves as their sheets are started and issued.",
        act: async (r) => { await r.go("#/projects/p1/stages", { wait: 900 }); await r.zoom("main .card", { pad: 10, max: 1.3, anchor: "top" }); },
      },
      {
        say: "The team tab lists everyone on the project with their project role and discipline, their hours here this week, and their load across all projects. Hours are visible only to the person, their discipline lead, the project lead and the owner.",
        act: async (r) => { await r.go("#/projects/p1/team", { wait: 800 }); },
      },
      {
        say: "Adding someone to the team gives them access to the project, and they are notified in the app and by email.",
        act: async (r) => {
          await r.click("[data-act=tm-add]", { wait: 500 });
          await r.select("#tm-u", "u_tan", { wait: 300 });
          await r.select("#tm-r", "Designer", { wait: 300 });
          await r.click(".dialog-foot .btn.primary", { wait: 700 });
        },
      },
      {
        say: "The activity feed records every state change, issue, transmittal, stage event, import and client comment, newest first, and can be filtered by person, event type or discipline.",
        act: async (r) => { await r.go("#/projects/p1/activity", { wait: 800 }); await r.select("select[data-change=act-filter][data-k=type]", "transmittal", { wait: 600 }); },
      },
    ],
  },

  {
    id: "register", num: "05", title: "The drawing register",
    steps: [
      {
        say: "Chapter five: the drawing register.",
        act: async (r) => { await r.card(chapterCard("05", "The drawing register", "Every sheet the firm owes, from the day it is planned: search, filter, group, edit in place, act in bulk, export.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "The register is the heart of DrawingOps. It lists every sheet the firm owes on the project, with number, title, discipline, package, owner, checker, state, planned date, current revision and flags. All one hundred and thirty-two sheets of HSR Block B render instantly.",
        act: async (r) => { await r.go("#/projects/p1/register", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "Search covers sheet numbers, titles, earlier numbers and owners. Typing OT duct finds the operating-theatre ductwork sheets straight away.",
        act: async (r) => { r.zoomOut(); await r.type("#reg-q", "OT duct", { chunk: 1, after: 500 }); await r.frame("cut"); },
      },
      {
        say: "Filters combine: discipline, stage, state, owner and package, plus quick toggles for late or at-risk sheets only. Here are the late HVAC sheets.",
        act: async (r) => {
          await r.go("#/projects/p1/register", { wait: 700, shot: false });
          await r.select("select[data-change=reg-f][data-k=disc]", "M", { wait: 700 });
          await r.check('label.fchip input[data-k=late]', { wait: 700 });
        },
      },
      {
        say: "The register can be grouped by discipline, package or stage, with a running count of issued and late sheets in each group. Any combination of filters, grouping and sort can be saved as a named view, and columns can be shown or hidden.",
        act: async (r) => {
          await r.go("#/projects/p1/register", { wait: 700, shot: false });
          await r.select("select[data-change=reg-f][data-k=group]", "discipline", { wait: 800 });
          await r.click("[data-act=reg-views]", { wait: 400 });
          await r.zoom(".menu", { pad: 120, max: 1.5 });
        },
      },
      {
        say: "Owners, checkers, packages and planned dates can be edited right in the table. Each change saves immediately, is audited, and can be undone from the confirmation.",
        act: async (r) => {
          await r.key("Escape", { shot: false });
          await r.go("#/projects/p1/register?state=planned", { wait: 800 });
          const sel = "select.cell[data-k=ownerId] >> nth=1";
          const vals = await r.page.locator(sel).evaluate((el) => ({ cur: el.value, opts: [...el.options].map((o) => o.value) }));
          const next = vals.opts.find((v) => v !== vals.cur);
          await r.select(sel, next, { wait: 600 });
          await r.zoom(".toast", { pad: 80, max: 1.5 });
        },
      },
      {
        say: "Selecting several sheets brings up the bulk bar: assign an owner or a checker, shift planned dates, move sheets into a package, change their state, issue them, or export the selection.",
        act: async (r) => {
          r.zoomOut();
          const undo = r.page.locator(".toast [data-undo]").first();
          if (await undo.count()) { await undo.click(); await r.wait(400); }
          await r.clearToasts();
          for (let i = 0; i < 4; i++) await r.click(`input[data-act=reg-sel] >> nth=${i}`, { wait: 200, shot: i === 3 });
          await r.zoom(".bulkbar", { pad: 40, max: 1.5 });
        },
      },
      {
        say: "Shifting dates counts working days on the firm's calendar, so weekends and holidays are skipped. Every sheet gets its own audit entry, and the whole change can be undone.",
        act: async (r) => {
          r.zoomOut();
          await r.click("[data-act=bulk-shift]", { wait: 500 });
          await r.type("#sh-n", "5", { chunk: 1 });
          await r.click(".dialog-foot .btn.primary", { wait: 700 });
        },
      },
      {
        say: "Changing state in bulk moves only the sheets that are allowed to move, and reports the others with the reason they were skipped.",
        act: async (r) => { await r.clearToasts(); await r.click("[data-act=bulk-state]", { wait: 400 }); await r.zoom(".menu", { pad: 100, max: 1.5 }); },
      },
      {
        say: "A new sheet can be added at any time. It exists from the day it is planned, before any file, and its number is checked against the discipline's numbering rule as you type.",
        act: async (r) => {
          await r.key("Escape", { shot: false }); r.zoomOut();
          await r.click("[data-act=bulk-clear]", { wait: 300, shot: false });
          await r.click("[data-act=reg-new]", { wait: 600 });
          await r.type("#sf-num", "A1O1", { chunk: 1, after: 400 });
          await r.frame("cut");
          await r.type("#sf-num", "A-118", { chunk: 1, after: 400 });
          await r.type("#sf-t", "Seventh Floor Plan", { chunk: 4 });
        },
      },
      {
        say: "Every list exports to Excel, PDF or CSV with the current filters applied. And for people who live in the register, keyboard shortcuts move, select and open rows without the mouse.",
        act: async (r) => {
          await r.key("Escape", { shot: false });
          await r.go("#/projects/p1/register", { wait: 700 });
          await r.click("[data-act=reg-export]", { wait: 400 });
          await r.zoom(".menu", { pad: 120, max: 1.5 });
        },
      },
    ],
  },

  {
    id: "intake", num: "06", title: "Getting drawings in: import, PDFs and CAD sync",
    steps: [
      {
        say: "Chapter six: getting sheets and drawings into the system.",
        act: async (r) => { await r.card(chapterCard("06", "Getting drawings in", "Import an Excel register, upload PDFs with automatic matching and naming checks, and sync sheet lists from Revit and AutoCAD.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "Most firms start from an Excel sheet list. The import wizard accepts an Excel workbook or a CSV file, and recognises common column headings automatically.",
        act: async (r) => { await r.key("Escape", { shot: false }); await r.go("#/projects/p1/import", { wait: 800 }); await r.click("[data-act=imp-sample]", { wait: 1200, trans: "fade" }); },
      },
      {
        say: "The preview checks every row before anything is created. This sample contains three deliberate problems: a sheet number that already exists, an unknown discipline, and a date that does not exist. Each is explained in plain words.",
        act: async (r) => { await r.click("[data-act=imp-preview]", { wait: 900 }); await r.scrollIntoView("[data-act=imp-commit]", 0.75); await r.frame("cut"); await r.zoom("main .card >> nth=-1", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Imports are all or nothing. Once the problem rows are skipped, the valid sheets are created in one step, and the whole import can be undone for twenty-four hours, as long as none of the new sheets has moved.",
        act: async (r) => {
          r.zoomOut();
          for (let i = 0; i < 3; i++) await r.click('tr[style*="danger"] [data-act=imp-skip] >> nth=0', { wait: 300, shot: i === 2 });
          await r.click("[data-act=imp-commit]", { wait: 900, trans: "fade" });
        },
      },
      {
        say: "Undoing removes the five imported sheets again.",
        act: async (r) => { await r.click("[data-act=imp-undo] >> nth=0", { wait: 700 }); const ok = r.page.locator("#cf-ok"); if (await ok.count()) await r.click("#cf-ok", { wait: 700 }); },
      },
      {
        say: "Drawings arrive as PDFs. Dropping a batch of files matches each one to its sheet by the number in the file name, or, for scans and badly named files, by reading the text of the title block: here, a scanned file called scan_0042 is recognised as F-101 from its title block. Each file becomes a draft revision with the next revision code.",
        act: async (r, d) => {
          await r.go("#/projects/p1/upload", { wait: 800 });
          const dir = path.join(d.DOCS, "sample-pdfs");
          await r.files("#up-in", [path.join(dir, "M-206_C01.pdf"), path.join(dir, "scan_0042.pdf"), path.join(dir, "A104 ground floor rev.pdf")], { wait: 1500, pointAt: "main .dropzone, main [data-act=up-drop], main .card" });
          await r.zoom("main .card >> nth=-1", { pad: 8, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "Every file is checked on the way in: it must be a real PDF, under the size limit, and not a duplicate of a file already uploaded. A file whose name breaks the firm's naming rule is kept as a draft, but blocked from issue until it is renamed.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=up-go]", { wait: 1500, trans: "fade" }); },
      },
      {
        say: "With the Revit add-in and the AutoCAD plugin, sheet lists sync straight from the model. In this demonstration the plugins are simulated. New sheets arrive as proposals, and nothing is created until a lead accepts them. When a title in the model differs from the register, the lead decides which one wins.",
        act: async (r) => { await r.go("#/projects/p1/cad-sync", { wait: 900 }); await r.zoom('main section.card:has-text("Proposed")', { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Accepting a proposal creates the sheet in the register. Alongside, a file-storage connector reports CAD file activity, so everyone can see when a drawing file was last saved, and by whom.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=cad-accept] >> nth=0", { wait: 800 }); await r.hl('main section.card:has-text("File storage activity")'); },
      },
    ],
  },

  {
    id: "sheet", num: "07", title: "The sheet page",
    steps: [
      {
        say: "Chapter seven: the sheet page, where everything about one drawing comes together.",
        act: async (r) => { await r.card(chapterCard("07", "The sheet page", "The current drawing, every revision, every review, who received what, and the full history of one sheet.")); },
      },
      {
        say: (d) => `Here is M-205, OT ductwork for level two. The header shows its discipline, stage, package, owner, checker and planned date. It is ${d.m205.state}, ${d.m205.flag}, and the advisory forecast puts its late risk at ${d.m205.risk} percent.`,
        act: async (r, d) => { const id = await sheetId(r, "M-205"); await r.go(`#/projects/p1/sheets/${id}`, { wait: 2200 }); d.m205 = await r.eval((id) => { const s = DO.store.sheet(id); const f = DO.store.flagsFor(s)[0]; return { state: DO.store.label(s.state).toLowerCase(), flag: f ? (f.kind === "late" ? `late by ${f.n} working day${f.n === 1 ? "" : "s"}` : f.text.toLowerCase()) : "on track", risk: DO.store.lateRisk(s)?.prob ?? 0 }; }, id); await r.zoom(["main h2.display", "[data-act=sd-more]"], { pad: 16, max: 1.6 }); },
      },
      {
        say: "The current revision opens in the built-in viewer: a real A3 drawing with the firm's full title block. It can be downloaded, opened in a new tab, or shown full screen.",
        act: async (r) => { r.zoomOut(); await r.zoom("main iframe", { pad: 40, max: 1.45 }); },
      },
      {
        say: "Every revision stays on record. Opening an earlier one shows a clear superseded banner, and downloading it stamps a diagonal SUPERSEDED watermark and the date on every page, so an old print is never mistaken for the current one.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=sd-rev] >> nth=-1", { wait: 2200 }); await r.zoom("main iframe", { pad: 60, max: 1.35 }); },
      },
      {
        say: "On the right, the reviews card lists every check and senior QC decision for each revision, with the reviewer and the date.",
        act: async (r) => { r.zoomOut(); await r.zoom("main section.card[aria-labelledby=rv-t]", { pad: 10, max: 1.6 }); },
      },
      {
        say: "Who has which revision shows every person and organisation that received this sheet, which revision they hold, and on which transmittal, so a superseded copy in someone's hands is never a mystery.",
        act: async (r) => { r.zoomOut(); await r.scrollIntoView("main section.card[aria-labelledby=ds-t]", 0.25); await r.frame("cut"); await r.zoom("main section.card[aria-labelledby=ds-t]", { pad: 10, max: 1.6 }); },
      },
      {
        say: "Below that, the activity timeline shows every state change with who made it, when, and why, followed by CAD file activity and the results of AI drawing checks, which we will see later.",
        act: async (r) => { r.zoomOut(); await r.scrollBy(520); },
      },
      {
        say: "The more menu holds the less frequent actions: editing sheet details, working notes, and, for the project lead, overriding a workflow step with a written reason. Even an override stays within the allowed transitions, and is audited.",
        act: async (r) => { await r.scrollTo(0); await r.click("[data-act=sd-more]", { wait: 400 }); await r.zoom(".menu", { pad: 100, max: 1.5 }); },
      },
    ],
  },
];

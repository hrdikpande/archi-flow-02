/* Drives demo/demo.html through every module and captures 2x screenshots + element rects for the video.
   Run from the repo root: node brag-output/work/capture.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(__dirname, "../../frontend/node_modules/playwright"));
const ROOT = path.join(__dirname, "../..");
const URL = require("url").pathToFileURL(path.join(ROOT, "demo/demo.html")).href;
const DOCS = path.join(ROOT, "demo/assets/documents");
const OUT = path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });
const manifest = {};
const VW = 1440, VH = 810;

(async () => {
  const browser = await chromium.launch({ channel: "chromium" });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const S = (fn, arg) => page.evaluate(fn, arg);
  const go = async (h, wait = 400) => { await S((x) => { location.hash = x; }, h); await page.waitForTimeout(wait); };
  const clearToasts = () => S(() => document.querySelectorAll(".toast").forEach((t) => t.remove()));
  const rect = async (sel) => {
    const el = typeof sel === "string" ? await page.$(sel) : sel;
    if (!el) return null;
    const b = await el.boundingBox();
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  // targets: { key: selector }  → rects stored in CSS px of the 1440x810 viewport
  const snap = async (name, targets = {}, { keepToasts = false, wait = 250 } = {}) => {
    if (!keepToasts) await clearToasts();
    await page.waitForTimeout(wait);
    const r = {};
    for (const [k, sel] of Object.entries(targets)) r[k] = await rect(sel);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    manifest[name] = { w: VW, h: VH, targets: r };
    console.log("shot", name, Object.entries(r).map(([k, v]) => `${k}:${v ? "ok" : "MISSING"}`).join(" "));
  };
  const signIn = async (email) => {
    await S(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
    await page.waitForSelector(`[data-act=cred-go][data-email="${email}"]`);
    await page.click(`[data-act=cred-go][data-email="${email}"]`);
    if (email.startsWith("admin")) { await page.waitForSelector("#si-code"); await page.fill("#si-code", "246810"); await page.click("form[data-submit=signin-totp] button.primary"); }
    await page.waitForSelector(".shell"); await clearToasts();
  };
  const sheetId = (n, pid = "p1") => S(([n, pid]) => DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n).id, [n, pid]);

  await page.goto(URL);
  await page.waitForSelector(".creds");
  await S(() => { DO.store.reset(); DO.app.applyTheme("light"); });
  await page.reload(); await page.waitForSelector(".creds");

  // ---- Sign in
  await snap("signin", { email: "#si-email", sso: "text=Sign in with Microsoft", creds: ".creds" });
  await S(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
  await page.waitForSelector('[data-act=cred-go][data-email="admin@firm.example"]');
  await page.click('[data-act=cred-go][data-email="admin@firm.example"]');
  await page.waitForSelector("#si-code"); await page.fill("#si-code", "246810");
  await snap("totp", { code: "#si-code" });

  // ---- Owner: portfolio
  await signIn("owner@firm.example");
  await go("#/portfolio", 600);
  await snap("portfolio", { late: "a.metric", projects: "main table" });
  await page.click("a.metric"); await page.waitForTimeout(500);
  await snap("late-list", { table: "main table" });
  await go("#/projects/p1", 600);
  await snap("p1-overview", {});
  await page.click("[data-act=notifications]"); await page.waitForSelector("#notif-panel");
  await snap("notifications", { panel: "#notif-panel" });
  await page.keyboard.press("Escape");
  await go("#/reports?tab=baseline", 500);
  await snap("reports-baseline", {});
  await S(() => DO.app.applyTheme("dark")); await go("#/portfolio", 600);
  await snap("portfolio-dark", {});
  await S(() => DO.app.applyTheme("light"));

  // ---- Lead: stages, register, bulk, import
  await signIn("lead@firm.example");
  await go("#/projects/p1/stages", 500);
  await snap("p1-stages", {});
  await go("#/projects/p1/register", 600);
  await snap("register", { search: "main input[type=search]", table: "main table" });
  const ids = await page.$$eval("input[data-act=reg-sel]", (els) => els.slice(0, 4).map((e) => e.dataset.id));
  for (const id of ids) await page.click(`input[data-act=reg-sel][data-id="${id}"]`);
  await page.waitForTimeout(200);
  await snap("register-bulk", { bulk: ".bulkbar", shift: "[data-act=bulk-shift]", sel0: `input[data-act=reg-sel][data-id="${ids[0]}"]` });
  await page.click("[data-act=bulk-shift]"); await page.fill("#sh-n", "5"); await page.waitForTimeout(200);
  await snap("register-shift", { dialog: ".dialog", ok: ".dialog-foot .btn.primary" });
  await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(400);
  await snap("register-shifted", { toast: ".toast" }, { keepToasts: true });
  await go("#/projects/p1/import", 400);
  await page.click("[data-act=imp-sample]"); await page.waitForSelector("[data-act=imp-preview]");
  await snap("import-map", { preview: "[data-act=imp-preview]" });
  await page.click("[data-act=imp-preview]"); await page.waitForTimeout(400);
  await snap("import-preview", { bad: 'tr[style*="danger"]', commit: "[data-act=imp-commit]" });
  await go("#/projects/p1/cad-sync", 400);
  await snap("cad-sync", { accept: "[data-act=cad-accept]" });
  await go("#/projects/p1/team", 400);
  await snap("team", {});
  await go("#/projects/p1/activity", 400);
  await snap("activity", {});

  // ---- Sheet detail M-205
  const m205 = await sheetId("M-205");
  await go(`#/projects/p1/sheets/${m205}`, 1500);
  await snap("sheet-M205", { viewer: "main iframe", revs: "text=Revisions" }, { wait: 1200 });

  // ---- Designer: my work, pre-check
  await signIn("designer@firm.example");
  await go("#/", 500);
  await snap("designer-mywork", { start: "button[data-act=quick-transition][data-a=start]" });
  const m206 = await sheetId("M-206");
  await go(`#/projects/p1/sheets/${m206}`, 800);
  await snap("sheet-M206", { submit: "#sd-submit" }, { wait: 800 });
  await page.click("#sd-submit"); await page.waitForSelector("form[data-submit=pc-go]");
  const boxes = await page.$$("form[data-submit=pc-go] input[type=checkbox]");
  for (const b of boxes.slice(0, 2)) await b.check();
  await snap("precheck", { dialog: ".dialog", box: "form[data-submit=pc-go] input[type=checkbox]", ok: ".dialog-foot .btn.primary" });
  for (const b of boxes) await b.check();
  await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(400);
  await snap("precheck-done", { toast: ".toast" }, { keepToasts: true, wait: 400 });
  await go("#/timesheets", 500);
  await snap("timesheet", { cell: "input[data-change=ts-h]", submit: "[data-act=ts-submit]" });

  // ---- Checker: review queue
  await signIn("checker@firm.example");
  await go("#/reviews", 500);
  await snap("reviews", {});
  const a107 = await sheetId("A-107");
  const rv107 = await S((sid) => DO.store.S.reviews.find((v) => v.sheetId === sid && v.state === "open").id, a107);
  await go(`#/reviews?open=${rv107}`, 600);
  await page.fill("#rq-c", "Dimension chain at grid C does not close.");
  await snap("review-panel", { comment: "#rq-c", ret: "form[data-submit=rq-return] button.danger", approve: "#rq-approve-btn" }, { wait: 600 });
  await go("#/workload", 600);
  await snap("workload", { heat: "main table" });
  await go("#/disciplines/A", 500);
  await snap("discipline-A", {});

  // ---- Senior reviewer: delegation + findings
  await signIn("senior@firm.example");
  await go("#/reviews", 500);
  await snap("senior-reviews", { delegate: "[data-act=rq-delegate]" });
  await go("#/intelligence/findings", 500);
  await snap("findings", { accept: "[data-act=fd-set][data-s=accepted]" });

  // ---- Document controller: issue
  await signIn("dc@firm.example");
  await go("#/projects/p1/issue", 700);
  await snap("issue-blocked", { rename: "[data-act=sd-rename]" });
  await page.click("[data-act=sd-rename]"); await page.waitForTimeout(250);
  await page.click("[data-act=ic-all]"); await page.waitForTimeout(250);
  await snap("issue-ready", { summary: ".alert.info", preview: "[data-act=ic-preview]", issue: "[data-act=ic-issue]" });
  await page.click("[data-act=ic-preview]"); await page.waitForTimeout(1500);
  await snap("issue-cover", { cover: 'iframe[title="Cover sheet preview"]' }, { wait: 1200 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.click("[data-act=ic-issue]"); await page.waitForSelector("#cf-ok");
  await snap("issue-confirm", { ok: "#cf-ok" });
  await page.click("#cf-ok"); await page.waitForTimeout(700);
  await snap("issued", { toast: ".toast" }, { keepToasts: true, wait: 300 });
  const tr = await S(() => { const t = DO.store.S.transmittals[DO.store.S.transmittals.length - 1]; return { token: t.token, r: t.recipients[0].contactId, id: t.id }; });
  await go("#/projects/p1/transmittals", 500);
  await snap("transmittals", {});

  // ---- Mailbox + external page + site view
  await go("#/mailbox", 600);
  await snap("mailbox", {});
  await S(() => { DO.auth.signOut(); });
  await go(`#/t/${tr.token}?r=${tr.r}`, 700);
  await snap("external", { zip: "[data-act=ext-zip]", ack: "[data-act=ext-ack]" });
  await page.click("[data-act=ext-ack]"); await page.waitForTimeout(300);
  await snap("external-ack", {}, { keepToasts: true });
  const site = await S(() => DO.store.project("p1").siteToken);
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const pp = await phone.newPage();
  await pp.goto(URL); await pp.waitForTimeout(800);
  await pp.evaluate((s) => { location.hash = `#/site/${s}`; }, site); await pp.waitForTimeout(900);
  await pp.screenshot({ path: path.join(OUT, "site-view.png") });
  manifest["site-view"] = { w: 390, h: 844, targets: {} };
  await phone.close();

  // ---- Lead: comments, client approval
  await signIn("lead@firm.example");
  await go("#/projects/p1/comments", 600);
  await snap("comments", { queue: "[data-act=cm-queue]", add: "[data-act=cm-new]" });
  await go("#/projects/p5/stages", 600);
  await snap("p5-stages", { approve: "[data-act=sp-approve]" });
  await page.click("[data-act=sp-approve]");
  await page.setInputFiles("#ap-e", path.join(DOCS, "sample-client-approval-letter.pdf"));
  await snap("approval-dialog", { dialog: ".dialog", ok: ".dialog-foot .btn.primary" });
  await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(500);
  await snap("p5-ready", { toast: ".toast" }, { keepToasts: true });
  await go("#/projects/p1/decisions", 400);
  await snap("decisions", {});

  // ---- Construction (p4)
  for (const t of ["rfis", "submittals", "site", "changes", "clashes"]) { await go(`#/projects/p4/construction/${t}`, 600); await snap(`con-${t}`, {}); }
  const rfi = await S(() => DO.store.S.rfis.find((x) => x.projectId === "p4" && x.status === "open").id);
  await go("#/projects/p4/construction/rfis", 400);
  await page.click(`tr[data-act=rfi-open][data-id="${rfi}"]`); await page.waitForSelector("#rf-r");
  await page.fill("#rf-r", "Reroute the CHW pipes 300 mm higher; tray stays.");
  await snap("rfi-answer", { reply: "#rf-r" });
  await go("#/projects/p4/construction/clashes", 400);
  await page.setInputFiles("input[data-change=cx-import]", path.join(DOCS, "sample-clashes.bcfzip")); await page.waitForTimeout(700);
  await snap("clashes-imported", {}, { keepToasts: true });

  // ---- Search
  await go("#/projects", 500);
  await snap("projects", {});
  await page.keyboard.press("Control+k"); await page.waitForSelector("#pal-q");
  await page.fill("#pal-q", "A-101"); await page.waitForTimeout(300);
  await snap("palette", { q: "#pal-q", res: "#pal-res" });
  await page.keyboard.press("Escape");
  await go("#/knowledge?q=OT%20ceiling%20HEPA", 600);
  await snap("knowledge", {});

  // ---- Accounts: billing
  await signIn("accounts@firm.example");
  await go("#/billing", 600);
  await snap("billing", { csv: "[data-act=bl-csv]", mark: "[data-act=bl-mark]" });

  // ---- Admin
  await signIn("admin@firm.example");
  await go("#/admin/naming-rules", 500);
  await page.fill("#nr-test", "A-101_C02.pdf"); await page.dispatchEvent("#nr-test", "input"); await page.waitForTimeout(250);
  await snap("naming", { test: "#nr-test", res: "#nr-res" });
  await go("#/admin/automation", 500);
  await snap("automation", {});
  await S(() => DO.store.runSweep()); await go("#/admin/automation", 500);
  await snap("automation-run", {}, { keepToasts: true });
  for (const s of ["users", "audit", "integrations", "calendar", "intelligence", "checklists", "onboarding", "organisation"]) { await go(`#/admin/${s}`, 500); await snap(`admin-${s}`, {}); }

  fs.writeFileSync(path.join(__dirname, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log("errors:", errors.length, errors.slice(0, 5));
  await S(() => DO.store.reset());
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

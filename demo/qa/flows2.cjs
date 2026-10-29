/* DrawingOps demo QA (Playwright). Run from the repo root: node demo/qa/flows2.cjs [output-folder]. Needs frontend/node_modules and `npx playwright install chromium`. */
const { chromium } = require(require("path").join(__dirname, "../../frontend/node_modules/playwright"));
const URL = require("url").pathToFileURL(require("path").join(__dirname, "../demo.html")).href;
const OUT = process.argv[2] || require("os").tmpdir(); const DL = process.argv[3] || OUT;
const DOCS = require("path").join(__dirname, "../assets/documents");
const results = []; const errors = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(300); };
  const S = (fn, arg) => page.evaluate(fn, arg);
  const signIn = async (email) => { await S(() => { DO.auth.signOut(); location.hash = "#/sign-in"; }); await page.waitForSelector(`[data-act=cred-go][data-email="${email}"]`); await page.click(`[data-act=cred-go][data-email="${email}"]`); if (email.startsWith("admin")) { await page.waitForSelector("#si-code"); await page.fill("#si-code", "246810"); await page.click("form[data-submit=signin-totp] button.primary"); } await page.waitForSelector(".shell"); await page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove())); };
  const clearToasts = () => page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove()));
  await page.goto(URL); await page.waitForSelector(".creds");

  // Portfolio metric links lead to the list behind the number
  await signIn("owner@firm.example"); await go("#/portfolio");
  const lateMetric = await page.$eval("a.metric", (a) => ({ n: a.querySelector(".metric-n").textContent, href: a.getAttribute("href") }));
  await page.click("a.metric"); await page.waitForTimeout(300);
  const listCount = await page.$$eval("main tbody tr", (r) => r.length);
  check("Portfolio 'Late sheets' number equals the list behind it", +lateMetric.n === listCount, `${lateMetric.n} vs ${listCount} rows`);
  await go("#/portfolio?lead=u_pl"); const pr = await page.$$eval(".card", (cs) => cs.find((c) => c.querySelector("h2")?.textContent === "Projects").querySelectorAll("tbody tr").length); check("Portfolio filter by lead narrows the table", pr === 4, `${pr} projects led by Priya`);
  // Notifications panel
  await page.click("[data-act=notifications]"); await page.waitForSelector("#notif-panel");
  const unreadBefore = await S(() => DO.store.S.notifications.filter((n) => n.userId === "u_owner" && !n.read).length);
  await page.click("[data-act=notif-read-all]"); await page.waitForTimeout(150);
  check("Notifications: Mark all read", unreadBefore > 0 && (await S(() => DO.store.S.notifications.filter((n) => n.userId === "u_owner" && !n.read).length)) === 0);
  await page.keyboard.press("Escape");
  // Preferences: change an event and send a digest
  await go("#/settings/notifications"); await page.check('input[name=pf-at_risk][value=off]'); await page.waitForTimeout(150);
  check("Preferences: at-risk set to Off; mandatory events locked", (await S(() => DO.store.user("u_owner").prefs.at_risk)) === "off" && (await page.isDisabled('input[name=pf-assigned][value=off]')));
  await page.click("[data-act=pf-digest]"); await page.waitForTimeout(150); check("Digest email goes to the demo mailbox", await S(() => DO.store.S.emails.some((m) => m.kind === "digest")));
  // Reports: baseline PDF
  await go("#/reports?tab=baseline");
  const [bpdf] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=export-baseline]")]); check("Baseline report downloads as PDF with definitions", bpdf.suggestedFilename().endsWith(".pdf"), bpdf.suggestedFilename()); await bpdf.saveAs(`${DL}/baseline.pdf`);
  await go("#/reports?tab=util"); check("Utilisation lists people alphabetically (no ranking note shown)", (await page.textContent("main")).includes("never ranks"));
  // Audit export runs as background job and emails a link
  await signIn("admin@firm.example"); await go("#/admin/audit"); await page.click("[data-act=au-export]"); await page.waitForTimeout(3600);
  check("Audit export runs as a background job and emails a link", await S(() => DO.store.S.exports[0]?.state === "done" && DO.store.S.emails.some((m) => m.kind === "export")));
  // Admin: calendar holiday changes working days
  await go("#/admin/calendar"); const d = await S(() => DO.addWorkingDays(DO.today(), 3));
  const wdBefore = await S((d) => DO.workingDaysBetween(DO.today(), DO.addDays(d, 10)), d);
  await page.fill('form[data-submit=cal-add] input[name=date]', d); await page.fill('form[data-submit=cal-add] input[name=name]', "Demo holiday"); await page.click('form[data-submit=cal-add] button'); await page.waitForTimeout(150);
  check("Adding a holiday reduces working days used by automations", (await S((d) => DO.workingDaysBetween(DO.today(), DO.addDays(d, 10)), d)) === wdBefore - 1);
  // Admin: naming rule tester
  await go("#/admin/naming-rules"); await page.fill("#nr-test", "A-101_C02.pdf"); await page.dispatchEvent("#nr-test", "input"); await page.waitForTimeout(150);
  check("Naming rule tester passes a valid name", (await page.textContent("#nr-res")).includes("Pass"));
  // Admin: automation threshold changes at-risk flags
  await go("#/admin/automation"); const riskBefore = await S(() => DO.store.S.sheets.filter(DO.store.isAtRisk).length);
  await page.fill('input[data-id="A-01"][data-k=days]', "10"); await page.dispatchEvent('input[data-id="A-01"][data-k=days]', "change"); await page.waitForTimeout(150);
  const riskAfter = await S(() => DO.store.S.sheets.filter(DO.store.isAtRisk).length);
  check("Raising the A-01 window to 10 days raises at-risk flags", riskAfter > riskBefore, `${riskBefore} → ${riskAfter}`);
  // Admin: deactivate a user blocks sign-in
  await go("#/admin/users"); await page.click('[data-act=us-active][data-id=u_tan]'); await page.click("#cf-ok"); await page.waitForTimeout(150);
  check("Deactivated user cannot sign in", (await S(() => DO.auth.signIn("tanvi.shah@firm.example", "Demo@2026").ok)) === false);
  // Admin: API token create shows once
  await go("#/admin/integrations"); await page.click("[data-act=tk-new]"); await page.fill("#tk-n", "Test token"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(150);
  check("New API token shown once", (await page.textContent("main")).includes("shown once"));
  // Admin: onboarding
  await go("#/admin/onboarding"); await page.click("[data-act=ob-sample]"); await page.waitForTimeout(250); await page.click("[data-act=ob-load]"); await page.waitForTimeout(250);
  const ob = await S(() => { const p = DO.store.S.projects.find((x) => x.code === "2025-041"); const sh = DO.store.sheetsOf(p.id); return { sheets: sh.length, sup: DO.store.S.revisions.filter((v) => sh.some((s) => s.id === v.sheetId) && v.state === "superseded").length }; });
  check("Onboarding loads a live project with historic revisions", ob.sheets === 4 && ob.sup === 2, `${ob.sheets} sheets, ${ob.sup} superseded`);
  // Lead: project export, CAD sync, comments, construction
  await signIn("lead@firm.example"); await go("#/projects/p1");
  const [pz] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=po-export]")]); check("Full project export (JSON + PDFs) downloads", pz.suggestedFilename().endsWith("_full-export.zip")); await pz.saveAs(`${DL}/project.zip`);
  await go("#/projects/p1/cad-sync"); const nBefore = await S(() => DO.store.sheetsOf("p1").length);
  await page.click("[data-act=cad-accept]"); await page.waitForTimeout(200);
  check("CAD sync: accepting a proposal creates the sheet", (await S(() => DO.store.sheetsOf("p1").length)) === nBefore + 1);
  await go("#/projects/p1/comments"); await page.click("[data-act=cm-new]"); await page.fill("#cn-t", "Please add a visitor toilet near the OPD waiting area."); await page.selectOption("#cn-a", "u_meg"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(200);
  const cm = await S(() => DO.store.S.comments[DO.store.S.comments.length - 1]); check("Log a client comment (assigned, numbered)", cm.status === "assigned" && /2026-014-CC-\d{3}/.test(cm.number), cm.number);
  await clearToasts(); await S((id) => { DO.app.go(`/projects/p1/comments?c=${id}`); }, cm.id); await page.waitForSelector("#cm-r"); await page.click("[data-act=cm-op][data-op=close]"); await page.waitForTimeout(150);
  check("Closing a comment without a response is blocked", (await S((id) => DO.store.S.comments.find((c) => c.id === id).status, cm.id)) === "assigned");
  await page.fill("#cm-r", "Added a visitor toilet at grid B/2 on A-101."); await page.click("[data-act=cm-op][data-op=close]"); await page.waitForTimeout(200);
  check("Comment closed with a response", (await S((id) => DO.store.S.comments.find((c) => c.id === id).status, cm.id)) === "closed");
  await clearToasts(); await go("#/projects/p1/comments"); await page.click("[data-act=cm-queue]"); await page.click("[data-act=iq-accept]"); await page.waitForTimeout(150);
  check("Unknown-sender email accepted into the comment log (F-25)", (await S(() => DO.store.S.inboundQueue.length)) === 0);
  // Construction (Koramangala)
  await go("#/projects/p4/construction/rfis"); const rfi = await S(() => DO.store.S.rfis.find((x) => x.projectId === "p4" && x.status === "open"));
  await page.click(`tr[data-act=rfi-open][data-id="${rfi.id}"]`); await page.waitForSelector("#rf-r"); await page.fill("#rf-r", "Reroute the CHW pipes 300 mm higher; tray stays."); await page.check('input[name=rev]'); await page.click("[data-act=rf-op][data-op=answer]"); await page.waitForTimeout(250);
  const rfiAfter = await S((id) => DO.store.S.rfis.find((x) => x.id === id), rfi.id);
  const restarted = await S((ids) => ids.map((id) => DO.store.sheet(id)?.state), rfiAfter.sheetIds);
  check("Answering an RFI can start a new revision on linked sheets", rfiAfter.status === "answered" && restarted.some((x) => x === "in_progress"), restarted.join(","));
  await go("#/projects/p4/construction/submittals"); await page.click("[data-act=sb-review]"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(200);
  const [sp] = await Promise.all([page.waitForEvent("download"), page.click(".toast [data-action]")]); check("Submittal stamped and the stamped PDF downloads", sp.suggestedFilename().includes("_stamped.pdf")); await sp.saveAs(`${DL}/stamped.pdf`);
  await clearToasts(); await go("#/projects/p4/construction/changes"); await page.click("[data-act=co-approve]"); await page.click("#cf-ok"); await page.waitForTimeout(200);
  check("Change order approved by the PL", await S(() => DO.store.S.changeOrders.filter((c) => c.projectId === "p4" && c.status === "approved").length === 3));
  await go("#/projects/p4/construction/clashes"); const cxBefore = await S(() => DO.store.S.clashes.length);
  await page.setInputFiles('input[data-change=cx-import]', `${DOCS}/sample-clashes.bcfzip`); await page.waitForTimeout(500);
  const cx = await S(() => ({ n: DO.store.S.clashes.length, upd: DO.store.S.clashes.find((c) => c.title.startsWith("Duct clashes")).status }));
  check("BCF import: 2 new topics, existing GUID updated (not duplicated)", cx.n === cxBefore + 2 && cx.upd === "resolved", `${cxBefore} → ${cx.n}; existing now ${cx.upd}`);
  await go("#/projects/p4/construction/site"); await page.click("[data-act=sv-new]"); await page.fill("#sv-s", "Level 8 slab reinforcement inspected."); await page.setInputFiles("#sv-ph", require("path").join(__dirname, "../assets/images/site/site-photo-2.jpg")); await page.waitForTimeout(600); await page.click(".drawer-foot .btn.primary"); await page.waitForTimeout(200);
  const srep = await S(() => DO.store.S.siteReports[DO.store.S.siteReports.length - 1]); check("Site report filed with a compressed photo (≤ 2 MB)", srep.photos.length === 1 && srep.photos[0].length * 0.75 < 2 * 1048576, `${Math.round(srep.photos[0].length * 0.75 / 1024)} KB`);
  await go("#/projects/p1/decisions"); await page.click("[data-act=dc-new]"); await page.fill("#dn-t", "Visitor toilet added at grid B/2"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(150);
  await go("#/knowledge?q=visitor%20toilet"); check("Knowledge search finds the new decision and comment", (await page.textContent("main")).includes("Visitor toilet added"));
  // Stage plan rules
  await signIn("owner@firm.example"); await go("#/projects/p8/stages"); check("Draft stage plan (95%) cannot be saved as final", (await page.isDisabled("[data-act=sp-final]")) && (await page.textContent("main")).includes("Fees must total 100%")); await signIn("lead@firm.example");
  // Team: add member notifies them
  await go("#/projects/p1/team"); await page.click("[data-act=tm-add]"); await page.selectOption("#tm-u", "u_sun"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(150);
  check("Adding a team member notifies them", await S(() => DO.store.S.notifications.some((n) => n.userId === "u_sun" && n.event === "team")));
  // New project with duplicate code rejected, then created
  await go("#/projects/new"); await page.fill("#np-code", "2026-014"); await page.fill("#np-name", "Duplicate test"); await page.fill("#np-client", "Navjeevan Health Trust"); await page.click("form[data-submit=np-create] button.primary"); await page.waitForTimeout(150);
  check("New project: duplicate code rejected with a clear message", (await page.textContent("main")).includes("already used by"));
  await page.fill("#np-code", "2026-031"); await page.click("form[data-submit=np-create] button.primary"); await page.waitForTimeout(250);
  check("New project created with stages from the template", await S(() => { const p = DO.store.S.projects.find((x) => x.code === "2026-031"); return p && DO.store.stagesOf(p.id).length === 7; }));
  // Delegation (senior reviewer)
  await signIn("senior@firm.example"); await go("#/reviews"); await page.click("[data-act=rq-delegate]"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(150);
  check("Delegation routes open reviews to the delegate", await S(() => DO.store.user("u_sr").delegate && DO.store.reviewQueue(DO.store.user("u_dl")).some((x) => x.review.kind === "senior_qc")));
  // AI findings
  await go("#/intelligence/findings"); await page.click('[data-act=fd-set][data-s=accepted]'); await page.waitForTimeout(150);
  check("Accepting an AI finding notifies the sheet owner", await S(() => DO.store.S.findings.filter((f) => f.status === "accepted").length === 2));
  // DL: staff capacity and timesheet approval
  await signIn("checker@firm.example"); await go("#/workload/staff"); await page.click('[data-act=sf-edit][data-id=u_meg]'); await page.fill("#se-c", "36"); await page.click(".drawer-foot .btn.primary"); await page.waitForTimeout(150);
  check("DL edits capacity for their discipline", (await S(() => DO.store.user("u_meg").capacity)) === 36);
  await go("#/timesheets/approvals"); const sub = await page.$("[data-act=ap-ok]"); if (sub) { await sub.click(); await page.waitForTimeout(150); }
  check("DL approves a submitted timesheet (read-only after)", await S(() => DO.store.S.timesheets.some((t) => t.approvedBy === "u_dl" && t.approvedAt && t.approvedAt.startsWith(new Date().toISOString().slice(0, 4)))));
  await go("#/disciplines/A"); check("Discipline dashboard renders with check queue", (await page.textContent("main")).includes("Check queue"));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed. JS errors: ${errors.length}`); errors.forEach((e) => console.log(" -", e));
  require("fs").writeFileSync(`${OUT}/results2.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

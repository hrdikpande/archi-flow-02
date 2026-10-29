/* DrawingOps demo QA (Playwright). Run from the repo root: node demo/qa/smoke.cjs [output-folder]. Needs frontend/node_modules and `npx playwright install chromium`. */
const { chromium } = require(require("path").join(__dirname, "../../frontend/node_modules/playwright"));
const URL = require("url").pathToFileURL(require("path").join(__dirname, "../demo.html")).href;
const SHOTS = process.argv[2] || require("os").tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}\n${(e.stack || "").split("\n").slice(0, 3).join("\n")}`));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`console.${m.type()}: ${m.text()}`); });
  const t0 = Date.now();
  await page.goto(URL);
  await page.waitForSelector(".creds", { timeout: 15000 });
  console.log("loaded sign-in in", Date.now() - t0, "ms");
  await page.screenshot({ path: `${SHOTS}/01-signin.png` });
  const signIn = async (email) => {
    await page.evaluate(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
    await page.waitForSelector(`[data-act=cred-go][data-email="${email}"]`);
    await page.click(`[data-act=cred-go][data-email="${email}"]`);
    if (email.startsWith("admin")) { await page.waitForSelector("#si-code"); await page.fill("#si-code", "246810"); await page.click("form[data-submit=signin-totp] button.primary"); }
    await page.waitForSelector(".shell", { timeout: 10000 });
  };
  const visit = async (hash, name) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(350);
    const title = await page.title();
    const h1 = await page.$eval("main h1, main h2", (e) => e.textContent.trim()).catch(() => "(no heading)");
    console.log(`${name.padEnd(28)} ${hash.padEnd(44)} | ${h1.slice(0, 60)}`);
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  };
  await signIn("owner@firm.example");
  for (const [h, n] of [["#/", "owner-mywork"], ["#/portfolio", "portfolio"], ["#/sheets?flag=late", "sheets-late"], ["#/projects", "projects"], ["#/projects/p1", "p1-overview"], ["#/projects/p1/register", "p1-register"], ["#/projects/p1/stages", "p1-stages"], ["#/projects/p1/transmittals", "p1-transmittals"], ["#/projects/p1/team", "p1-team"], ["#/projects/p1/activity", "p1-activity"], ["#/projects/p1/comments", "p1-comments"], ["#/projects/p4/construction/rfis", "p4-rfis"], ["#/projects/p4/construction/submittals", "p4-subs"], ["#/projects/p4/construction/site", "p4-site"], ["#/projects/p4/construction/changes", "p4-changes"], ["#/projects/p4/construction/clashes", "p4-clashes"], ["#/projects/p1/decisions", "p1-decisions"], ["#/reviews", "owner-reviews"], ["#/workload", "workload"], ["#/workload/staff", "staff"], ["#/reports", "reports"], ["#/reports?tab=hours", "reports-hours"], ["#/reports?tab=review", "reports-review"], ["#/knowledge?q=OT%20ceiling%20HEPA", "knowledge"], ["#/billing", "billing"], ["#/contacts", "contacts"], ["#/disciplines/M", "discipline-M"], ["#/settings/notifications", "prefs"], ["#/mailbox", "mailbox"], ["#/intelligence/findings", "findings"], ["#/admin/audit", "audit"]]) await visit(h, n);
  // Sheet detail for M-205
  const sid = await page.evaluate(() => DO.store.S.sheets.find((s) => s.projectId === "p1" && s.number === "M-205").id);
  await visit(`#/projects/p1/sheets/${sid}`, "sheet-M205");
  await signIn("dc@firm.example");
  await visit("#/projects/p1/issue", "dc-issue");
  await signIn("designer@firm.example");
  await visit("#/", "designer-mywork"); await visit("#/timesheets", "designer-timesheet");
  await signIn("admin@firm.example");
  for (const s of ["organisation", "disciplines", "stage-templates", "codes", "naming-rules", "checklists", "intelligence", "calendar", "automation", "users", "integrations", "onboarding"]) await visit(`#/admin/${s}`, `admin-${s}`);
  const tok = await page.evaluate(() => DO.store.S.transmittals.filter((t) => t.projectId === "p1").slice(-1)[0].token);
  await visit(`#/t/${tok}`, "ext-transmittal");
  const site = await page.evaluate(() => DO.store.project("p1").siteToken);
  await visit(`#/site/${site}`, "site-view");
  const size = await page.evaluate(() => localStorage.getItem("drawingops-demo-state").length);
  console.log("localStorage chars", size);
  console.log("\nERRORS:", errors.length); errors.slice(0, 30).forEach((e) => console.log(" -", e));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

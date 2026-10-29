/* DrawingOps demo QA (Playwright). Run from the repo root: node demo/qa/axe.cjs [output-folder]. Needs frontend/node_modules and `npx playwright install chromium`. */
const { chromium } = require(require("path").join(__dirname, "../../frontend/node_modules/playwright"));
const AxeBuilder = require(require("path").join(__dirname, "../../frontend/node_modules/@axe-core/playwright")).default;
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(require("url").pathToFileURL(require("path").join(__dirname, "../demo.html")).href); await page.waitForSelector(".creds");
  const scan = async (name) => { const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).disableRules(["frame-tested"]).analyze(); const v = r.violations.map((x) => `${x.id}(${x.impact}) x${x.nodes.length}: ${x.nodes[0]?.target.join(" ")}`); console.log(`${name.padEnd(14)} violations: ${r.violations.length}${v.length ? "\n   " + v.join("\n   ") : ""}`); };
  await scan("sign-in");
  await page.click('[data-act=cred-go][data-email="lead@firm.example"]'); await page.waitForSelector(".shell"); await page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove()));
  const sid = await page.evaluate(() => DO.store.S.sheets.find((s) => s.projectId === "p1" && s.number === "A-101").id);
  for (const [h, n] of [["#/", "my-work"], ["#/portfolio", "portfolio"], ["#/projects/p1/register", "register"], [`#/projects/p1/sheets/${sid}`, "sheet"], ["#/workload", "workload"], ["#/timesheets", "timesheet"], ["#/projects/p1/issue", "issue"], ["#/reviews", "reviews"]]) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(400); await scan(n); }
  await b.close();
})();

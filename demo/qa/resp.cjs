/* DrawingOps demo QA (Playwright). Run from the repo root: node demo/qa/resp.cjs [output-folder]. Needs frontend/node_modules and `npx playwright install chromium`. */
const { chromium } = require(require("path").join(__dirname, "../../frontend/node_modules/playwright"));
const OUT = process.argv[2] || require("os").tmpdir();
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [label, w, h] of [["mobile", 390, 844], ["tablet", 820, 1180], ["laptop", 1280, 800]]) {
    const page = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: label === "mobile", hasTouch: label !== "laptop" })).newPage();
    page.on("pageerror", (e) => errs.push(`${label}: ${e.message}`));
    await page.goto(require("url").pathToFileURL(require("path").join(__dirname, "../demo.html")).href); await page.waitForSelector(".creds");
    const overflow = async (name) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); console.log(`${label.padEnd(7)} ${name.padEnd(16)} horizontal overflow: ${o}px`); return o; };
    await page.screenshot({ path: `${OUT}/${label}-signin.png`, fullPage: label === "mobile" }); await overflow("sign-in");
    await page.click('[data-act=cred-go][data-email="lead@firm.example"]'); await page.waitForSelector(".shell");
    const sid = await page.evaluate(() => DO.store.S.sheets.find((s) => s.projectId === "p1" && s.number === "A-101").id);
    for (const [hash, name] of [["#/", "mywork"], ["#/portfolio", "portfolio"], ["#/projects/p1/register", "register"], [`#/projects/p1/sheets/${sid}`, "sheet"], ["#/workload", "workload"], ["#/projects/p1/issue", "issue"], ["#/timesheets", "timesheet"]]) {
      await page.evaluate((x) => { location.hash = x; }, hash); await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/${label}-${name}.png` }); await overflow(name);
    }
    if (label === "mobile") { await page.click("[data-act=toggle-nav]"); await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/mobile-nav-open.png` }); }
    const site = await page.evaluate(() => DO.store.project("p1").siteToken);
    await page.evaluate((x) => { location.hash = x; }, `#/site/${site}`); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${label}-site.png` }); await overflow("site-view");
    const small = await page.evaluate(() => [...document.querySelectorAll(".site-row .btn")].filter((x) => x.getBoundingClientRect().height < 44).length);
    if (label === "mobile") console.log(`mobile  site view buttons under 44px: ${small}`);
  }
  console.log("errors:", errs.length, errs.slice(0, 5)); await b.close();
})();

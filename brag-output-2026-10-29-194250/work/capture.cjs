/* Captures the real DrawingOps UI used in the brag video: drives demo/demo.html through each role's flow
   (Playwright, preinstalled Chromium) and saves 2x PNG crops of exact elements to work/captures/.
   Usage: node work/capture.cjs   (from the brag output folder) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(__dirname, "captures");
const DOCS = path.join(ROOT, "demo/assets/documents");
const { PASSWORD, TOTP } = require(path.join(ROOT, "product-walkthrough/pipeline/lib/recorder.cjs")); // fictional prototype credentials
const EMAIL = { owner: "owner@firm.example", lead: "lead@firm.example", checker: "checker@firm.example", designer: "designer@firm.example", senior: "senior@firm.example", dc: "dc@firm.example", accounts: "accounts@firm.example", admin: "admin@firm.example" };
const HIDE = `.demo-fab,.creds,#si-code-h{display:none!important} .toast{transition:none!important;animation:none!important}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chromium", args: ["--lang=en-IN"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "en-IN", timezoneId: "Asia/Kolkata", colorScheme: "light", acceptDownloads: true });
  await ctx.clock.install({ time: new Date("2026-10-29T10:05:00+05:30") });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  page.on("popup", (p) => p.close().catch(() => {}));
  const demo = require("url").pathToFileURL(path.join(ROOT, "demo/demo.html")).href;
  await page.goto(demo); await page.clock.resume();
  await page.waitForSelector("#si-email, .creds");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); DO.store.reset(); DO.app.applyTheme("light"); });
  await page.reload(); await page.waitForSelector("#si-email");

  const wait = (ms) => page.waitForTimeout(ms);
  const prep = async () => { await page.addStyleTag({ content: HIDE }).catch(() => {}); await page.evaluate(() => document.querySelectorAll(".tip,[role=tooltip]").forEach((t) => t.remove())).catch(() => {}); };
  const toasts = () => page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove())).catch(() => {});
  const go = async (hash, ms = 900) => { await page.evaluate((h) => { document.querySelectorAll(".overlay,.drawer-wrap,#notif-panel,.menu").forEach((x) => x.remove()); location.hash = h; }, hash); await wait(ms); await page.evaluate(() => window.scrollTo(0, 0)); await toasts(); await prep(); };
  const signIn = async (role) => {
    await page.evaluate(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
    await page.waitForSelector("#si-email");
    await page.fill("#si-email", EMAIL[role]); await page.fill("#si-pw", PASSWORD);
    await page.click("form[data-submit=signin] button.primary");
    if (role === "admin") { await page.waitForSelector("#si-code"); await page.fill("#si-code", TOTP); await page.click("form[data-submit=signin-totp] button.primary"); }
    await page.waitForSelector(".shell", { timeout: 8000 }); await toasts();
  };
  const done = []; const marks = {}; let last = null;
  // Position of an element inside the last capture, in that PNG's pixels (2x), for cursors and rings in the video.
  const mark = async (key, sel) => {
    try { const b = await page.locator(sel).first().boundingBox(); const o = last.origin;
      (marks[last.name] = marks[last.name] || {})[key] = [b.x - o.x, b.y - o.y, b.width, b.height].map((v) => Math.round(v * 2));
    } catch (e) { console.log(`  ! mark ${key}: ${e.message.split("\n")[0]}`); errors.push("mark " + key); }
  };
  // Element screenshot, or a clip from the element's top to the bottom of `until` (e.g. the Nth table row).
  const shot = async (name, sel, opts = {}) => {
    try {
      await prep();
      const el = page.locator(sel).first();
      // Put the element's top just under the sticky app bar, so clips never catch the header.
      await el.evaluate((e) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -110); }); await wait(200);
      let origin;
      if (!opts.until) { origin = await el.boundingBox(); await el.screenshot({ path: path.join(OUT, name + ".png"), animations: "disabled", caret: "hide" }); }
      else {
        const a = await el.boundingBox(); const b = await page.locator(opts.until).first().boundingBox();
        if (opts.across) { const c = await page.locator(opts.across).first().boundingBox(); a.x = c.x; a.width = c.width; } // horizontal extent from another element
        const pad = opts.pad ?? 0;
        origin = { x: a.x - pad, y: a.y - pad };
        await page.screenshot({ path: path.join(OUT, name + ".png"), clip: { x: a.x - pad, y: a.y - pad, width: a.width + 2 * pad, height: Math.min(b.y + b.height, 900) - a.y + 2 * pad }, animations: "disabled", caret: "hide" });
      }
      done.push(name); console.log("  +", name); last = { name, origin }; return origin;
    } catch (e) { console.log("  ! " + name + ": " + e.message.split("\n")[0]); errors.push(name); }
  };
  // Save the PDF an <iframe> is showing (the demo renders revisions and cover sheets as blob: PDFs).
  const savePdf = async (name, sel) => {
    const b64 = await page.locator(sel).first().evaluate(async (f) => { const r = await fetch(f.src.split("#")[0]); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); });
    fs.writeFileSync(path.join(OUT, name + ".pdf"), Buffer.from(b64, "base64")); done.push(name + ".pdf"); console.log("  +", name + ".pdf");
  };
  const sheetId = (n, pid = "p1") => page.evaluate(([n, pid]) => DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n).id, [n, pid]);
  const reviewId = (n, kind) => page.evaluate(([n, kind]) => { const s = DO.store.S.sheets.find((x) => x.projectId === "p1" && x.number === n); return DO.store.S.reviews.find((v) => v.sheetId === s.id && v.state === "open" && (!kind || v.kind === kind))?.id; }, [n, kind]);

  console.log("owner"); await signIn("owner");
  await go("#/portfolio");
  for (let i = 0; i < 5; i++) await shot(`pf-metric-${i}`, `a.metric >> nth=${i}`);
  await shot("pf-table", "main table", { until: "main table tbody tr >> nth=5" });
  await page.click("a.metric >> nth=0"); await wait(900); await prep();
  await shot("pf-late", "main .card", { until: "main tbody tr >> nth=7" });

  console.log("lead"); await signIn("lead");
  await go("#/projects/p1/register");
  await shot("reg-table", "main table", { until: "main table tbody tr >> nth=9" });
  await page.fill("#reg-q", "OT duct"); await wait(700);
  await shot("reg-search", "#reg-q", { until: "main table tbody tr >> nth=-1", pad: 12, across: "main table" });
  await mark("q", "#reg-q"); await mark("m205", 'main tbody tr:has-text("M-205")');
  await shot("reg-row-m205", 'main tbody tr:has-text("M-205")');
  await go("#/projects/p1/import"); await page.click("[data-act=imp-sample]"); await wait(1200); await page.click("[data-act=imp-preview]"); await wait(900);
  await shot("imp-preview", "main .card >> nth=-1");
  await mark("bad", 'main tr[style*="danger"] >> nth=0'); await mark("bad3", 'main tr[style*="danger"] >> nth=2');
  await go("#/projects/p1/upload");
  const dir = path.join(DOCS, "sample-pdfs");
  await page.setInputFiles("#up-in", [path.join(dir, "M-206_C01.pdf"), path.join(dir, "scan_0042.pdf"), path.join(dir, "A104 ground floor rev.pdf")]); await wait(1500);
  await shot("up-results", "main .card >> nth=-1");
  await mark("scan", 'main tbody tr:has-text("scan_0042")');
  await page.click("[data-act=up-go]"); await wait(1500);
  await go("#/projects/p1/cad-sync");
  await shot("cad-proposed", 'main section.card:has-text("Proposed")');
  await mark("accept", "[data-act=cad-accept] >> nth=0");

  console.log("designer"); await signIn("designer");
  await go(`#/projects/p1/sheets/${await sheetId("M-205")}`, 2200);
  await shot("sheet-head", "main h2.display", { until: "[data-act=sd-more]", pad: 10 });
  await shot("rev-card", 'main section.card:has-text("Revisions")');
  await savePdf("drawing-m205-current", "main iframe.viewer-frame");
  await page.click("[data-act=sd-rev] >> nth=-1"); await wait(2200);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=sd-dl]")]);
  await dl.saveAs(path.join(OUT, "drawing-m205-superseded.pdf")); done.push("drawing-m205-superseded.pdf"); await toasts();
  await go(`#/projects/p1/sheets/${await sheetId("M-206")}`, 2000);
  await page.click("#sd-submit"); await wait(600);
  await shot("pc-empty", ".dialog");
  for (let i = 0; i < 4; i++) await mark("row" + i, `form[data-submit=pc-go] label:has(input[type=checkbox]) >> nth=${i}`);
  await mark("submit", ".dialog-foot .btn.primary");
  const n = await page.locator("form[data-submit=pc-go] input[type=checkbox]").count();
  for (let i = 0; i < n; i++) await page.locator("form[data-submit=pc-go] input[type=checkbox]").nth(i).check();
  await wait(300); await shot("pc-ticked", ".dialog");
  await page.click(".dialog-foot .btn.primary"); await wait(900);

  console.log("checker"); await signIn("checker");
  await go("#/reviews");
  await shot("rv-queue", "main table", { until: "main table tbody tr >> nth=6" });
  await mark("a107", 'main tbody tr:has-text("A-107")');
  await go(`#/reviews?open=${await reviewId("A-107")}`, 2200);
  await page.locator("#rq-approve-btn").scrollIntoViewIfNeeded(); await page.click("#rq-approve-btn"); await wait(900);

  console.log("senior"); await signIn("senior");
  await go(`#/reviews?open=${await reviewId("A-107", "senior_qc")}`, 2200);
  await page.locator("#rq-approve-btn").scrollIntoViewIfNeeded(); await page.click("#rq-approve-btn"); await wait(900);
  await go("#/"); await page.click("[data-act=notifications]"); await wait(600);
  await shot("notif-senior", "#notif-panel", { until: '#notif-panel a.notif >> nth=2' });

  console.log("dc"); await signIn("dc");
  await go("#/projects/p1/issue", 1000);
  await shot("ic-sheets", "main .card >> nth=0", { until: 'main .card >> nth=0 >> tbody tr >> nth=10' });
  await mark("a104", 'main tr:has-text("A-104")'); await mark("rename", "[data-act=sd-rename]"); await mark("all", "[data-act=ic-all]");
  await page.click("[data-act=sd-rename]"); await wait(500); await page.click("[data-act=ic-all]"); await wait(600);
  await page.selectOption("select[data-change=ic-purpose]", "GFC"); await wait(500);
  await page.click("[data-act=ic-preview]"); await wait(2500);
  await toasts(); await shot("ic-cover", 'iframe[title="Cover sheet preview"]');
  await savePdf("cover-sheet", 'iframe[title="Cover sheet preview"]');
  await page.click("[data-act=ic-issue]"); await wait(600); await page.click("#cf-ok"); await wait(1400); await toasts();
  await shot("ic-done", "main .card >> nth=-1");
  const tr = await page.evaluate(() => { const t = DO.store.S.transmittals[DO.store.S.transmittals.length - 1]; return { id: t.id, number: t.number }; });
  const tr32 = await page.evaluate(() => DO.store.S.transmittals.filter((t) => t.projectId === "p1").find((t) => t.number.endsWith("0032"))?.id);
  await go(`#/projects/p1/transmittals/${tr32}`);
  await shot("tr-bounced", 'main section.card:has-text("Recipients")');
  await mark("bounced", 'main section.card:has-text("Recipients") .pill.bad'); await mark("resend", 'main section.card:has-text("Recipients") tr:has(.pill.bad) [data-act=td-resend]');
  await page.click('main section.card:has-text("Recipients") tr:has(.pill.bad) [data-act=td-resend]'); await wait(700); await toasts();
  await shot("tr-resent", 'main section.card:has-text("Recipients")');

  console.log("client");
  await page.evaluate(() => { DO.auth.signOut(); DO.ui.state.mailFilter = ""; });
  const mid = await page.evaluate((num) => DO.store.S.emails.find((m) => m.kind === "transmittal" && m.subject.includes(num) && (m.toName || "").includes("Vikram"))?.id, tr.number);
  await go(`#/mailbox?m=${mid}`);
  await shot("mail-client", ".email-frame");
  await mark("open", ".email-frame a.btn.primary");
  await page.click(".email-frame a.btn.primary"); await wait(1200); await prep();
  await shot("ext-page", "main", { until: "main .card >> nth=0" });
  await mark("ack", "[data-act=ext-ack]"); await mark("zip", "[data-act=ext-zip]");
  await page.click("[data-act=ext-ack]"); await wait(800);
  await shot("ext-toast", ".toast");
  await toasts(); await shot("ext-acked", "main .card >> nth=0");
  const token = await page.evaluate(() => DO.store.project("p1").siteToken);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate((t) => { location.hash = `#/site/${t}`; }, token); await wait(1300); await prep();
  await page.screenshot({ path: path.join(OUT, "phone-site.png"), animations: "disabled", caret: "hide" }); done.push("phone-site");
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("dc bell"); await signIn("dc");
  await go("#/"); await page.click("[data-act=notifications]"); await wait(600);
  await shot("notif-dc", "#notif-panel", { until: '#notif-panel a.notif >> nth=1' });

  console.log("lead: approval, workload, site"); await signIn("lead");
  await go("#/projects/p5/stages");
  await page.click("[data-act=sp-approve]"); await wait(600);
  await page.setInputFiles("#ap-e", path.join(DOCS, "sample-client-approval-letter.pdf")); await wait(500);
  await page.click(".dialog-foot .btn.primary"); await wait(900);
  await go("#/workload");
  await shot("wl-table", "main table", { until: "main table tbody tr >> nth=9" });
  await shot("wl-row", 'main tbody tr:has-text("Rohan D")');
  await page.selectOption("select[data-change=wl-f][data-k=disc]", "E"); await wait(800);
  await shot("wl-elec", "main table", { until: "main table tbody tr >> nth=-1" });
  await mark("rohan", 'main tbody tr:has-text("Rohan D")');
  await go("#/projects/p4/construction/rfis");
  await shot("rfis", "main table", { until: "main table tbody tr >> nth=4" });

  console.log("admin"); await signIn("admin");
  await go("#/admin/integrations");
  await page.locator("input[data-change=ig-wh-on]").scrollIntoViewIfNeeded(); await page.check("input[data-change=ig-wh-on]"); await wait(500);
  await go("#/admin/intelligence");
  await shot("intel", "main .card >> nth=0", { until: "main .card >> nth=3", pad: 0 });
  await go("#/admin/audit");
  await shot("audit", "main table", { until: "main table tbody tr >> nth=5" });

  console.log("accounts"); await signIn("accounts");
  await go("#/billing");
  await shot("bill-table", "main table");
  await mark("mysuru", 'main tbody tr:has-text("Mysuru")');
  await page.click("[data-act=bl-push]"); await wait(900);
  await shot("bill-push", ".dialog");

  console.log("owner: reports, mailbox"); await signIn("owner");
  await go("#/reports?tab=baseline");
  await shot("rep-metrics", ".metrics");
  await shot("rep-chart", 'main section.card:has-text("Issued after planned date")');
  await page.evaluate(() => { DO.ui.state.mailFilter = ""; });
  await go("#/mailbox");
  await shot("mail-list", "main .mail-layout > div >> nth=0", { until: "main a.mail-item >> nth=7" });

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ captured: done, transmittal: tr.number, marks, errors }, null, 1));
  console.log(`captured ${done.length}, errors: ${errors.length}`, errors);
  await browser.close();
})();

/* Records the walkthrough: runs every scene in scenes/*.cjs against demo/demo.html and writes
   BUILD/frames/*.jpg, BUILD/timeline.json and BUILD/narration.json.
   Usage: node record.cjs [--only id,id] [--build DIR] [--scenes scenes/index.cjs]   (Playwright with the preinstalled Chromium) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { Recorder, VW, VH } = require("./lib/recorder.cjs");

const ROOT = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BUILD = path.resolve(opt("--build", process.env.WT_BUILD || path.join(__dirname, "../build")));
const ONLY = (opt("--only", "") || "").split(",").filter(Boolean);
const DEMO = require("url").pathToFileURL(path.join(ROOT, "demo/demo.html")).href;
const CHAPTERS = require(path.resolve(__dirname, opt("--scenes", "scenes/index.cjs")));

(async () => {
  fs.rmSync(path.join(BUILD, "frames"), { recursive: true, force: true });
  fs.mkdirSync(BUILD, { recursive: true });
  const browser = await chromium.launch({ channel: "chromium", args: ["--lang=en-IN"] }); // new headless: includes the built-in PDF viewer
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, locale: "en-IN", timezoneId: "Asia/Kolkata", acceptDownloads: true, colorScheme: "light" });
  // A working-day morning in IST, so clocks in the UI read like office hours; time then runs normally.
  await context.clock.install({ time: new Date("2026-10-29T10:05:00+05:30") });
  const page = await context.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  page.on("popup", (p) => p.close().catch(() => {}));
  await page.goto(DEMO);
  await page.clock.resume();
  await page.waitForSelector("#si-email, .creds");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); DO.store.reset(); DO.app.applyTheme("light"); });
  await page.reload();
  await page.waitForSelector("#si-email");

  const r = new Recorder({ page, outDir: BUILD });
  const data = { ROOT, DOCS: path.join(ROOT, "demo/assets/documents"), browser, DEMO };
  const narration = [];
  for (const ch of CHAPTERS) {
    if (ONLY.length && !ONLY.includes(ch.id)) continue;
    console.log(`== ${ch.num} ${ch.title}`);
    r.beginChapter(ch);
    for (let i = 0; i < ch.steps.length; i++) {
      const s = ch.steps[i];
      const id = `${ch.id}.${String(i + 1).padStart(2, "0")}`;
      r.beginStep(id, "", { minDur: s.minDur || 0, gap: s.gap ?? null, lead: s.lead ?? null });
      try {
        if (s.act) await s.act(r, data);
      } catch (e) {
        const msg = `${id}: ${e.message.split("\n")[0]}`;
        console.log("   ! " + msg);
        r.errors.push(msg);
        try { await r.frame("cut"); } catch (e2) { /* page gone */ }
      }
      const say = typeof s.say === "function" ? s.say(data) : s.say || "";
      r.step.say = say;
      narration.push({ id, chapter: ch.id, say });
      if (!r.step.events.some((e) => e.k === "shot")) console.log(`   (no new shot in ${id})`);
    }
    r.save();
  }
  r.save();
  fs.writeFileSync(path.join(BUILD, "narration.json"), JSON.stringify(narration, null, 1));
  console.log(`frames: ${r.n}, steps: ${narration.length}, recorder errors: ${r.errors.length}, page JS errors: ${jsErrors.length}`);
  if (jsErrors.length) console.log(jsErrors.slice(0, 8));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

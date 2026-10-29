/* Renders the composition frame by frame (each frame a pure function of time) with Playwright's Chromium.
   node work/render.cjs --stills 1.2,3.4      -> work/stills/t1.20.png ...
   node work/render.cjs --video OUT.mp4 [--poster T]  -> silent H.264, 1920x1080, 30 fps (frames piped to ffmpeg); writes work/events.json
   --poster T renders frame 0 as the settled frame at time T, so the poster is every platform's thumbnail (duration unchanged). */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

(async () => {
  const browser = await chromium.launch({ channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(require("url").pathToFileURL(path.join(__dirname, "comp/index.html")).href);
  await page.evaluate(() => window.READY);
  const ev = await page.evaluate(() => window.EVENTS);
  fs.writeFileSync(path.join(__dirname, "events.json"), JSON.stringify(ev, null, 1));
  const shot = async (t, type = "png") => { await page.evaluate((t) => window.renderAt(t), t); return page.screenshot({ type, quality: type === "jpeg" ? 95 : undefined, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); };

  if (opt("--stills")) {
    const dir = path.join(__dirname, "stills"); fs.mkdirSync(dir, { recursive: true });
    for (const t of opt("--stills").split(",").map(Number)) fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot(t));
    console.log("stills written", errors.length ? errors : "");
  }
  if (opt("--video")) {
    const fps = 30, n = Math.round(ev.duration * fps);
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", opt("--video")], { stdio: ["pipe", "inherit", "inherit"] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const buf = await shot(i === 0 && opt("--poster") ? Number(opt("--poster")) : i / fps, "jpeg");
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 150 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r));
    console.log(`video ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`, errors.length ? errors : "");
  }
  await browser.close();
})();

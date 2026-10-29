/* Recorder: drives the DrawingOps demo with Playwright and records a keyframe timeline.
   Nothing is timed here. Every action becomes an event (shot, move, click, cam, hl, pause, role)
   with element positions in CSS pixels of the 1440x810 viewport; compose.py turns events into
   frames, paced by the narration audio. */
const fs = require("fs");
const path = require("path");

const VW = 1440;
const VH = 810;
const PASSWORD = "Demo@2026"; // fictional prototype password; never shown on screen (the Demo Access panel is hidden)
const TOTP = "246810";

const ROLES = {
  owner: { email: "owner@firm.example", name: "Nikhil Prasad", role: "Owner / Principal" },
  lead: { email: "lead@firm.example", name: "Priya Sharma", role: "Project lead" },
  checker: { email: "checker@firm.example", name: "Anil Kapoor", role: "Discipline lead (Architecture)" },
  designer: { email: "designer@firm.example", name: "Rahul Kumar", role: "Designer (HVAC)" },
  senior: { email: "senior@firm.example", name: "Sunita Rao", role: "Senior reviewer" },
  dc: { email: "dc@firm.example", name: "Deepa Chandra", role: "Document controller" },
  accounts: { email: "accounts@firm.example", name: "Meera Thomas", role: "Accounts" },
  admin: { email: "admin@firm.example", name: "Asha Menon", role: "System admin" },
  client: { name: "Dr. Vikram Nair", role: "Client (no sign-in needed)" },
  site: { name: "Site team", role: "Phone, no sign-in needed" },
};

// Demo-only controls are hidden so the footage shows the product, not the prototype harness.
const HIDE_CSS = `
  .demo-fab { display: none !important; }
  .creds { display: none !important; }
  #si-code-h { display: none !important; }
  .auth-layout { grid-template-columns: minmax(0, 460px) !important; justify-content: center !important; }
`;

class Recorder {
  constructor({ page, outDir, log = console.log }) {
    this.page = page;
    this.out = outDir;
    this.framesDir = path.join(outDir, "frames");
    fs.mkdirSync(this.framesDir, { recursive: true });
    this.n = 0;
    this.chapters = [];
    this.chapter = null;
    this.step = null;
    this.role = null;
    this.camActive = false;
    this.log = log;
    this.errors = [];
  }

  // ---------- timeline structure ----------
  beginChapter(ch) {
    this.chapter = { id: ch.id, num: ch.num, title: ch.title, subtitle: ch.subtitle || "", steps: [] };
    this.chapters.push(this.chapter); // camActive carries over: the chapter card's zoomOut resets the camera
  }
  beginStep(id, say, opts = {}) {
    this.step = { id, say, events: [], ...opts };
    this.chapter.steps.push(this.step);
  }
  ev(e) { this.step.events.push(e); }
  save() {
    fs.writeFileSync(path.join(this.out, "timeline.json"), JSON.stringify({ viewport: [VW, VH], chapters: this.chapters, errors: this.errors }, null, 1));
  }

  // ---------- capture ----------
  async prep() {
    await this.page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
    await this.page.evaluate(() => document.querySelectorAll(".tip, [role=tooltip]").forEach((t) => t.remove())).catch(() => {});
  }
  async frame(trans = "fade", extra = {}) {
    await this.prep();
    const f = `f${String(++this.n).padStart(5, "0")}.jpg`;
    await this.page.screenshot({ path: path.join(this.framesDir, f), type: "jpeg", quality: 90, animations: "disabled", caret: "hide" });
    const url = extra.card ? "(card)" : await this.page.evaluate(() => decodeURIComponent(location.hash || "#/")).catch(() => "");
    this.ev({ k: "shot", f, trans, url, ...extra });
    return f;
  }
  async clearToasts() { await this.page.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove())).catch(() => {}); }
  async wait(ms) { await this.page.waitForTimeout(ms); }

  // ---------- geometry ----------
  loc(sel) { return typeof sel === "string" ? this.page.locator(sel).first() : sel; }
  async box(sel, timeout = 6000) {
    const l = this.loc(sel);
    await l.waitFor({ state: "visible", timeout });
    const b = await l.boundingBox();
    if (!b) throw new Error(`no box for ${sel}`);
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  async union(sels) {
    const bs = [];
    for (const s of sels) bs.push(await this.box(s));
    const x0 = Math.min(...bs.map((b) => b.x)); const y0 = Math.min(...bs.map((b) => b.y));
    const x1 = Math.max(...bs.map((b) => b.x + b.w)); const y1 = Math.max(...bs.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---------- camera, highlight, pacing ----------
  async zoom(sel, opts = {}) {
    const rect = opts.rect || (Array.isArray(sel) ? await this.union(sel) : await this.box(sel));
    this.ev({ k: "cam", rect, pad: opts.pad ?? 28, max: opts.max ?? 1.6, anchor: opts.anchor || null });
    this.camActive = true;
  }
  zoomOut() { if (this.camActive) this.ev({ k: "cam", rect: null }); this.camActive = false; }
  async hl(sel, opts = {}) {
    const rect = opts.rect || (Array.isArray(sel) ? await this.union(sel) : await this.box(sel));
    this.ev({ k: "hl", rect, pad: opts.pad ?? 6 });
  }
  hlOff() { this.ev({ k: "hloff" }); }
  pause(s) { this.ev({ k: "pause", s }); }
  lowerThird(title, sub) { this.ev({ k: "lt", title, sub }); }

  // ---------- scrolling ----------
  async scrollTo(y, steps = 10) {
    const y0 = await this.page.evaluate(() => window.scrollY);
    const maxY = await this.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const y1 = Math.max(0, Math.min(maxY, y));
    if (Math.abs(y1 - y0) < 4) return;
    this.zoomOut();
    for (let i = 1; i <= steps; i++) {
      const t = i / steps; const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.page.evaluate((v) => window.scrollTo(0, v), Math.round(y0 + (y1 - y0) * e));
      await this.wait(30);
      await this.frame("none", { dur: 0.055 });
    }
  }
  async scrollBy(dy, steps) { const y0 = await this.page.evaluate(() => window.scrollY); await this.scrollTo(y0 + dy, steps); }
  async scrollIntoView(sel, at = 0.38) {
    const b = await this.box(sel);
    if (b.y >= 64 && b.y + b.h <= VH - 24) return;
    const y0 = await this.page.evaluate(() => window.scrollY);
    await this.scrollTo(y0 + b.y - VH * at);
  }
  async scrollEl(sel, dy, steps = 8) {
    // Scroll an inner scroll container (e.g. a panel) instead of the window.
    const h = await this.page.locator(sel).first().elementHandle();
    const top0 = await h.evaluate((el) => el.scrollTop);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps; const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await h.evaluate((el, v) => { el.scrollTop = v; }, Math.round(top0 + dy * e));
      await this.wait(30);
      await this.frame("none", { dur: 0.055 });
    }
  }

  // ---------- pointer ----------
  async moveTo(sel, opts = {}) {
    if (opts.scroll !== false) await this.scrollIntoView(sel);
    const b = await this.box(sel);
    const x = b.x + (opts.fx ?? 0.5) * b.w + (opts.dx || 0);
    const y = b.y + (opts.fy ?? 0.5) * b.h + (opts.dy || 0);
    this.ev({ k: "move", x, y });
    return { x, y, b };
  }
  note(t) { this.ev({ k: "note", t }); }
  async click(sel, opts = {}) {
    this.note(`click ${typeof sel === "string" ? sel : "element"}`);
    const { x, y } = await this.moveTo(sel, opts);
    this.ev({ k: "click", x, y });
    await this.loc(sel).click({ timeout: 6000, ...(opts.clickOpts || {}) });
    await this.wait(opts.wait ?? 450);
    if (opts.clear) await this.clearToasts();
    if (opts.shot !== false) await this.frame(opts.trans || "cut");
  }
  async hover(sel, opts = {}) { await this.moveTo(sel, opts); }
  async type(sel, text, opts = {}) {
    this.note(`type "${text}"`);
    const { x, y } = await this.moveTo(sel, opts);
    this.ev({ k: "click", x, y });
    const l = this.loc(sel);
    await l.click({ timeout: 6000 });
    if (opts.clear !== false) await l.fill("");
    const chunk = opts.chunk || 2;
    for (let i = 0; i < text.length; i += chunk) {
      await l.type(text.slice(i, i + chunk), { delay: 0 });
      await this.wait(opts.settle ?? 40);
      await this.frame("none", { dur: 0.075 * Math.min(chunk, text.length - i) });
    }
    if (opts.after) await this.wait(opts.after);
    if (opts.shot) await this.frame("cut");
  }
  async select(sel, value, opts = {}) {
    this.note(`choose ${value || "(all)"} in ${sel}`);
    const { x, y } = await this.moveTo(sel, opts);
    this.ev({ k: "click", x, y });
    await this.loc(sel).selectOption(value);
    await this.wait(opts.wait ?? 500);
    if (opts.shot !== false) await this.frame("cut");
  }
  async check(sel, opts = {}) {
    const { x, y } = await this.moveTo(sel, opts);
    this.ev({ k: "click", x, y });
    await this.loc(sel).check({ timeout: 6000 });
    await this.wait(opts.wait ?? 250);
    if (opts.shot !== false) await this.frame("cut");
  }
  async files(sel, files, opts = {}) {
    this.note(`upload ${[].concat(files).map((f) => path.basename(f)).join(", ")}`);
    if (opts.pointAt) { const { x, y } = await this.moveTo(opts.pointAt); this.ev({ k: "click", x, y }); }
    await this.page.setInputFiles(sel, files);
    await this.wait(opts.wait ?? 900);
    if (opts.shot !== false) await this.frame("cut");
  }
  async key(k, opts = {}) {
    await this.page.keyboard.press(k);
    await this.wait(opts.wait ?? 400);
    if (opts.shot !== false) await this.frame(opts.trans || "cut");
  }

  // ---------- navigation and identity ----------
  async go(hash, opts = {}) {
    this.zoomOut();
    await this.clearToasts();
    await this.page.evaluate((h) => { document.querySelectorAll(".overlay,.drawer-wrap,#notif-panel,.menu").forEach((x) => x.remove()); location.hash = h; }, hash);
    await this.wait(opts.wait ?? 700);
    if (opts.top !== false) await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.clearToasts();
    if (opts.shot !== false) await this.frame(opts.trans || "fade");
  }
  async signInSilently(roleKey) {
    const r = ROLES[roleKey];
    await this.page.evaluate(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
    await this.page.waitForSelector("#si-email");
    await this.page.fill("#si-email", r.email);
    await this.page.fill("#si-pw", PASSWORD);
    await this.page.click("form[data-submit=signin] button.primary");
    if (roleKey === "admin") { await this.page.waitForSelector("#si-code"); await this.page.fill("#si-code", TOTP); await this.page.click("form[data-submit=signin-totp] button.primary"); }
    await this.page.waitForSelector(".shell", { timeout: 8000 });
    await this.clearToasts();
  }
  async as(roleKey, opts = {}) {
    if (!["client", "site"].includes(roleKey)) await this.signInSilently(roleKey);
    else await this.page.evaluate(() => DO.auth.signOut());
    this.role = roleKey;
    const r = ROLES[roleKey];
    if (opts.lt !== false) this.lowerThird(r.name, r.role);
  }

  // ---------- cards (rendered inside the demo page so they use its fonts, tokens and icons) ----------
  async card(spec, opts = {}) {
    this.zoomOut();
    const hasCards = await this.page.evaluate(() => typeof window.WT_CARD === "function");
    if (!hasCards) await this.page.addScriptTag({ path: path.join(__dirname, "cards.js") });
    await this.page.evaluate((s) => {
      document.getElementById("wt-card")?.remove();
      const d = document.createElement("div"); d.id = "wt-card"; d.innerHTML = window.WT_CARD(s); document.body.appendChild(d);
    }, spec);
    // Burned-in subtitles sit along the bottom of the frame: drop the card footer and keep card content above them.
    if (process.env.WT_SUBS_SAFE === "1") await this.page.evaluate(() => { document.querySelector("#wt-card .foot")?.remove(); const w = document.querySelector("#wt-card .wrap"); if (w) { w.style.paddingTop = "40px"; w.style.paddingBottom = "130px"; } });
    await this.page.evaluate(() => Promise.all([...document.querySelectorAll("#wt-card img")].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = r; i.onerror = r; })))));
    await this.wait(opts.wait ?? 250);
    await this.frame(opts.trans || "fade", { card: true });
    await this.page.evaluate(() => document.getElementById("wt-card")?.remove());
  }
  async eval(fn, arg) { return this.page.evaluate(fn, arg); }
}

module.exports = { Recorder, ROLES, VW, VH, PASSWORD, TOTP };

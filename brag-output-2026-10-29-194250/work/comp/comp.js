/* DrawingOps brag composition. Every frame is a pure function of time: window.renderAt(t) sets every style
   from t alone. Scene and word times come from timeline.js (built from the measured voiceover by prep.py);
   all UI is real 2x captures from the demo (../captures), positioned by marks measured at capture time. */
(function () {
  "use strict";
  const TL = window.TL;
  const stage = document.getElementById("stage");
  const SC = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
  const items = [], fx = [], cursorGroups = [], clicks = [];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const out3 = (p) => 1 - Math.pow(1 - p, 3);
  const out5 = (p) => 1 - Math.pow(1 - p, 5);
  const inout = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  const icon = (n, s = 18) => {
    const d = window.DO_ICONS[n]; if (!d) return "";
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("")}</svg>`;
  };
  const mk = (tag, cls, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (parent || stage).appendChild(e); return e; };
  const pos = (e, x, y, w, h) => { e.style.left = x + "px"; e.style.top = y + "px"; if (w != null) e.style.width = w + "px"; if (h != null) e.style.height = h + "px"; return e; };
  // Time of a spoken word in a scene (nth occurrence), from the voice timings.
  const wt = (sid, word, nth = 0) => { const hits = TL.words[sid].filter(([w]) => w === word); return (hits[nth] || hits[0] || [0, SC[sid].t0 + 0.5])[1]; };
  const rel = (sid, word, nth, d = 0) => wt(sid, word, nth) - SC[sid].t0 + d;

  // An element that enters, can recede when later content arrives, and exits at the end of its scene.
  function add(sid, e, o = {}) {
    const s = SC[sid];
    const it = {
      e, s, tin: s.t0 + (o.at ?? 0.12), dur: o.dur ?? 0.62,
      tout: o.until != null ? s.t0 + o.until : s.t1 - 0.34 + (o.outLag ?? 0), xd: o.exitDur ?? 0.28,
      from: Object.assign({ x: 0, y: 30, s: 0.97, blur: 8, rot: 0, rx: 0 }, o.from || {}),
      exit: Object.assign({ x: 0, y: -18, s: 0.985 }, o.exit || {}),
      rot: o.rot || 0, drift: o.drift ?? 0, phase: items.length * 1.37, zoom: o.zoom ?? 0,
      recede: (o.recede || []).map((r) => ({ t: s.t0 + r.t, s: r.s ?? 0.95, o: r.o ?? 0.5, y: r.y ?? -8, x: r.x ?? 0 })),
    };
    e.style.opacity = 0; e.style.visibility = "hidden"; items.push(it); return it;
  }
  function drawItem(it, t) {
    const e = it.e;
    if (t < it.tin - 1e-3 || t > it.tout + it.xd + 1e-3) { e.style.visibility = "hidden"; return; }
    e.style.visibility = "visible";
    const p = out3(clamp((t - it.tin) / it.dur)), q = inout(clamp((t - it.tout) / it.xd));
    let x = it.from.x * (1 - p) + it.exit.x * q, y = it.from.y * (1 - p) + it.exit.y * q;
    let s = (it.from.s + (1 - it.from.s) * p) * (1 + (it.exit.s - 1) * q), op = p * (1 - q), dim = 1;
    // Receding content stays opaque and dims, so stacked cards read as depth, never as a double exposure.
    for (const r of it.recede) { const k = inout(clamp((t - r.t) / 0.5)); s *= 1 - (1 - r.s) * k; dim *= 1 - (1 - r.o) * k; y += r.y * k; x += r.x * k; }
    if (it.drift) y += Math.sin((t - it.s.t0) * 1.15 + it.phase) * it.drift;
    if (it.zoom) s *= 1 + it.zoom * Math.max(0, t - it.tin);
    const blur = it.from.blur * (1 - p);
    e.style.opacity = op.toFixed(4);
    e.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotateX(${(it.from.rx * (1 - p)).toFixed(2)}deg) rotate(${(it.rot + it.from.rot * (1 - p)).toFixed(2)}deg) scale(${s.toFixed(4)})`;
    const f = (blur > 0.05 ? `blur(${blur.toFixed(2)}px) ` : "") + (dim < 0.999 ? `brightness(${dim.toFixed(3)})` : "");
    e.style.filter = f || "none";
  }

  // ---------- building blocks ----------
  function rail(sid, num, label, l1, l2, pills, o = {}) {
    const y0 = o.y ?? 318;
    add(sid, pos(mk("div", "abs eyebrow", `<span>${num}</span><span class="bar"></span><span>${label}</span>`), 120, y0), { at: 0.08, from: { y: 12, blur: 4 } });
    const t = pos(mk("div", "abs title"), 120, y0 + 42, 660);
    t.innerHTML = [l1, l2].filter(Boolean).map((line, i) => `<div class="line ${i ? "acc" : ""}">${line.split(" ").map((w) => `<span class="w" style="display:inline-block">${w}</span>`).join(" ")}</div>`).join("");
    [...t.querySelectorAll(".w")].forEach((w, i) => add(sid, w, { at: 0.14 + i * 0.05, dur: 0.6, from: { y: 28, blur: 12, s: 1 } }));
    if (pills && pills.length) add(sid, pos(mk("div", "abs pills", pills.map(([ic, txt]) => `<span class="pill">${icon(ic, 18)}${txt}</span>`).join("")), 120, y0 + 42 + (l2 ? 2 : 1) * 72 + 30, 640), { at: 0.5, from: { y: 16, blur: 4 } });
  }
  function card(sid, name, x, y, w, o = {}) {
    const [iw, ih] = TL.sizes[name]; const k = w / iw; const h = o.cropH ?? Math.round(ih * k);
    const pad = o.cls && o.cls.includes("phone") ? 12 : 0;
    const e = pos(mk("div", "abs card" + (o.cls ? " " + o.cls : "")), x, y, w + 2 * pad, h + 2 * pad);
    const img = mk("img", null, null, e); img.src = `../captures/${name}.png`; img.style.width = w + "px";
    if (o.cropY) img.style.marginTop = -Math.round(o.cropY * k) + "px";
    const it = add(sid, e, Object.assign({ from: { y: 44, s: 0.955, blur: 10, rx: 9 }, drift: 2.2 }, o));
    Object.assign(it, { k, name, x, y, w, h, cropY: (o.cropY || 0) * k, pad });
    return it;
  }
  // A capture-pixel rectangle, or a named mark, in the card's own coordinates (clamped inside the card).
  function box(c, m, pad = 6) {
    const r = typeof m === "string" ? TL.marks[c.name][m] : m;
    let x = r[0] * c.k - pad, y = r[1] * c.k - c.cropY - pad, w = r[2] * c.k + 2 * pad, h = r[3] * c.k + 2 * pad;
    x = Math.max(4, x); y = Math.max(4, y); w = Math.min(c.w - 8 - x, w); h = Math.min(c.h - 8 - y, h);
    return { x: x + c.pad, y: y + c.pad, w, h };
  }
  function ring(c, m, t0, t1, o = {}) {
    const b = box(c, m, o.pad ?? 6);
    const r = pos(mk("div", "ring" + (o.warn ? " warn" : ""), null, c.e), b.x, b.y, b.w, b.h);
    fx.push((t) => { const a = out3(clamp((t - t0) / 0.28)), z = 1 - clamp((t - t1) / 0.25); r.style.opacity = (a * z).toFixed(3); r.style.transform = `scale(${(1.08 - 0.08 * a).toFixed(4)})`; });
  }
  // Point on stage for a mark's centre (cursor targets); dx/dy nudge inside the element.
  function pt(c, m, dx = 0.5, dy = 0.5) {
    const r = typeof m === "string" ? TL.marks[c.name][m] : m;
    return { x: c.x + c.pad + (r[0] + r[2] * dx) * c.k, y: c.y + c.pad + (r[1] + r[3] * dy) * c.k - c.cropY };
  }
  // Reveal a band of another capture over a card (e.g. the ticked checklist row) at time t0.
  function swapBand(c, other, m, t0, full = false) {
    const r = typeof m === "string" ? TL.marks[c.name][m] : m;
    const y = full ? 0 : Math.round(r[1] * c.k) - 4, h = full ? c.h : Math.round(r[3] * c.k) + 8;
    const band = pos(mk("div", "band", null, c.e), 0, y, null, h);
    const img = mk("img", null, null, band); img.src = `../captures/${other}.png`; img.style.width = c.w + "px"; img.style.marginTop = -y + "px";
    fx.push((t) => { band.style.opacity = clamp((t - t0) / 0.12).toFixed(3); });
  }
  function tag(sid, text, x, y, o = {}) { return add(sid, pos(mk("div", "abs tag", text), x, y), Object.assign({ from: { y: 10, blur: 3 } }, o)); }
  function cursor(kfs) {
    cursorGroups.push(kfs);
    kfs.filter((k) => k.click).forEach((k) => { clicks.push(k.t); const rp = mk("div", "ripple"); fx.push((t) => { const a = clamp((t - k.t) / 0.55); const on = t >= k.t && a < 1; rp.style.display = on ? "block" : "none"; if (!on) return; const r = 8 + 30 * out3(a); Object.assign(rp.style, { left: k.x - r + "px", top: k.y - r + "px", width: 2 * r + "px", height: 2 * r + "px", opacity: (0.75 * (1 - a)).toFixed(3) }); }); });
  }

  // ---------- 01 Hook ----------
  (function () {
    const s = "s01", S = SC[s], q = TL.sent[s].map((c) => c[0] - S.t0);
    const lines = [["Which drawings are late", "?"], ["Who’s overloaded", "?"], ["Is site on the latest set", "?"]];
    lines.forEach(([txt, qm], i) => {
      const e = pos(mk("div", "abs q", `${txt}<span class="qm">${qm}</span>`), 120, 300 + i * 132);
      add(s, e, { at: q[i] - 0.06, dur: 0.55, from: { y: 34, blur: 14, s: 1 }, recede: i < 2 ? [{ t: q[i + 1] - 0.06, s: 1, o: 0.38, y: 0 }] : [] });
    });
    // Evidence for each question, from the product
    card(s, "pf-metric-0", 1210, 236, 420, { at: q[0] + 0.1, until: q[1] - 0.05, exitDur: 0.22, drift: 3 });
    const late = card(s, "pf-late", 990, 470, 830, { at: q[0] + 0.32, until: q[1] - 0.05, exitDur: 0.22, cropH: 210 });
    card(s, "pf-metric-3", 1210, 236, 420, { at: q[1] + 0.06, until: q[2] - 0.05, exitDur: 0.22, drift: 3 });
    const wl = card(s, "wl-elec", 990, 500, 830, { at: q[1] + 0.26, until: q[2] - 0.05, exitDur: 0.22 });
    ring(wl, "rohan", S.t0 + q[1] + 0.7, S.t0 + q[2] - 0.1, { warn: true, pad: 2 });
    card(s, "drawing-m205-superseded", 1000, 176, 780, { cls: "paper", at: q[2] + 0.04, rot: -2, from: { y: 60, s: 0.92, blur: 12, rx: 12, rot: 4 } });
    card(s, "rev-card", 1440, 600, 380, { at: q[2] + 0.42, rot: 1.5 });
    void late;
  })();

  // ---------- 02 Reveal ----------
  (function () {
    const s = "s02", S = SC[s];
    const lock = pos(mk("div", "abs lock", `<img src="logo.svg" alt=""><div class="word">DrawingOps</div>`), 0, 312, 1920); lock.style.justifyContent = "center";
    add(s, lock, { at: 0.15, dur: 0.8, from: { y: 0, s: 0.86, blur: 18 } });
    add(s, pos(mk("div", "abs tagline", "Drawing and deliverable control for architecture & MEP firms"), 0, 500, 1920), { at: 0.55, from: { y: 18, blur: 8 } });
    const feats = [["file-text", "Sheet register"], ["check-check", "Reviews"], ["send-horizontal", "Transmittals"], ["clock-alert", "Deadlines"], ["layout-grid", "Workload"], ["receipt-indian-rupee", "Fee stages"]];
    const row = pos(mk("div", "abs pills", feats.map(([i, t]) => `<span class="pill">${icon(i, 18)}${t}</span>`).join("")), 0, 590, 1920); row.style.justifyContent = "center";
    [...row.children].forEach((p, i) => { p.style.display = "inline-flex"; add(s, p, { at: 0.95 + i * 0.09, dur: 0.5, from: { y: 16, blur: 6 } }); });
    row.style.opacity = 1;
    add(s, pos(mk("div", "abs pills", `<span class="pill" style="border-color:rgba(125,186,238,.45)">${icon("layers", 18)}Works alongside AutoCAD and Revit</span>`), 0, 668, 1920), { at: 1.6, from: { y: 14, blur: 6 } }).e.style.justifyContent = "center";
    const bp = document.getElementById("blueprint");
    fx.push((t) => { const a = clamp((t - S.t0) / 0.9) * (1 - clamp((t - (S.t1 - 0.5)) / 0.5)); bp.style.opacity = (0.15 * a).toFixed(3); bp.style.transform = `scale(${(1.0 + 0.012 * (t - S.t0)).toFixed(4)})`; bp.style.display = a > 0 ? "block" : "none"; });
  })();

  // ---------- 03 Portfolio ----------
  (function () {
    const s = "s03", S = SC[s];
    rail(s, "01", "Portfolio", "The whole practice,", "on one page.", [["layout-dashboard", "Owner / Principal"]]);
    const m = [];
    for (let i = 0; i < 5; i++) m.push(card(s, `pf-metric-${i}`, 780 + i * 206, 182, 196, { at: 0.22 + i * 0.26, from: { y: 26, s: 0.9, blur: 8 }, drift: 0 }));
    card(s, "pf-table", 780, 310, 1020, { at: 0.95, recede: [{ t: 3.15 }] });
    card(s, "pf-late", 780, 418, 1020, { at: 3.15, cropH: 300, from: { y: 70, s: 0.96, blur: 10, rx: 6 } });
    const c0 = pt(m[0], [0, 0, 446, 212]);
    cursor([{ t: S.t0 + 2.15, x: 1640, y: 760 }, { t: S.t0 + 2.85, x: c0.x + 20, y: c0.y + 6 }, { t: S.t0 + 3.0, x: c0.x + 20, y: c0.y + 6, click: true }, { t: S.t0 + 3.6, x: c0.x + 40, y: c0.y + 260 }]);
    ring(m[0], [0, 0, 446, 212], S.t0 + 3.0, S.t1 - 0.3, { pad: -2 });
  })();

  // ---------- 04 Register ----------
  (function () {
    const s = "s04", S = SC[s];
    rail(s, "02", "Register", "Every sheet,", "from day one.", [["folder-kanban", "Project lead"]]);
    card(s, "reg-table", 780, 176, 1020, { at: 0.1, recede: [{ t: 1.15 }] });
    const sr = card(s, "reg-search", 780, 470, 1020, { at: 1.15, from: { y: 50, s: 0.96, blur: 10, rx: 6 } });
    ring(sr, "q", S.t0 + 1.45, S.t0 + 2.0, { pad: 2 });
    ring(sr, "m205", S.t0 + 1.95, S.t1 - 0.3, { pad: 0 });
    card(s, "sheet-head", 930, 712, 840, { at: 2.35, from: { y: 30, s: 0.95, blur: 8 } });
  })();

  // ---------- 05 Drawings in ----------
  (function () {
    const s = "s05", S = SC[s];
    rail(s, "03", "Drawings in", "Excel, PDFs, CAD.", "Checked on entry.", [["file-spreadsheet", "Excel import"], ["file-text", "PDF matching"], ["layers", "Revit · AutoCAD"]]);
    const t1 = rel(s, "import"), t2 = rel(s, "drop", 0, -0.1), t3 = rel(s, "sync", 0, -0.1);
    const imp = card(s, "imp-preview", 790, 168, 900, { at: t1, recede: [{ t: t2 }] });
    ring(imp, [0, 619, 2316, 270], S.t0 + t1 + 0.7, S.t0 + t2 + 0.1, { warn: true, pad: 0 });
    const up = card(s, "up-results", 850, 392, 900, { at: t2, recede: [{ t: t3 }] });
    ring(up, "scan", S.t0 + t2 + 0.55, S.t0 + t3 + 0.2, { pad: 0 });
    const cad = card(s, "cad-proposed", 1120, 590, 660, { at: t3 });
    tag(s, "Revit · AutoCAD sync — simulated in this demo", 1120, 548, { at: t3 + 0.25 });
    const a = pt(cad, "accept");
    cursor([{ t: S.t0 + t3 + 0.5, x: 1700, y: 900 }, { t: S.t0 + t3 + 1.15, x: a.x, y: a.y }, { t: S.t0 + t3 + 1.3, x: a.x, y: a.y, click: true }, { t: S.t0 + t3 + 1.9, x: a.x + 30, y: a.y + 40 }]);
    ring(cad, "accept", S.t0 + t3 + 1.3, S.t1 - 0.3, { pad: 3 });
  })();

  // ---------- 06 Checking ----------
  (function () {
    const s = "s06", S = SC[s];
    rail(s, "04", "Checking", "Checked before", "it leaves.", [["pen-tool", "Designer"], ["list-checks", "Discipline lead"], ["badge-check", "Senior reviewer"]]);
    const tl = rel(s, "leads", 0, -0.1), ts = rel(s, "senior", 0, -0.1);
    const pc = card(s, "pc-empty", 840, 150, 660, { at: 0.1, recede: [{ t: tl, s: 0.93, o: 0.4, y: -20 }] });
    const ticks = [0.7, 0.98, 1.26, 1.54];
    const kf = [{ t: S.t0 + 0.45, x: 1600, y: 700 }];
    ticks.forEach((tt, i) => {
      swapBand(pc, "pc-ticked", "row" + i, S.t0 + tt + 0.04);
      const p = pt(pc, "row" + i, 0, 0.5); kf.push({ t: S.t0 + tt - 0.12, x: p.x + 20, y: p.y }, { t: S.t0 + tt, x: p.x + 20, y: p.y, click: true });
    });
    const sb = pt(pc, "submit"); kf.push({ t: S.t0 + 1.95, x: sb.x, y: sb.y }, { t: S.t0 + 2.08, x: sb.x, y: sb.y, click: true }, { t: S.t0 + 2.6, x: sb.x + 40, y: sb.y + 120 });
    cursor(kf);
    ring(pc, "submit", S.t0 + 2.08, S.t0 + tl + 0.2, { pad: 3 });
    const rq = card(s, "rv-queue", 790, 430, 980, { at: tl, recede: [{ t: ts, s: 0.97, o: 0.75, y: 0 }] });
    ring(rq, "a107", S.t0 + tl + 0.5, S.t1 - 0.3, { pad: 0 });
    card(s, "notif-senior", 1360, 268, 440, { at: ts, cropH: 296, from: { y: 40, x: 30, s: 0.95, blur: 10 } });
  })();

  // ---------- 07 Issue ----------
  (function () {
    const s = "s07", S = SC[s];
    rail(s, "05", "Issue", "One click.", "Issued, superseded.", [["send-horizontal", "Document controller"]]);
    const tn = rel(s, "numbered", 0, -0.15), tsup = rel(s, "supersedes", 0, -0.15);
    const ic = card(s, "ic-sheets", 790, 166, 1000, { at: 0.1, recede: [{ t: tn, s: 0.94, o: 0.4, y: -16 }] });
    ring(ic, "a104", S.t0 + 0.45, S.t0 + 1.05, { warn: true, pad: 0 });
    const r = pt(ic, "rename");
    cursor([{ t: S.t0 + 0.4, x: 1500, y: 760 }, { t: S.t0 + 0.95, x: r.x, y: r.y }, { t: S.t0 + 1.08, x: r.x, y: r.y, click: true }, { t: S.t0 + 1.6, x: r.x - 60, y: r.y + 200 }]);
    ring(ic, "rename", S.t0 + 1.08, S.t0 + tn, { pad: 3 });
    card(s, "cover-sheet", 1440, 232, 340, { cls: "paper", at: tn, rot: 3, from: { y: 70, x: 40, s: 0.92, blur: 12, rot: 6, rx: 10 } });
    card(s, "ic-done", 800, 560, 900, { at: tsup, from: { y: 40, s: 0.94, blur: 10 } });
  })();

  // ---------- 08 Client and site ----------
  (function () {
    const s = "s08", S = SC[s];
    rail(s, "06", "Client & site", "No login.", "Just the current set.", [["users", "Clients · no account"], ["hard-hat", "Site team"]]);
    const tsite = rel(s, "site", 0, -0.1);
    const mail = card(s, "mail-client", 790, 160, 580, { at: 0.1, recede: [{ t: 1.15 }] });
    const o = pt(mail, "open");
    const ext = card(s, "ext-page", 850, 452, 680, { at: 1.15 });
    const a = pt(ext, "ack");
    cursor([{ t: S.t0 + 0.4, x: 1400, y: 820 }, { t: S.t0 + 0.85, x: o.x, y: o.y }, { t: S.t0 + 0.98, x: o.x, y: o.y, click: true }, { t: S.t0 + 1.75, x: a.x, y: a.y }, { t: S.t0 + 1.9, x: a.x, y: a.y, click: true }, { t: S.t0 + 2.5, x: a.x + 30, y: a.y + 90 }]);
    ring(ext, "ack", S.t0 + 1.9, S.t1 - 0.3, { pad: 3 });
    card(s, "ext-toast", 1080, 750, 390, { at: 2.1, from: { y: 24, s: 0.95, blur: 6 } });
    card(s, "phone-site", 1560, 168, 236, { cls: "phone", at: tsite, from: { y: 80, x: 40, s: 0.94, blur: 12, rx: 8 }, drift: 3 });
  })();

  // ---------- 09 Hand-offs and email ----------
  (function () {
    const s = "s09", S = SC[s];
    rail(s, "07", "Hand-offs", "Every hand-off,", "in the right inbox.", [["bell", "In the app"], ["mail", "By email"]]);
    const tn = rel(s, "notifies", 0, -0.15), te = rel(s, "every", 1, -0.1);
    card(s, "mail-list", 790, 160, 340, { at: 0.1, cropH: 600 });
    tag(s, "Demo mailbox — nothing is sent", 790, 780, { at: 0.5 });
    card(s, "notif-dc", 1160, 160, 560, { at: tn });
    const tb = card(s, "tr-bounced", 1160, 520, 640, { at: te, from: { y: 40, s: 0.95, blur: 10 } });
    ring(tb, "bounced", S.t0 + te + 0.4, S.t0 + te + 1.3, { warn: true, pad: 4 });
    const rs = pt(tb, "resend");
    cursor([{ t: S.t0 + te + 0.4, x: 1500, y: 900 }, { t: S.t0 + te + 1.05, x: rs.x, y: rs.y }, { t: S.t0 + te + 1.2, x: rs.x, y: rs.y, click: true }, { t: S.t0 + te + 1.8, x: rs.x - 40, y: rs.y + 110 }]);
    swapBand(tb, "tr-resent", null, S.t0 + te + 1.25, true);
  })();

  // ---------- 10 Billing ----------
  (function () {
    const s = "s10", S = SC[s];
    rail(s, "08", "Billing", "Issued and approved?", "Ready to invoice.", [["receipt-indian-rupee", "Accounts"]]);
    const tr = rel(s, "ready", 0, -0.25);
    const bt = card(s, "bill-table", 790, 196, 1000, { at: 0.1, recede: [{ t: tr, s: 0.97, o: 0.6, y: 0 }] });
    ring(bt, "mysuru", S.t0 + rel(s, "signal", 0, 0), S.t1 - 0.3, { pad: 0 });
    tag(s, "Accounting push — simulated in this demo", 1330, 398, { at: tr + 0.2 });
    card(s, "bill-push", 1330, 440, 440, { at: tr, cropH: 352, from: { y: 50, x: 30, s: 0.95, blur: 10 } });
  })();

  // ---------- 11 Everything else ----------
  (function () {
    const s = "s11", S = SC[s];
    add(s, pos(mk("div", "abs eyebrow", `<span>09</span><span class="bar"></span><span>And everything around it</span>`), 120, 146), { at: 0.08, from: { y: 12, blur: 4 } });
    const ti = pos(mk("div", "abs title", `<div class="line acc">${"Run the whole practice.".split(" ").map((w) => `<span class="w" style="display:inline-block">${w}</span>`).join(" ")}</div>`), 120, 178, 1200);
    ti.style.fontSize = "58px"; [...ti.querySelectorAll(".w")].forEach((w, i) => add(s, w, { at: 0.12 + i * 0.05, from: { y: 24, blur: 10, s: 1 } }));
    const tiles = [
      { lbl: "Workload", x: 120, y: 262, w: 830, h: 300, at: rel(s, "workload", 0, -0.15), cards: [["wl-table", 24, 58, 782, { cropH: 150 }], ["wl-elec", 24, 196, 782, { cropY: 180 }]] },
      { lbl: "Site · RFIs", x: 970, y: 262, w: 830, h: 300, at: rel(s, "site", 0, -0.15), cards: [["rfis", 24, 58, 782, { cropH: 222 }]] },
      { lbl: "Reports", x: 120, y: 582, w: 540, h: 300, at: rel(s, "reports", 0, -0.15), cards: [["rep-chart", 24, 58, 492, { cropH: 222 }]] },
      { lbl: "Forecasts · advisory", x: 680, y: 582, w: 560, h: 300, at: rel(s, "advisory", 0, -0.15), cards: [["intel", 24, 58, 512, { cropH: 222 }]] },
      { lbl: "Audit trail", x: 1260, y: 582, w: 540, h: 300, at: rel(s, "audit", 0, -0.15), cards: [["audit", 24, 58, 492, { cropH: 222 }]] },
    ];
    tiles.forEach((T, i) => {
      const tile = pos(mk("div", "abs tile", `<div class="lbl">${T.lbl}</div>`), T.x, T.y, T.w, T.h);
      T.cards.forEach(([n, x, y, w, o]) => {
        const [iw, ih] = TL.sizes[n]; const k = w / iw; const h = o.cropH ?? Math.round((ih - (o.cropY || 0)) * k);
        const c = pos(mk("div", "card", null, tile), x, y, w, h); c.style.position = "absolute";
        const img = mk("img", null, null, c); img.src = `../captures/${n}.png`; img.style.width = w + "px"; if (o.cropY) img.style.marginTop = -Math.round(o.cropY * k) + "px";
      });
      add(s, tile, { at: T.at, dur: 0.55, from: { y: 40, s: 0.94, blur: 10, rx: 8 }, outLag: i * 0.02 });
    });
    tag(s, "Simulated figures", 1062, 596, { at: rel(s, "advisory", 0, 0.25), outLag: 0.06 });
  })();

  // ---------- 12 Outro ----------
  (function () {
    const s = "s12", S = SC[s], tb = TL.sent[s][1][0] - S.t0 - 0.2, keep = S.t1 - S.t0 + 5;
    const head = pos(mk("div", "abs title", "Eight roles. <span style=\"color:#7DBAEE\">One live record.</span>"), 0, 268, 1920); head.style.textAlign = "center"; head.style.fontSize = "60px";
    add(s, head, { at: 0.08, until: tb, exitDur: 0.3, from: { y: 24, blur: 10, s: 1 } });
    const roles = [["layout-dashboard", "Owner"], ["folder-kanban", "Project lead"], ["list-checks", "Discipline lead"], ["pen-tool", "Designer"], ["badge-check", "Senior reviewer"], ["send-horizontal", "Document controller"], ["receipt-indian-rupee", "Accounts"], ["settings", "Admin"]];
    [roles.slice(0, 4), roles.slice(4)].forEach((row, r) => {
      const el = pos(mk("div", "abs pills", row.map(([i, t]) => `<span class="pill" style="font-size:22px;padding:13px 22px">${icon(i, 21)}${t}</span>`).join("")), 0, 400 + r * 78, 1920); el.style.justifyContent = "center"; el.style.opacity = 1;
      [...el.children].forEach((p, i) => add(s, p, { at: 0.25 + (r * 4 + i) * 0.11, dur: 0.5, until: tb, exitDur: 0.3, from: { y: 18, blur: 6, s: 0.92 }, exit: { y: -10, s: 0.9 } }));
    });
    const lock = pos(mk("div", "abs lock", `<img src="logo.svg" alt=""><div class="word">DrawingOps</div>`), 0, 300, 1920); lock.style.justifyContent = "center";
    add(s, lock, { at: tb + 0.15, dur: 0.85, until: keep, from: { y: 0, s: 0.88, blur: 18 } });
    add(s, pos(mk("div", "abs tagline", "Every sheet. Every revision. Every deadline."), 0, 486, 1920), { at: tb + 0.55, until: keep, from: { y: 16, blur: 8 } });
    const by = pos(mk("div", "abs pills", `<span class="pill" style="font-size:21px">${icon("sparkles", 19)}Built by LatentIQ</span>`), 0, 566, 1920); by.style.justifyContent = "center";
    add(s, by, { at: tb + 0.85, until: keep, from: { y: 14, blur: 6 } });
    const ft = pos(mk("div", "abs foot", "Interactive prototype · fictional data · integrations simulated"), 0, 668, 1920); ft.style.textAlign = "center";
    add(s, ft, { at: tb + 1.1, until: keep, from: { y: 8, blur: 4 } });
  })();

  // ---------- chrome: brand mark, progress, cursor, subtitles, background motion ----------
  const first = SC.s03, last = SC.s11;
  const brand = pos(mk("div", "abs", `<span id="brand"><img src="logo.svg" alt="">DrawingOps</span>`), 120, 60);
  fx.push((t) => { const a = clamp((t - first.t0 - 0.2) / 0.5) * (1 - clamp((t - last.t1 + 0.3) / 0.3)); brand.style.opacity = a.toFixed(3); });
  const prog = document.getElementById("prog");
  fx.push((t) => { const a = clamp((t - first.t0) / (last.t1 - first.t0)); const v = (t > first.t0 && t < last.t1 + 0.3) ? 1 : 0; prog.style.width = (1920 * a).toFixed(1) + "px"; prog.style.opacity = (v * (1 - clamp((t - last.t1) / 0.3))).toFixed(3); });

  const cur = mk("div", "abs", `<svg width="34" height="34" viewBox="0 0 34 34"><path d="M5 3 L5 27 L11.2 21.2 L15.4 30.6 L19.6 28.8 L15.4 19.6 L23.6 19.6 Z" fill="#fff" stroke="#0B1220" stroke-width="1.8" stroke-linejoin="round"/></svg>`); cur.id = "cursor";
  fx.push((t) => {
    const g = cursorGroups.find((k) => t >= k[0].t - 0.3 && t <= k[k.length - 1].t + 0.45);
    if (!g) { cur.style.opacity = 0; return; }
    let x = g[0].x, y = g[0].y;
    for (let i = 0; i < g.length - 1; i++) { const a = g[i], b = g[i + 1]; if (t >= a.t && t <= b.t) { const p = inout((t - a.t) / Math.max(1e-3, b.t - a.t)); x = a.x + (b.x - a.x) * p; y = a.y + (b.y - a.y) * p; } }
    if (t > g[g.length - 1].t) { x = g[g.length - 1].x; y = g[g.length - 1].y; }
    const fin = clamp((t - (g[0].t - 0.3)) / 0.3), fo = 1 - clamp((t - g[g.length - 1].t) / 0.45);
    const press = g.filter((k) => k.click).some((k) => t >= k.t - 0.04 && t <= k.t + 0.12) ? 0.84 : 1;
    cur.style.opacity = (fin * fo).toFixed(3); cur.style.transform = `translate3d(${(x - 6).toFixed(1)}px,${(y - 4).toFixed(1)}px,0) scale(${press})`;
  });

  const subWrap = document.getElementById("subs"), sub = subWrap.querySelector(".sub");
  fx.push((t) => {
    const c = TL.cues.find((q) => t >= q[0] && t <= q[1] + 0.05);
    if (!c) { subWrap.style.opacity = 0; return; }
    if (sub.textContent !== c[2]) sub.textContent = c[2];
    subWrap.style.opacity = (clamp((t - c[0]) / 0.12) * (1 - clamp((t - c[1]) / 0.05))).toFixed(3);
  });

  const g1 = document.getElementById("g1"), g2 = document.getElementById("g2"), grid = document.getElementById("grid");
  fx.push((t) => {
    g1.style.transform = `translate3d(${(980 + 140 * Math.sin(t * 0.16)).toFixed(1)}px,${(-220 + 90 * Math.cos(t * 0.12)).toFixed(1)}px,0)`;
    g2.style.transform = `translate3d(${(-160 + 120 * Math.cos(t * 0.11)).toFixed(1)}px,${(560 + 70 * Math.sin(t * 0.14)).toFixed(1)}px,0)`;
    grid.style.transform = `translate3d(${(-(t * 6) % 120).toFixed(2)}px,${(-(t * 3) % 120).toFixed(2)}px,0)`;
  });

  window.renderAt = (t) => { for (const it of items) drawItem(it, t); for (const f of fx) f(t); };
  window.EVENTS = { cuts: TL.scenes.map((s) => s.t0), clicks: clicks.slice().sort((a, b) => a - b), duration: TL.duration };
  window.READY = Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = () => i.decode().then(r, r); i.onerror = r; })))]);
  window.renderAt(0);
})();

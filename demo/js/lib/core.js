/* DrawingOps demo · core helpers: safe HTML templates, icons, formats (N-08) and calendar maths. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});

  // ---------- Safe HTML ----------
  class Safe { constructor(s) { this.__html = s; } toString() { return this.__html; } }
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
  function val(v) {
    if (v === null || v === undefined || v === false || v === true) return "";
    if (v instanceof Safe) return v.__html;
    if (Array.isArray(v)) return v.map(val).join("");
    return esc(v);
  }
  /** Tagged template: interpolations are escaped unless they are Safe (html`` or raw()). */
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += val(values[i]) + strings[i + 1];
    return new Safe(out);
  }
  const raw = (s) => new Safe(String(s ?? ""));
  const attrs = (o) => raw(Object.entries(o).filter(([, v]) => v !== false && v !== null && v !== undefined).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(" "));
  Object.assign(DO, { html, raw, esc, attrs, Safe });

  // ---------- Icons (Lucide) ----------
  function icon(name, size = 16, cls = "") {
    const node = (root.DO_ICONS || {})[name];
    if (!node) return raw("");
    const inner = node.map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
    return raw(`<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`);
  }
  DO.icon = icon;

  // ---------- Dates (date-only strings are YYYY-MM-DD and never timezone-shifted) ----------
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate()); const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => DO.dateOf(new Date());
  const nowISO = () => new Date().toISOString();
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const weekday = (s) => parse(s).getDay();
  const mondayOf = (s) => { const wd = (weekday(s) + 6) % 7; return addDays(s, -wd); };
  function isoWeek(s) {
    const d = parse(s); const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const w1 = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  }
  // Times show in IST (N-08); date-only strings are shown as written.
  const TZ = "Asia/Kolkata";
  const zfmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const zparts = (d) => Object.fromEntries(zfmt.formatToParts(d).map((p) => [p.type, p.value]));
  function fmtDate(v) {
    if (!v) return "";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split("-"); return `${d}-${MONTHS[+m - 1]}-${y}`; }
    const d = new Date(v); if (isNaN(d)) return "";
    const p = zparts(d); return `${pad(p.day)}-${MONTHS[+p.month - 1]}-${p.year}`;
  }
  const fmtShort = (v) => fmtDate(v).slice(0, 6);
  function fmtTime(v) { const d = new Date(v); if (isNaN(d)) return ""; const p = zparts(d); return `${p.hour}:${p.minute}`; }
  const fmtDateTime = (v) => (v ? `${fmtDate(v)} ${fmtTime(v)}` : "");
  /** ISO date (YYYY-MM-DD) of an instant, in IST. */
  const dateOf = (v) => { const p = zparts(new Date(v)); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
  function fmtRel(v) {
    if (!v) return "";
    const ms = Date.now() - new Date(v).getTime();
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return "yesterday";
    if (d < 7) return `${d} days ago`;
    return fmtDate(v);
  }
  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const grouped = new Intl.NumberFormat("en-IN");
  const fmtINR = (n) => (n === null || n === undefined || n === "" || !isFinite(+n) ? "" : inr.format(Math.round(+n)));
  const fmtNum = (n) => grouped.format(n);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  /** Lakh/crore shorthand for dashboards: ₹38.4 L, ₹1.2 Cr. */
  const fmtINRShort = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : fmtINR(n));
  Object.assign(DO, { dateOf, MONTHS, DAYS, iso, parse, addDays, today, nowISO, diffDays, weekday, mondayOf, isoWeek, fmtDate, fmtShort, fmtTime, fmtDateTime, fmtRel, fmtINR, fmtINRShort, fmtNum, plural, pad });

  // ---------- Working calendar (F-42): working days honour the org's week and holidays ----------
  let cal = { workdays: [1, 2, 3, 4, 5], holidays: new Set() };
  DO.setCalendar = (workdays, holidays) => { cal = { workdays, holidays: new Set(holidays) }; };
  const isWorkingDay = (s) => cal.workdays.includes(weekday(s)) && !cal.holidays.has(s);
  /** Working days from a (exclusive) to b (inclusive); negative when b is before a. */
  function workingDaysBetween(a, b) {
    if (a === b) return 0;
    const sign = a < b ? 1 : -1; let n = 0; let d = a;
    while (d !== b) { d = addDays(d, sign); if (isWorkingDay(d)) n += sign; }
    return n;
  }
  function addWorkingDays(s, n) {
    let d = s; const step = n >= 0 ? 1 : -1; let left = Math.abs(n);
    while (left > 0) { d = addDays(d, step); if (isWorkingDay(d)) left--; }
    return d;
  }
  Object.assign(DO, { isWorkingDay, workingDaysBetween, addWorkingDays });

  // ---------- Misc ----------
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  let counter = 0;
  const uid = (p = "id") => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  /** "Priya S" (DESIGN.md §7: first name + last initial in tables). */
  const short = (name) => { const p = String(name || "").split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}` : p[0] || ""; };
  const by = (k, dir = 1) => (a, b) => { const x = typeof k === "function" ? k(a) : a[k]; const y = typeof k === "function" ? k(b) : b[k]; return (x > y ? 1 : x < y ? -1 : 0) * dir; };
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fileSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
  function download(data, filename, type = "application/octet-stream") {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function csv(rows) {
    const cell = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  }
  function parseCSV(text) {
    const rows = []; let row = []; let f = ""; let q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }
  Object.assign(DO, { rng, hash, uid, debounce, initials, short, by, groupBy, sum, clamp, fileSize, download, csv, parseCSV });
})(typeof window !== "undefined" ? window : globalThis);

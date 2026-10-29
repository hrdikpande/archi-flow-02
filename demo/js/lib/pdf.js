/* DrawingOps demo · a small PDF 1.4 writer (vector only, base-14 fonts). Runs in the browser and in
   Node, so the static sample documents and the live downloads come from the same code. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});

  // Helvetica advance widths for ASCII 32..126 (Adobe AFM), in 1/1000 em.
  const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const MAP = { "–": "\x96", "—": "\x97", "‘": "\x91", "’": "\x92", "“": "\x93", "”": "\x94", "•": "\x95", "·": "\xb7", "×": "\xd7", "₹": "Rs ", "…": "\x85", "→": "->", "←": "<-", "✓": "v", "≤": "<=", "≥": ">=", "±": "\xb1", "°": "\xb0" };
  const clean = (s) => String(s ?? "").replace(/[^\x20-\x7e\xa0-\xff]/g, (c) => MAP[c] ?? "?");
  const escText = (s) => clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  function width(str, size, font = "F1") {
    const s = clean(str);
    if (font === "F3") return s.length * 0.6 * size;
    let w = 0;
    for (const ch of s) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? HELV[c - 32] : 556; }
    return (w / 1000) * size * (font === "F2" ? 1.06 : 1);
  }
  const n = (v) => (Math.round(v * 100) / 100).toString();
  const rgb = (c) => (Array.isArray(c) ? c : hex(c || "#000000"));
  function hex(h) { const m = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255); }

  class Page {
    constructor(w, h) { this.w = w; this.h = h; this.ops = []; this.alpha = false; }
    Y(y) { return this.h - y; }
    style(o = {}) {
      const s = [];
      if (o.color || o.stroke) s.push(`${rgb(o.stroke || o.color).map(n).join(" ")} RG`);
      if (o.fill) s.push(`${rgb(o.fill).map(n).join(" ")} rg`);
      s.push(`${n(o.w ?? 0.6)} w`);
      s.push(o.dash ? `[${o.dash.map(n).join(" ")}] 0 d` : "[] 0 d");
      if (o.opacity !== undefined) { this.alpha = true; s.push("/GS1 gs"); }
      return s.join(" ");
    }
    paint(o) { return o.fill && (o.stroke || o.color) ? "B" : o.fill ? "f" : "S"; }
    line(x1, y1, x2, y2, o = {}) { this.ops.push(`q ${this.style(o)} ${n(x1)} ${n(this.Y(y1))} m ${n(x2)} ${n(this.Y(y2))} l S Q`); return this; }
    poly(pts, o = {}) {
      if (pts.length < 2) return this;
      const path = pts.map(([x, y], i) => `${n(x)} ${n(this.Y(y))} ${i ? "l" : "m"}`).join(" ");
      this.ops.push(`q ${this.style(o)} ${path} ${o.close ? "h " : ""}${this.paint(o)} Q`); return this;
    }
    rect(x, y, w, h, o = {}) { this.ops.push(`q ${this.style(o)} ${n(x)} ${n(this.Y(y + h))} ${n(w)} ${n(h)} re ${this.paint(o)} Q`); return this; }
    circle(cx, cy, r, o = {}) {
      const k = 0.5523 * r; const Y = this.Y(cy);
      this.ops.push(`q ${this.style(o)} ${n(cx + r)} ${n(Y)} m ${n(cx + r)} ${n(Y + k)} ${n(cx + k)} ${n(Y + r)} ${n(cx)} ${n(Y + r)} c ${n(cx - k)} ${n(Y + r)} ${n(cx - r)} ${n(Y + k)} ${n(cx - r)} ${n(Y)} c ${n(cx - r)} ${n(Y - k)} ${n(cx - k)} ${n(Y - r)} ${n(cx)} ${n(Y - r)} c ${n(cx + k)} ${n(Y - r)} ${n(cx + r)} ${n(Y - k)} ${n(cx + r)} ${n(Y)} c ${this.paint(o)} Q`);
      return this;
    }
    /** Quarter arc (door swing) from angle a0 to a1 in degrees, centre (cx, cy). */
    arc(cx, cy, r, a0, a1, o = {}) {
      const pts = []; const steps = 10;
      for (let i = 0; i <= steps; i++) { const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
      return this.poly(pts, o);
    }
    text(x, y, str, o = {}) {
      const size = o.size || 10; const font = o.font || "F1";
      let tx = x;
      if (o.align === "center") tx = x - width(str, size, font) / 2;
      else if (o.align === "right") tx = x - width(str, size, font);
      const col = rgb(o.color || "#000000").map(n).join(" ");
      const gs = o.opacity !== undefined ? ((this.alpha = true), "/GS1 gs ") : "";
      if (o.angle) {
        const a = (o.angle * Math.PI) / 180; const c = Math.cos(a); const s = Math.sin(a);
        this.ops.push(`q ${gs}BT /${font} ${n(size)} Tf ${col} rg ${n(c)} ${n(s)} ${n(-s)} ${n(c)} ${n(tx)} ${n(this.Y(y))} Tm (${escText(str)}) Tj ET Q`);
      } else {
        this.ops.push(`q ${gs}BT /${font} ${n(size)} Tf ${col} rg ${n(tx)} ${n(this.Y(y))} Td (${escText(str)}) Tj ET Q`);
      }
      return this;
    }
    /** Text wrapped to a width; returns the y after the last line. */
    para(x, y, str, maxW, o = {}) {
      const size = o.size || 10; const lh = o.lh || size * 1.35; const words = clean(str).split(/\s+/); let line = ""; let yy = y;
      for (const wd of words) {
        const t = line ? `${line} ${wd}` : wd;
        if (width(t, size, o.font) > maxW && line) { this.text(x, yy, line, o); yy += lh; line = wd; } else line = t;
      }
      if (line) { this.text(x, yy, line, o); yy += lh; }
      return yy;
    }
  }

  class Doc {
    constructor(opts = {}) { this.w = opts.width || 595.28; this.h = opts.height || 841.89; this.pages = []; this.title = opts.title || "DrawingOps document"; this.author = opts.author || "DrawingOps (demo)"; }
    page(w, h) { const p = new Page(w || this.w, h || this.h); this.pages.push(p); return p; }
    output() {
      const objs = [];
      const add = (s) => { objs.push(s); return objs.length; };
      const catalog = add(null); const pagesId = add(null);
      const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      const f3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
      const gs = add("<< /Type /ExtGState /ca 0.22 /CA 0.35 >>");
      const kids = [];
      for (const p of this.pages) {
        const content = p.ops.join("\n");
        const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(p.w)} ${n(p.h)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /ExtGState << /GS1 ${gs} 0 R >> >> /Contents ${c} 0 R >>`));
      }
      objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
      const info = add(`<< /Title (${escText(this.title)}) /Author (${escText(this.author)}) /Producer (DrawingOps demo PDF writer) >>`);
      let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; const offsets = [];
      objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
      return bytes;
    }
  }

  DO.pdf = { Doc, width, clean, hex };
})(typeof window !== "undefined" ? window : globalThis);

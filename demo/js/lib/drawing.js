/* DrawingOps demo · fictional drawing sheets, transmittal cover sheets and table reports as PDFs.
   Every sheet's drawing is generated from its number, so the same sheet always looks the same. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const { Doc } = DO.pdf;

  const INK = [0.12, 0.14, 0.18];
  const GREY = [0.62, 0.65, 0.7];
  const LIGHT = [0.8, 0.82, 0.86];
  const COLOURS = { A: INK, S: [0.25, 0.25, 0.3], C: [0.35, 0.3, 0.2], M: [0.07, 0.35, 0.75], E: [0.72, 0.45, 0], P: [0, 0.48, 0.28], F: [0.75, 0.12, 0.12], X: [0.45, 0.2, 0.7], G: [0.0, 0.5, 0.55] };
  const ROOMS = {
    hospital: ["OT-1", "OT-2", "Pre-op", "Recovery", "ICU", "Nurse station", "Ward 4-bed", "Ward 2-bed", "Isolation", "Doctor duty", "Clean utility", "Dirty utility", "Store", "Toilet", "Pantry", "CSSD", "Scrub", "Lift lobby", "Staircase", "AHU room", "Electrical", "Waiting"],
    residential: ["Living", "Dining", "Kitchen", "Bedroom 1", "Bedroom 2", "Master bed", "Toilet", "Utility", "Balcony", "Foyer", "Lift lobby", "Staircase", "Shaft", "Study", "Puja"],
    commercial: ["Open office", "Meeting", "Board room", "Cafeteria", "Server", "Reception", "Toilet M", "Toilet F", "Pantry", "Lift lobby", "Staircase", "Electrical", "AHU room", "Store", "Phone booth", "Training"],
    other: ["Classroom", "Classroom", "Library", "Lab", "Staff room", "Toilet", "Store", "Lift lobby", "Staircase", "Activity", "Principal", "Sick bay"],
  };

  function sheetPdf(o) {
    const doc = new Doc({ width: 1190.55, height: 841.89, title: `${o.sheet.number} ${o.sheet.title} rev ${o.revision?.code || "-"}`, author: o.firm?.name });
    const p = doc.page();
    const W = p.w; const H = p.h;
    const r = DO.rng(DO.hash(o.sheet.number + o.project.code));
    // Border and title-block strip.
    p.rect(14, 14, W - 28, H - 28, { color: INK, w: 1.6 });
    p.rect(20, 20, W - 40, H - 40, { color: INK, w: 0.5 });
    const tbX = W - 20 - 236;
    p.line(tbX, 20, tbX, H - 20, { color: INK, w: 1 });
    const area = { x: 44, y: 44, w: tbX - 44 - 24, h: H - 88 };
    const kind = /elevation|section/i.test(o.sheet.title) ? "elev" : /schedule|legend|index|list/i.test(o.sheet.title) ? "schedule" : /detail|enlarged/i.test(o.sheet.title) ? "detail" : /single line|sld|schematic|riser|layout of panels/i.test(o.sheet.title) ? "schematic" : o.sheet.discipline === "C" ? "site" : "plan";
    const col = COLOURS[o.sheet.discipline] || INK;
    ({ plan: drawPlan, elev: drawElevation, schedule: drawSchedule, detail: drawDetails, schematic: drawSchematic, site: drawSite })[kind](p, area, r, o, col);
    // Drawing title under the view.
    p.circle(area.x + 14, H - 58, 11, { color: INK, w: 1 });
    p.text(area.x + 14, H - 54, "1", { size: 10, font: "F2", align: "center" });
    p.text(area.x + 32, H - 60, o.sheet.title.toUpperCase(), { size: 11, font: "F2" });
    p.line(area.x + 32, H - 56, area.x + 32 + DO.pdf.width(o.sheet.title.toUpperCase(), 11, "F2"), H - 56, { color: INK, w: 0.8 });
    p.text(area.x + 32, H - 46, `SCALE 1:${kind === "detail" ? 20 : kind === "site" ? 500 : 100} AT A3`, { size: 7, color: GREY });
    titleBlock(p, tbX, o);
    if (o.superseded) {
      p.text(190, 610, "SUPERSEDED", { size: 120, font: "F2", color: [0.75, 0.1, 0.1], angle: 28, opacity: 0.25 });
      p.text(250, 680, `Superseded on ${o.superseded.date}${o.superseded.by ? ` by ${o.superseded.by}` : ""} - do not use for construction`, { size: 18, font: "F2", color: [0.75, 0.1, 0.1], angle: 28, opacity: 0.25 });
    } else if (o.revision && o.revision.state === "draft") {
      p.text(W / 2 - 160, H / 2 + 80, "CHECK PRINT", { size: 90, font: "F2", color: [0.45, 0.45, 0.5], angle: 24, opacity: 0.25 });
    }
    return doc.output();
  }

  function grid(p, a, r, opts = {}) {
    const cols = opts.cols || 6 + Math.floor(r() * 3); const rows = opts.rows || 4 + Math.floor(r() * 2);
    const bx = a.x + 40; const by = a.y + 40; const bw = a.w - 80; const bh = a.h - 110;
    const xs = Array.from({ length: cols + 1 }, (_, i) => bx + (bw * i) / cols);
    const ys = Array.from({ length: rows + 1 }, (_, i) => by + (bh * i) / rows);
    xs.forEach((x, i) => { p.line(x, by - 22, x, by + bh + 22, { color: LIGHT, w: 0.5, dash: [8, 3, 2, 3] }); p.circle(x, by - 32, 9, { color: GREY, w: 0.7 }); p.text(x, by - 29, String.fromCharCode(65 + i), { size: 8, align: "center", color: GREY }); });
    ys.forEach((y, i) => { p.line(bx - 22, y, bx + bw + 22, y, { color: LIGHT, w: 0.5, dash: [8, 3, 2, 3] }); p.circle(bx - 32, y, 9, { color: GREY, w: 0.7 }); p.text(bx - 32, y + 3, String(i + 1), { size: 8, align: "center", color: GREY }); });
    // Overall dimension.
    p.line(bx, by - 48, bx + bw, by - 48, { color: GREY, w: 0.5 });
    xs.forEach((x) => p.line(x - 3, by - 45, x + 3, by - 51, { color: GREY, w: 0.6 }));
    xs.slice(1).forEach((x, i) => p.text((x + xs[i]) / 2, by - 51, String(6000 + Math.round(r() * 4) * 300), { size: 6, align: "center", color: GREY }));
    return { bx, by, bw, bh, xs, ys };
  }

  function rooms(g, r, type) {
    const names = ROOMS[type] || ROOMS.other; const list = [];
    const cy = g.by + g.bh * (0.44 + r() * 0.1); const ch = Math.max(26, g.bh * 0.11);
    const bands = [[g.by, cy - g.by], [cy + ch, g.by + g.bh - cy - ch]];
    bands.forEach(([y, h]) => {
      let x = g.bx;
      while (x < g.bx + g.bw - 5) {
        const w = Math.min(g.bx + g.bw - x, g.bw * (0.09 + r() * 0.12));
        if (r() > 0.55 && h > 120) { const h1 = h * (0.4 + r() * 0.2); list.push({ x, y, w, h: h1 }, { x, y: y + h1, w, h: h - h1 }); }
        else list.push({ x, y, w, h });
        x += w;
      }
    });
    list.forEach((rm, i) => { rm.name = names[(i + Math.floor(r() * 4)) % names.length]; rm.top = rm.y < cy; });
    return { list, corridor: { x: g.bx, y: cy, w: g.bw, h: ch } };
  }

  function drawPlan(p, a, r, o, col) {
    const g = grid(p, a, r);
    const lay = rooms(g, r, o.project.type);
    const isArch = o.sheet.discipline === "A";
    const wall = isArch ? { color: INK, w: 1.8 } : { color: GREY, w: 0.8 };
    p.rect(g.bx, g.by, g.bw, g.bh, { ...wall, w: wall.w + 0.8 });
    lay.list.forEach((rm) => {
      p.rect(rm.x, rm.y, rm.w, rm.h, wall);
      // Door on the corridor side.
      const dw = Math.min(22, rm.w * 0.3); const dx = rm.x + rm.w * 0.25;
      const dy = rm.top ? rm.y + rm.h : rm.y;
      p.line(dx, dy, dx + dw, dy, { color: [1, 1, 1], w: wall.w + 1.2 });
      p.arc(dx, dy, dw, rm.top ? 0 : 0, rm.top ? 90 : -90, { color: isArch ? INK : GREY, w: 0.4 });
      p.line(dx, dy, dx, rm.top ? dy - dw : dy + dw, { color: isArch ? INK : GREY, w: 0.6 });
      if (rm.w > 40) {
        p.text(rm.x + rm.w / 2, rm.y + rm.h / 2, rm.name.toUpperCase(), { size: rm.w > 70 ? 7 : 5.5, align: "center", color: isArch ? INK : GREY, font: "F2" });
        if (isArch) p.text(rm.x + rm.w / 2, rm.y + rm.h / 2 + 9, `${Math.round((rm.w * rm.h) / 290)} sq.m`, { size: 5.5, align: "center", color: GREY });
      }
    });
    p.text(lay.corridor.x + lay.corridor.w / 2, lay.corridor.y + lay.corridor.h / 2 + 3, "CORRIDOR", { size: 7, align: "center", color: GREY, font: "F2" });
    const d = o.sheet.discipline;
    if (d === "S") structure(p, g, col);
    if (d === "M") hvac(p, lay, col, r);
    if (d === "E") electrical(p, lay, col, r);
    if (d === "P") plumbing(p, lay, col, r);
    if (d === "F") fire(p, lay, col);
    if (d === "X") elv(p, lay, col);
    if (d === "G") medgas(p, lay, col);
    if (isArch) archExtras(p, g, r);
    northArrow(p, a.x + a.w - 40, a.y + 30);
    legend(p, a, d, col);
  }

  function structure(p, g, col) {
    g.xs.forEach((x, i) => g.ys.forEach((y, j) => { p.rect(x - 6, y - 6, 12, 12, { fill: col }); if (i % 2 === 0 && j % 2 === 0) p.text(x + 9, y - 8, `C${i + j + 1}`, { size: 6, color: col }); }));
    g.ys.forEach((y) => p.line(g.bx, y, g.bx + g.bw, y, { color: col, w: 1.2 }));
    g.xs.forEach((x) => p.line(x, g.by, x, g.by + g.bh, { color: col, w: 1.2 }));
    g.xs.slice(1).forEach((x, i) => p.text((x + g.xs[i]) / 2, g.by + 10, `B${i + 1} 300x600`, { size: 5.5, align: "center", color: col }));
  }
  function hvac(p, lay, col, r) {
    const c = lay.corridor; const y1 = c.y + c.h * 0.3; const y2 = c.y + c.h * 0.7;
    p.line(c.x + 10, y1, c.x + c.w - 10, y1, { color: col, w: 1.2 }); p.line(c.x + 10, y2, c.x + c.w - 10, y2, { color: col, w: 1.2 });
    p.text(c.x + 30, y1 - 3, "SA 1200x450", { size: 6, color: col, font: "F2" });
    lay.list.forEach((rm, i) => {
      if (rm.w < 30) return;
      const x = rm.x + rm.w / 2; const yy = rm.top ? y1 : y2; const ty = rm.y + rm.h / 2;
      p.line(x - 4, yy, x - 4, ty, { color: col, w: 0.8 }); p.line(x + 4, yy, x + 4, ty, { color: col, w: 0.8 });
      p.rect(x - 10, ty - 10 + (rm.top ? -14 : 14), 20, 20, { color: col, w: 0.8 });
      p.line(x - 10, ty - 10 + (rm.top ? -14 : 14), x + 10, ty + 10 + (rm.top ? -14 : 14), { color: col, w: 0.4 });
      p.line(x + 10, ty - 10 + (rm.top ? -14 : 14), x - 10, ty + 10 + (rm.top ? -14 : 14), { color: col, w: 0.4 });
      if (i % 3 === 0) p.text(x + 12, ty + (rm.top ? -24 : 34), `${300 + Math.round(r() * 6) * 50} CFM`, { size: 5.5, color: col });
      if (/OT|ICU|Isolation/.test(rm.name)) p.text(x, ty + (rm.top ? 18 : -18), "HEPA H14", { size: 5.5, color: col, align: "center", font: "F2" });
    });
  }
  function electrical(p, lay, col, r) {
    lay.list.forEach((rm) => {
      if (rm.w < 30) return;
      const nx = Math.max(1, Math.floor(rm.w / 45)); const ny = Math.max(1, Math.floor(rm.h / 45));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = rm.x + (rm.w * (i + 0.5)) / nx; const y = rm.y + (rm.h * (j + 0.5)) / ny; p.rect(x - 9, y - 3, 18, 6, { color: col, w: 0.7 }); }
      p.poly([[rm.x + 8, rm.y + 8], [rm.x + rm.w / 2, rm.y + 12], [rm.x + rm.w - 8, rm.y + 8]], { color: col, w: 0.5, dash: [3, 2] });
      p.text(rm.x + 6, rm.y + rm.h - 6, `L${1 + Math.floor(r() * 9)}/C${1 + Math.floor(r() * 12)}`, { size: 5, color: col });
    });
    const c = lay.corridor; p.rect(c.x + c.w - 60, c.y + 4, 40, c.h - 8, { color: col, w: 1, fill: [1, 0.95, 0.85] }); p.text(c.x + c.w - 40, c.y + c.h / 2 + 2, "LDB-2", { size: 6, color: col, align: "center", font: "F2" });
  }
  function plumbing(p, lay, col) {
    const c = lay.corridor; p.line(c.x + 8, c.y + 6, c.x + c.w - 8, c.y + 6, { color: col, w: 1 }); p.line(c.x + 8, c.y + c.h - 6, c.x + c.w - 8, c.y + c.h - 6, { color: col, w: 1, dash: [6, 3] });
    p.text(c.x + 20, c.y + 14, "CWS 50 NB", { size: 6, color: col, font: "F2" }); p.text(c.x + 20, c.y + c.h - 9, "SW/WW 100 NB", { size: 6, color: col, font: "F2" });
    lay.list.forEach((rm) => {
      if (rm.w < 30) return;
      const wet = /Toilet|Pantry|Kitchen|Scrub|utility|CSSD|Utility/.test(rm.name);
      if (!wet) return;
      for (let i = 0; i < 3; i++) { const x = rm.x + 12 + i * 16; const y = rm.top ? rm.y + 14 : rm.y + rm.h - 14; p.circle(x, y, 5, { color: col, w: 0.8 }); p.line(x, y, x, rm.top ? rm.y + rm.h : rm.y, { color: col, w: 0.5 }); }
    });
  }
  function fire(p, lay, col) {
    lay.list.concat([lay.corridor]).forEach((rm) => {
      const nx = Math.max(1, Math.floor(rm.w / 36)); const ny = Math.max(1, Math.floor(rm.h / 36));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) p.circle(rm.x + (rm.w * (i + 0.5)) / nx, rm.y + (rm.h * (j + 0.5)) / ny, 2.6, { color: col, w: 0.8, fill: [1, 1, 1] });
    });
    const c = lay.corridor; p.line(c.x + 6, c.y + c.h / 2, c.x + c.w - 6, c.y + c.h / 2, { color: col, w: 1.6 }); p.text(c.x + 24, c.y + c.h / 2 - 4, "SPRINKLER MAIN 100 NB", { size: 6, color: col, font: "F2" });
  }
  function elv(p, lay, col) {
    lay.list.forEach((rm, i) => {
      if (rm.w < 30) return;
      p.poly([[rm.x + 4, rm.y + 4], [rm.x + 14, rm.y + 8], [rm.x + 8, rm.y + 14]], { color: col, w: 0.8, close: true });
      if (i % 2 === 0) { const x = rm.x + rm.w * 0.25 + 26; const y = rm.top ? rm.y + rm.h - 8 : rm.y + 8; p.rect(x, y - 4, 8, 8, { color: col, w: 0.8 }); p.text(x + 10, y + 2, "ACS", { size: 5, color: col }); }
      if (/Ward|ICU|bed|Recovery/i.test(rm.name)) p.text(rm.x + rm.w / 2, rm.y + rm.h / 2 + 12, "NURSE CALL", { size: 5, color: col, align: "center" });
    });
  }
  function medgas(p, lay, col) {
    lay.list.forEach((rm) => {
      if (!/OT|ICU|Ward|Recovery|Pre-op|Isolation/.test(rm.name) || rm.w < 30) return;
      const y = rm.top ? rm.y + 10 : rm.y + rm.h - 10;
      ["O", "V", "A", "N"].forEach((g, i) => { const x = rm.x + 12 + i * 13; p.circle(x, y, 5, { color: col, w: 0.8 }); p.text(x, y + 2, g, { size: 5, color: col, align: "center", font: "F2" }); });
    });
    const c = lay.corridor; [0.25, 0.5].forEach((f, i) => p.line(c.x + 6, c.y + c.h * f + 6, c.x + c.w - 6, c.y + c.h * f + 6, { color: col, w: 0.9, dash: i ? [4, 2] : undefined }));
    p.text(c.x + 24, c.y + 10, "O2 28 OD / VAC 22 OD", { size: 6, color: col, font: "F2" });
  }
  function archExtras(p, g, r) {
    // Section markers and a stair.
    [[g.bx + g.bw * 0.3, "A"], [g.bx + g.bw * 0.7, "B"]].forEach(([x, l]) => { p.line(x, g.by - 14, x, g.by + g.bh + 14, { color: INK, w: 0.5, dash: [14, 3, 3, 3] }); p.circle(x, g.by + g.bh + 26, 8, { color: INK, w: 0.8 }); p.text(x, g.by + g.bh + 29, l, { size: 8, font: "F2", align: "center" }); });
    const sx = g.bx + g.bw - 70; const sy = g.by + 6;
    for (let i = 0; i < 9; i++) p.line(sx, sy + i * 6, sx + 50, sy + i * 6, { color: INK, w: 0.4 });
    p.text(g.bx + 8, g.by + g.bh - 8, `FFL +${(Math.floor(r() * 6) * 3.6).toFixed(3)}`, { size: 6, color: INK, font: "F2" });
  }
  function northArrow(p, x, y) { p.circle(x, y, 14, { color: INK, w: 0.7 }); p.poly([[x, y - 18], [x + 6, y + 8], [x, y + 3], [x - 6, y + 8]], { fill: INK, close: true }); p.text(x, y - 22, "N", { size: 8, align: "center", font: "F2" }); }
  function legend(p, a, d, col) {
    const items = { M: ["Supply air duct", "Ceiling diffuser"], E: ["LED panel 2x2", "Lighting circuit"], P: ["Cold water supply", "Soil and waste"], F: ["Pendant sprinkler", "Sprinkler main"], X: ["CCTV dome camera", "Access control"], G: ["Medical gas outlet", "Copper pipe"], S: ["RCC column", "RCC beam"], A: ["Brick wall 230", "Door"] }[d];
    if (!items) return;
    const x = a.x + 8; const y = a.y + a.h - 110;
    p.text(x, y, "LEGEND", { size: 7, font: "F2" });
    items.forEach((t, i) => { p.line(x, y + 12 + i * 11, x + 18, y + 12 + i * 11, { color: col, w: 1.2, dash: i ? [3, 2] : undefined }); p.text(x + 24, y + 14 + i * 11, t, { size: 6.5 }); });
  }

  function drawElevation(p, a, r, o) {
    const floors = o.project.type === "residential" ? 12 : 6 + Math.floor(r() * 3);
    const bx = a.x + 70; const bw = a.w - 140; const gy = a.y + a.h - 70; const fh = Math.min(48, (a.h - 140) / floors);
    p.line(a.x + 20, gy, a.x + a.w - 20, gy, { color: INK, w: 2 });
    for (let f = 0; f < floors; f++) {
      const y = gy - (f + 1) * fh;
      p.line(bx, y, bx + bw, y, { color: INK, w: 0.6 });
      p.text(bx - 10, y + fh / 2 + 3, f === 0 ? "GF" : `L${f}`, { size: 6.5, align: "right", color: GREY });
      p.text(bx + bw + 8, y + 3, `+${((f + 1) * 3.6).toFixed(3)}`, { size: 6, color: GREY });
      const nw = 8 + Math.floor(r() * 4);
      for (let i = 0; i < nw; i++) { const wx = bx + 12 + (i * (bw - 24)) / nw; p.rect(wx, y + fh * 0.25, (bw - 24) / nw - 10, fh * 0.5, { color: INK, w: 0.5 }); }
    }
    p.rect(bx, gy - floors * fh, bw, floors * fh, { color: INK, w: 1.6 });
    p.rect(bx + bw * 0.4, gy - floors * fh - 30, bw * 0.2, 30, { color: INK, w: 1 });
    p.text(bx + bw * 0.5, gy - floors * fh - 12, "LMR / OHT", { size: 6.5, align: "center", font: "F2" });
    for (let i = 0; i < 9; i++) p.circle(a.x + 30 + i * ((a.w - 60) / 8), gy + 18, 6 + r() * 6, { color: GREY, w: 0.5 });
  }
  function drawSchedule(p, a, r, o) {
    const cols = /door/i.test(o.sheet.title) ? ["MARK", "TYPE", "SIZE (W x H)", "LEAF", "FRAME", "HARDWARE", "FIRE RATING", "QTY"] : ["TAG", "DESCRIPTION", "LOCATION", "SIZE", "CAPACITY", "MAKE", "REMARKS", "QTY"];
    const x0 = a.x + 20; const y0 = a.y + 30; const cw = (a.w - 40) / cols.length; const rh = 18; const nRows = 24;
    p.rect(x0, y0, a.w - 40, rh, { fill: [0.93, 0.94, 0.96], color: INK, w: 0.8 });
    cols.forEach((c, i) => p.text(x0 + i * cw + 6, y0 + 12, c, { size: 7, font: "F2" }));
    for (let j = 1; j <= nRows; j++) {
      const y = y0 + j * rh; p.line(x0, y + rh, x0 + a.w - 40, y + rh, { color: LIGHT, w: 0.5 });
      const vals = [`${o.sheet.discipline}${String(j).padStart(2, "0")}`, ["Flush door", "Fire door 2h", "Glazed door", "AHU", "FCU", "Exhaust fan", "Lead-lined door", "Hermetic sliding"][j % 8], ["GF", "L1", "L2", "L3", "Terrace"][j % 5], `${900 + (j % 4) * 300} x 2100`, `${(j % 5) + 1} TR`, ["Make A", "Make B", "Make C"][j % 3], j % 6 === 0 ? "Refer detail 3/D-04" : "-", String(1 + Math.floor(r() * 12))];
      vals.forEach((v, i) => p.text(x0 + i * cw + 6, y + 12, v, { size: 6.5, font: i === 0 ? "F3" : "F1" }));
    }
    for (let i = 0; i <= cols.length; i++) p.line(x0 + i * cw, y0, x0 + i * cw, y0 + (nRows + 1) * rh, { color: INK, w: 0.5 });
    p.rect(x0, y0, a.w - 40, (nRows + 1) * rh, { color: INK, w: 1 });
  }
  function drawDetails(p, a, r, o) {
    const n = 4; const w = (a.w - 60) / 2; const h = (a.h - 110) / 2;
    for (let i = 0; i < n; i++) {
      const x = a.x + 20 + (i % 2) * (w + 20); const y = a.y + 20 + Math.floor(i / 2) * (h + 30);
      p.rect(x, y, w, h, { color: LIGHT, w: 0.5 });
      // Hatched section.
      const sx = x + w * 0.2; const sy = y + h * 0.25; const sw = w * 0.6; const sh = h * 0.18;
      p.rect(sx, sy, sw, sh, { color: INK, w: 1.2 });
      for (let k = 0; k < sw; k += 8) p.line(sx + k, sy + sh, Math.min(sx + k + sh, sx + sw), sy + Math.max(0, sh - (sx + sw - sx - k)), { color: GREY, w: 0.4 });
      p.rect(sx + sw * 0.1, sy + sh, sw * 0.12, h * 0.4, { color: INK, w: 1 });
      p.rect(sx + sw * 0.78, sy + sh, sw * 0.12, h * 0.4, { color: INK, w: 1 });
      p.line(sx, sy - 14, sx + sw, sy - 14, { color: GREY, w: 0.5 }); p.text(sx + sw / 2, sy - 17, `${1200 + Math.round(r() * 8) * 100}`, { size: 6, align: "center", color: GREY });
      p.circle(x + 16, y + h - 14, 9, { color: INK, w: 0.8 }); p.text(x + 16, y + h - 11, String(i + 1), { size: 8, align: "center", font: "F2" });
      p.text(x + 30, y + h - 11, ["SECTION AT DOOR HEAD", "SKIRTING AND COVING", "CEILING SUSPENSION", "SHAFT OPENING EDGE"][i], { size: 7, font: "F2" });
    }
  }
  function drawSchematic(p, a, r, o, col) {
    const top = a.y + 60; const busY = top + 80;
    p.rect(a.x + a.w / 2 - 60, top, 120, 40, { color: col, w: 1.2 }); p.text(a.x + a.w / 2, top + 24, o.sheet.discipline === "E" ? "HT PANEL 11 kV" : "MAIN HEADER", { size: 8, align: "center", font: "F2", color: col });
    p.line(a.x + a.w / 2, top + 40, a.x + a.w / 2, busY, { color: col, w: 1.4 });
    p.line(a.x + 60, busY, a.x + a.w - 60, busY, { color: col, w: 2.2 });
    const n = 7 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const x = a.x + 80 + (i * (a.w - 160)) / (n - 1);
      p.line(x, busY, x, busY + 120, { color: col, w: 1 }); p.circle(x, busY + 40, 5, { color: col, w: 0.8 });
      p.rect(x - 34, busY + 120, 68, 36, { color: col, w: 0.9 }); p.text(x, busY + 136, `${o.sheet.discipline === "E" ? "SMDB" : "BR"}-${i + 1}`, { size: 7, align: "center", font: "F2", color: col }); p.text(x, busY + 148, `${(i % 4) + 1}${o.sheet.discipline === "E" ? "00A TPN" : "00 NB"}`, { size: 6, align: "center", color: col });
      for (let k = 0; k < 3; k++) { p.line(x - 20 + k * 20, busY + 156, x - 20 + k * 20, busY + 220, { color: col, w: 0.6 }); p.rect(x - 26 + k * 20, busY + 220, 12, 12, { color: col, w: 0.6 }); }
    }
  }
  function drawSite(p, a, r) {
    const pts = [[a.x + 60, a.y + 60], [a.x + a.w - 80, a.y + 40], [a.x + a.w - 40, a.y + a.h - 120], [a.x + 90, a.y + a.h - 80]];
    p.poly(pts, { color: INK, w: 1.6, close: true, dash: [12, 4, 3, 4] });
    for (let k = 0; k < 7; k++) { const off = k * 40; p.poly(Array.from({ length: 12 }, (_, i) => [a.x + 80 + i * ((a.w - 160) / 11), a.y + 120 + off + Math.sin(i / 2 + k) * 18]), { color: [0.55, 0.45, 0.3], w: 0.5 }); p.text(a.x + 70, a.y + 124 + off, `${(912.5 - k * 0.5).toFixed(1)}`, { size: 5.5, color: [0.55, 0.45, 0.3] }); }
    p.rect(a.x + a.w * 0.35, a.y + a.h * 0.3, a.w * 0.3, a.h * 0.3, { color: INK, w: 1.4, fill: [0.95, 0.95, 0.96] }); p.text(a.x + a.w * 0.5, a.y + a.h * 0.45, "PROPOSED BLOCK", { size: 9, align: "center", font: "F2" });
    p.poly([[a.x + 80, a.y + a.h - 100], [a.x + a.w - 60, a.y + a.h - 130]], { color: [0, 0.4, 0.7], w: 1.2, dash: [6, 3] }); p.text(a.x + a.w / 2, a.y + a.h - 122, "SWD 600 WIDE @ 1:200", { size: 6.5, color: [0, 0.4, 0.7], font: "F2", align: "center" });
    northArrow(p, a.x + a.w - 40, a.y + 30);
  }

  function titleBlock(p, x, o) {
    const w = 236; const right = x + w; let y = 20;
    const box = (h) => { p.line(x, y + h, right, y + h, { color: INK, w: 0.6 }); const top = y; y += h; return top; };
    let t = box(74);
    p.rect(x + 10, t + 12, 26, 26, { fill: [0.04, 0.37, 0.65] }); p.text(x + 23, t + 30, "PR", { size: 10, font: "F2", color: [1, 1, 1], align: "center" });
    p.text(x + 44, t + 22, o.firm?.name || "Design firm", { size: 9, font: "F2" });
    p.text(x + 44, t + 34, o.firm?.tagline || "Architects and MEP engineers", { size: 6.5, color: GREY });
    p.text(x + 10, t + 56, o.firm?.address || "", { size: 6, color: GREY });
    p.text(x + 10, t + 66, "Fictional firm for demonstration only", { size: 5.5, color: GREY });
    t = box(44); p.text(x + 8, t + 11, "CLIENT", { size: 5.5, color: GREY }); p.para(x + 8, t + 23, o.project.client || "-", w - 16, { size: 8, font: "F2", lh: 10 });
    t = box(52); p.text(x + 8, t + 11, "PROJECT", { size: 5.5, color: GREY }); p.text(x + 8, t + 24, o.project.code, { size: 8, font: "F3" }); p.para(x + 8, t + 36, o.project.name, w - 16, { size: 8.5, font: "F2", lh: 10 });
    t = box(66); p.text(x + 8, t + 11, "DRAWING TITLE", { size: 5.5, color: GREY }); p.para(x + 8, t + 27, o.sheet.title.toUpperCase(), w - 16, { size: 11, font: "F2", lh: 13 });
    const cell = (cx, cy, cw, label, value, big) => { p.text(cx + 6, cy + 10, label, { size: 5.5, color: GREY }); p.text(cx + 6, cy + (big ? 30 : 24), value || "-", { size: big ? 16 : 8, font: big ? "F3" : "F1" }); };
    t = box(40); p.line(x + w * 0.62, t, x + w * 0.62, t + 40, { color: INK, w: 0.6 }); cell(x, t, w * 0.62, "SHEET NO.", o.sheet.number, true); cell(x + w * 0.62, t, w * 0.38, "REVISION", o.revision?.code || "-", true);
    const rows = [["SCALE", "1:100 @ A3", "DATE", DO.fmtDate(o.revision?.issuedAt || o.revision?.uploadedAt || DO.today())], ["DRAWN", o.owner || "-", "CHECKED", o.checker || "-"], ["DISCIPLINE", o.disciplineName || o.sheet.discipline, "STAGE", o.stageName || "-"]];
    rows.forEach((rw) => { t = box(30); p.line(x + w / 2, t, x + w / 2, t + 30, { color: INK, w: 0.6 }); cell(x, t, w / 2, rw[0], rw[1]); cell(x + w / 2, t, w / 2, rw[2], rw[3]); });
    t = box(44);
    const purpose = o.revision?.state === "draft" ? "CHECK PRINT - NOT FOR CONSTRUCTION" : (o.purposeLabel || "FOR INFORMATION").toUpperCase();
    const gfc = /construction|gfc/i.test(purpose) && o.revision?.state !== "draft";
    p.rect(x + 8, t + 8, w - 16, 28, { color: gfc ? [0.11, 0.42, 0.18] : [0.5, 0.33, 0], w: 1.4, fill: gfc ? [0.9, 0.96, 0.91] : [1, 0.96, 0.84] });
    p.text(x + w / 2, t + 26, purpose.length > 34 ? purpose.slice(0, 34) : purpose, { size: purpose.length > 26 ? 7 : 8.5, font: "F2", align: "center", color: gfc ? [0.11, 0.42, 0.18] : [0.5, 0.33, 0] });
    // Revision table fills the remaining space.
    t = y; p.text(x + 8, t + 12, "REVISIONS", { size: 5.5, color: GREY, font: "F2" });
    const hdr = t + 18; p.line(x, hdr + 12, right, hdr + 12, { color: INK, w: 0.4 });
    [["REV", 8], ["DATE", 40], ["DESCRIPTION", 96], ["BY", 206]].forEach(([l, dx]) => p.text(x + dx, hdr + 9, l, { size: 5.5, font: "F2" }));
    const revs = (o.revisions || []).slice(-14);
    revs.forEach((rv, i) => {
      const ry = hdr + 24 + i * 12;
      const st = rv.state === "superseded" ? [0.5, 0.5, 0.5] : INK;
      p.text(x + 8, ry, rv.code, { size: 6.5, font: "F3", color: st });
      p.text(x + 40, ry, DO.fmtDate(rv.issuedAt || rv.uploadedAt).slice(0, 11), { size: 6, color: st });
      p.text(x + 96, ry, (rv.purposeLabel || (rv.state === "draft" ? "Check print" : "Issue")).slice(0, 24), { size: 6, color: st });
      p.text(x + 206, ry, DO.initials(rv.byName || ""), { size: 6, color: st });
    });
    p.text(x + 8, 841.89 - 46, "Do not scale. All dimensions in mm unless noted.", { size: 5.5, color: GREY });
    p.text(x + 8, 841.89 - 36, `Generated by DrawingOps demo  ${DO.fmtDateTime(new Date())}`, { size: 5.5, color: GREY });
    p.text(x + 8, 841.89 - 26, o.sheet.cadLink ? `CAD: ${o.sheet.cadLink}`.slice(0, 60) : "", { size: 5, color: GREY, font: "F3" });
  }

  /** S-07 cover sheet: the numbered record of what went to whom, for what purpose. */
  function coverPdf(o) {
    const doc = new Doc({ title: `Transmittal ${o.number}`, author: o.firm.name });
    const per = 26; const pages = Math.max(1, Math.ceil(o.items.length / per));
    for (let pg = 0; pg < pages; pg++) {
      const p = doc.page();
      p.rect(40, 40, 30, 30, { fill: [0.04, 0.37, 0.65] }); p.text(55, 60, "PR", { size: 11, font: "F2", color: [1, 1, 1], align: "center" });
      p.text(80, 52, o.firm.name, { size: 12, font: "F2" }); p.text(80, 66, o.firm.address, { size: 8, color: GREY });
      p.text(555, 52, "DRAWING TRANSMITTAL", { size: 13, font: "F2", align: "right" });
      p.text(555, 68, o.number, { size: 11, font: "F3", align: "right" });
      p.line(40, 84, 555, 84, { color: INK, w: 1 });
      if (pg === 0) {
        const kv = [["Project", `${o.project.code}  ${o.project.name}`], ["Client", o.project.client], ["Date", DO.fmtDate(o.sentAt)], ["Purpose", o.purposeLabel], ["Sent by", o.sender], ["Reference", o.refersTo ? `Corrects ${o.refersTo}` : "-"]];
        kv.forEach(([k, v], i) => { p.text(40, 106 + i * 15, k, { size: 8, color: GREY }); p.text(120, 106 + i * 15, v || "-", { size: 9 }); });
        let y = 210; p.text(40, y, "RECIPIENTS", { size: 8, font: "F2" }); y += 6;
        p.rect(40, y, 515, 16, { fill: [0.95, 0.96, 0.97] }); [["Name", 46], ["Organisation", 200], ["Delivery", 400], ["Copies", 500]].forEach(([l, x]) => p.text(x, y + 11, l, { size: 7.5, font: "F2" }));
        o.recipients.forEach((rc, i) => { const yy = y + 28 + i * 14; p.text(46, yy, rc.name, { size: 8 }); p.text(200, yy, rc.org || "-", { size: 8 }); p.text(400, yy, rc.delivery === "hand" ? "By hand" : "Secure link (email)", { size: 8 }); p.text(500, yy, "1", { size: 8 }); });
        o._y = y + 40 + o.recipients.length * 14;
        if (o.note) { p.text(40, o._y, "NOTE", { size: 8, font: "F2" }); o._y = p.para(40, o._y + 14, o.note, 515, { size: 8.5 }) + 6; }
      }
      let y = pg === 0 ? o._y + 6 : 104;
      p.text(40, y, `DRAWINGS (${o.items.length})`, { size: 8, font: "F2" }); y += 6;
      p.rect(40, y, 515, 16, { fill: [0.95, 0.96, 0.97] }); [["#", 46], ["Sheet", 64], ["Title", 130], ["Rev", 410], ["Purpose", 445]].forEach(([l, x]) => p.text(x, y + 11, l, { size: 7.5, font: "F2" }));
      o.items.slice(pg * per, pg * per + per).forEach((it, i) => {
        const yy = y + 28 + i * 14; const idx = pg * per + i + 1;
        if (i % 2) p.rect(40, yy - 10, 515, 14, { fill: [0.985, 0.985, 0.99] });
        p.text(46, yy, String(idx), { size: 8, color: GREY }); p.text(64, yy, it.number, { size: 8, font: "F3" }); p.text(130, yy, it.title.slice(0, 50), { size: 8 }); p.text(410, yy, it.rev, { size: 8, font: "F3" }); p.text(445, yy, it.purposeShort || "", { size: 8 });
      });
      p.line(40, 770, 555, 770, { color: LIGHT, w: 0.5 });
      p.text(40, 784, "Download the drawings from the secure link in the email. Earlier revisions of these sheets are superseded and must not be used.", { size: 7, color: GREY });
      p.text(40, 796, `Link valid until ${DO.fmtDate(o.expiresAt)}. Please acknowledge receipt from the transmittal page.`, { size: 7, color: GREY });
      p.text(555, 812, `Page ${pg + 1} of ${pages}  -  DrawingOps demo (fictional data)`, { size: 7, color: GREY, align: "right" });
    }
    return doc.output();
  }

  /** Generic paginated table report (exports, baseline metrics, site reports). */
  function tablePdf(o) {
    const land = o.landscape !== false;
    const doc = new Doc({ width: land ? 841.89 : 595.28, height: land ? 595.28 : 841.89, title: o.title, author: o.firm?.name });
    const W = doc.w; const H = doc.h; const L = 36; const R = W - 36; const tw = R - L;
    const cols = o.columns; const weights = cols.map((c) => c.w || 1); const tot = weights.reduce((a, b) => a + b, 0);
    const xs = []; let acc = L; weights.forEach((w) => { xs.push(acc); acc += (w / tot) * tw; });
    const rowsPer = Math.floor((H - 150 - (o.headerLines?.length || 0) * 14) / 14);
    const pages = Math.max(1, Math.ceil(o.rows.length / rowsPer));
    for (let pg = 0; pg < pages; pg++) {
      const p = doc.page();
      p.text(L, 46, o.title, { size: 14, font: "F2" });
      p.text(R, 46, o.firm?.name || "", { size: 9, align: "right", color: GREY });
      p.text(L, 62, o.subtitle || "", { size: 8.5, color: GREY });
      p.line(L, 72, R, 72, { color: INK, w: 0.8 });
      let y = 88;
      if (pg === 0 && o.headerLines) o.headerLines.forEach((hl) => { p.text(L, y, hl, { size: 8.5 }); y += 14; });
      p.rect(L, y, tw, 16, { fill: [0.95, 0.96, 0.97] });
      cols.forEach((c, i) => p.text(xs[i] + 4, y + 11, c.label, { size: 7.5, font: "F2" }));
      y += 28;
      o.rows.slice(pg * rowsPer, pg * rowsPer + rowsPer).forEach((row, ri) => {
        if (ri % 2) p.rect(L, y - 10, tw, 14, { fill: [0.985, 0.985, 0.99] });
        row.forEach((v, i) => { const maxW = (i + 1 < xs.length ? xs[i + 1] : R) - xs[i] - 8; let s = String(v ?? ""); while (s.length > 3 && DO.pdf.width(s, 7.5, cols[i].mono ? "F3" : "F1") > maxW) s = s.slice(0, -2); if (s !== String(v ?? "")) s = s.slice(0, -1) + "."; p.text(cols[i].right ? xs[i] + ((i + 1 < xs.length ? xs[i + 1] : R) - xs[i]) - 4 : xs[i] + 4, y, s, { size: 7.5, font: cols[i].mono ? "F3" : "F1", align: cols[i].right ? "right" : undefined }); });
        y += 14;
      });
      if (pg === pages - 1 && o.footnotes) { y += 10; o.footnotes.forEach((f) => { y = p.para(L, y, f, tw, { size: 7.5, color: GREY }) + 2; }); }
      p.text(L, H - 24, `Generated ${DO.fmtDateTime(new Date())} - DrawingOps demo with fictional data`, { size: 7, color: GREY });
      p.text(R, H - 24, `Page ${pg + 1} of ${pages}`, { size: 7, color: GREY, align: "right" });
    }
    return doc.output();
  }

  DO.drawing = { sheetPdf, coverPdf, tablePdf };
})(typeof window !== "undefined" ? window : globalThis);

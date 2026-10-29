/* Walkthrough cards, rendered inside the demo page (browser script) so they use the product's own
   fonts, tokens, state chips and Lucide icons. window.WT_CARD(spec) returns HTML for #wt-card. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ic = (n, s = 20) => String(window.DO.icon(n, s));
  const chip = (st) => String(window.DO.C.chip(st, st === "issued" ? "C02" : undefined, true));
  const stageChip = (st) => String(window.DO.C.stageChip(st)).replace('class="chip"', 'class="chip lg"');

  const css = `
  #wt-card { position: fixed; inset: 0; z-index: 2147483000; color: #e8eef6; font-family: Inter, system-ui, sans-serif;
    background: radial-gradient(1200px 700px at 78% 18%, #15365a 0%, rgba(13,27,42,0) 60%), #0d1b2a; overflow: hidden; }
  #wt-card::before { content: ""; position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(rgba(90,167,232,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(90,167,232,.07) 1px, transparent 1px),
      linear-gradient(rgba(90,167,232,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(90,167,232,.035) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
  #wt-card .wrap { position: absolute; inset: 0; padding: 72px 96px; display: flex; flex-direction: column; justify-content: center; }
  #wt-card .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: #7dbaee; }
  #wt-card h1 { font-size: 56px; line-height: 64px; font-weight: 600; letter-spacing: -.02em; margin: 10px 0 0; color: #fff; }
  #wt-card h2 { font-size: 40px; line-height: 48px; font-weight: 600; letter-spacing: -.015em; margin: 8px 0 0; color: #fff; }
  #wt-card p.lead { font-size: 22px; line-height: 32px; color: #b9c7d8; margin-top: 18px; max-width: 980px; }
  #wt-card .muted2 { color: #8ea2b8; }
  #wt-card .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  #wt-card .pillx { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; background: rgba(90,167,232,.12);
    border: 1px solid rgba(125,186,238,.35); color: #d6e7f7; font-size: 16px; }
  #wt-card .grid { display: grid; gap: 16px; }
  #wt-card .tile { background: rgba(255,255,255,.045); border: 1px solid rgba(125,186,238,.22); border-radius: 12px; padding: 18px 20px; }
  #wt-card .tile h3 { font-size: 18px; line-height: 24px; font-weight: 600; color: #fff; margin: 0; display: flex; gap: 10px; align-items: center; }
  #wt-card .tile p { font-size: 15px; line-height: 22px; color: #a9bacd; margin-top: 6px; }
  #wt-card .tile .who { font-size: 13px; color: #7dbaee; margin-top: 2px; font-family: "IBM Plex Mono", monospace; }
  #wt-card ul.b { margin-top: 22px; display: grid; gap: 12px; }
  #wt-card ul.b li { font-size: 20px; line-height: 28px; color: #d0dbe8; display: flex; gap: 12px; align-items: flex-start; }
  #wt-card ul.b li svg { flex: none; margin-top: 4px; color: #7dbaee; }
  #wt-card .num { font-family: "IBM Plex Mono", monospace; font-size: 120px; line-height: 120px; font-weight: 600; color: rgba(125,186,238,.22); }
  #wt-card .logo { width: 84px; height: 84px; }
  #wt-card .flow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  #wt-card .flow .arr { color: #7dbaee; display: inline-flex; }
  #wt-card .flowbox { background: #f7f8fa; border-radius: 12px; padding: 18px 20px; color: #16202c; }
  #wt-card .flowbox .t { font-size: 14px; color: #556172; margin-bottom: 10px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; }
  #wt-card .note { font-size: 15px; color: #8ea2b8; margin-top: 14px; }
  #wt-card .foot { position: absolute; left: 96px; right: 96px; bottom: 40px; display: flex; justify-content: space-between; color: #6f86a0; font-size: 14px; font-family: "IBM Plex Mono", monospace; }
  #wt-card .phone { width: 300px; border-radius: 34px; padding: 10px; background: #1b2633; box-shadow: 0 30px 80px rgba(0,0,0,.45), inset 0 0 0 2px #2c3b4d; }
  #wt-card .phone img { width: 100%; border-radius: 26px; display: block; }
  #wt-card .shot { border-radius: 12px; box-shadow: 0 30px 80px rgba(0,0,0,.45); border: 1px solid rgba(125,186,238,.25); display: block; }
  `;

  function frame(inner, foot = true) {
    return `<style>${css}</style><div class="wrap">${inner}</div>${foot ? `<div class="foot"><span>DrawingOps · product walkthrough</span><span>Interactive prototype · fictional data</span></div>` : ""}`;
  }
  const logo = (s = 84) => `<img class="logo" src="assets/images/logo.svg" alt="" style="width:${s}px;height:${s}px">`;
  const bullets = (items) => `<ul class="b">${items.map((t) => `<li>${ic(t.icon || "check", 22)}<span>${t.text ?? t}</span></li>`).join("")}</ul>`;
  const arrow = `<span class="arr">${ic("chevron-right", 22)}</span>`;

  const R = {
    title: (s) => frame(`<div class="row" style="gap:22px">${logo(92)}<div><div class="eyebrow">${esc(s.eyebrow || "Product walkthrough")}</div><h1 style="font-size:76px;line-height:84px">DrawingOps</h1></div></div>
      <p class="lead" style="font-size:28px;line-height:40px;max-width:1080px;margin-top:28px">${esc(s.tagline)}</p>
      <div class="row" style="margin-top:36px">${(s.pills || []).map((p) => `<span class="pillx">${ic(p.icon, 18)}${esc(p.text)}</span>`).join("")}</div>
      ${s.by ? `<p class="muted2" style="margin-top:48px;font-size:18px">${esc(s.by)}</p>` : ""}`, false),
    chapter: (s) => frame(`<div style="display:grid;grid-template-columns:auto 1fr;gap:44px;align-items:start">
        <div class="num">${esc(s.num)}</div>
        <div><div class="eyebrow">${esc(s.eyebrow || "Chapter " + s.num)}</div><h1>${esc(s.title)}</h1>
          ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
          ${s.roles ? `<div class="row" style="margin-top:26px">${s.roles.map((r) => `<span class="pillx">${ic(r.icon || "user", 18)}${esc(r.text)}</span>`).join("")}</div>` : ""}
          ${s.items ? bullets(s.items) : ""}</div></div>`),
    statement: (s) => frame(`<div class="eyebrow">${esc(s.eyebrow || "")}</div><h2 style="max-width:1150px">${esc(s.title)}</h2>
      ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}${s.items ? bullets(s.items) : ""}${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}`),
    tiles: (s) => frame(`<div class="eyebrow">${esc(s.eyebrow || "")}</div><h2>${esc(s.title)}</h2>${s.lead ? `<p class="lead" style="margin-top:10px">${esc(s.lead)}</p>` : ""}
      <div class="grid" style="grid-template-columns:repeat(${s.cols || 3},1fr);margin-top:28px">${s.tiles.map((t) => `<div class="tile"><h3>${ic(t.icon || "user", 20)}${esc(t.title)}</h3>${t.who ? `<div class="who">${esc(t.who)}</div>` : ""}<p>${esc(t.text)}</p></div>`).join("")}</div>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}`),
    lifecycle: (s) => frame(`<div class="eyebrow">${esc(s.eyebrow || "How work moves")}</div><h2>${esc(s.title)}</h2>${s.lead ? `<p class="lead" style="margin-top:10px">${esc(s.lead)}</p>` : ""}
      <div class="flowbox" style="margin-top:26px"><div class="t">Sheet states · one transition table for every sheet</div>
        <div class="flow">${["planned", "in_progress", "ready_for_check", "in_check", "approved_for_issue", "issued"].map(chip).join(arrow)}</div>
        <div class="flow" style="margin-top:12px;font-size:14px;color:#556172">${chip("changes_requested")}<span>returns the sheet to the designer with redlines</span><span style="margin-left:18px"></span>${chip("superseded")}<span>older revisions, replaced automatically on issue</span></div>
        <div class="flow" style="margin-top:10px;font-size:14px;color:#556172">${chip("on_hold")}${chip("cancelled")}<span>project-lead decisions, always with a reason</span></div></div>
      <div class="flowbox" style="margin-top:16px"><div class="t">Fee stages · move as their sheets move</div>
        <div class="flow">${["planned", "active", "deliverables_issued", "client_approved", "ready_to_invoice", "invoiced", "closed"].map(stageChip).join(arrow)}</div></div>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}`),
    device: (s) => frame(`<div style="display:grid;grid-template-columns:1fr auto;gap:72px;align-items:center">
        <div><div class="eyebrow">${esc(s.eyebrow || "")}</div><h2>${esc(s.title)}</h2>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}${s.items ? bullets(s.items) : ""}</div>
        <div class="phone"><img src="${s.img}" alt=""></div></div>`),
    image: (s) => frame(`<div class="eyebrow">${esc(s.eyebrow || "")}</div><h2 style="font-size:32px;line-height:40px">${esc(s.title)}</h2>
        <img class="shot" src="${s.img}" style="margin-top:22px;max-width:100%;max-height:560px;width:${s.w || "auto"}">`),
  };
  window.WT_CARD = (spec) => (R[spec.type] || R.statement)(spec);
})();

/* DrawingOps demo · UI primitives (DESIGN.md §4): StatusChip, FlagPill, MetricCard, tables, dialogs,
   drawers, toasts with Undo, menus, tooltips, charts with "View as table", exports. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const { html, raw, icon, esc } = DO;

  // ---------- Event delegation: data-act / data-change / data-input / data-submit ----------
  const handlers = {};
  const on = (name, fn) => { handlers[name] = fn; };
  function dispatch(name, el, ev) {
    const fn = handlers[name];
    if (!fn) { console.warn("No handler for", name); return; }
    try { const r = fn(el, ev, el.dataset); if (r && typeof r.catch === "function") r.catch(showError); } catch (e) { showError(e); }
  }
  // Business-rule refusals are expected and shown as a toast; only programming errors go to the console.
  function showError(e) { if (e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError) console.error(e); toast({ title: "Not possible", description: e.message || String(e), tone: "bad" }); }
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (el && !el.disabled && el.getAttribute("aria-disabled") !== "true") { if (el.tagName === "A" || el.tagName === "BUTTON" || el.dataset.prevent !== undefined) ev.preventDefault(); dispatch(el.dataset.act, el, ev); return; }
    const row = ev.target.closest("tr[data-href]");
    if (row && !ev.target.closest("a,button,input,select,label,textarea")) { location.hash = row.dataset.href; }
  });
  document.addEventListener("change", (ev) => { const el = ev.target.closest("[data-change]"); if (el) dispatch(el.dataset.change, el, ev); });
  const debounced = {};
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]"); if (!el) return;
    const name = el.dataset.input; const ms = +(el.dataset.debounce || 0);
    if (!ms) return dispatch(name, el, ev);
    clearTimeout(debounced[name]); debounced[name] = setTimeout(() => dispatch(name, el, ev), ms);
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target.closest("form[data-submit]"); if (!f) return;
    ev.preventDefault();
    const data = {}; new FormData(f).forEach((v, k) => { if (k in data) data[k] = [].concat(data[k], v); else data[k] = v; });
    f.querySelectorAll("input[type=checkbox][name]").forEach((c) => { if (!c.checked && !(c.name in data)) data[c.name] = c.dataset.multi !== undefined ? [] : ""; });
    try { const r = handlers[f.dataset.submit]?.(f, data, ev); if (r && r.catch) r.catch(showError); } catch (e) { showError(e); }
  });
  document.addEventListener("keydown", (ev) => {
    const row = ev.target.closest?.("tr[data-href]");
    if (row && ev.key === "Enter" && ev.target === row) location.hash = row.dataset.href;
  });

  // ---------- Toasts (bottom-right, 5 s, Undo where possible) ----------
  let toastHost;
  function toast({ title, description, tone = "info", undo, action, timeout = 5000 }) {
    if (!toastHost) { toastHost = document.createElement("div"); toastHost.className = "toasts"; toastHost.setAttribute("role", "status"); toastHost.setAttribute("aria-live", "polite"); document.body.appendChild(toastHost); }
    const el = document.createElement("div"); el.className = `toast ${tone}`;
    el.innerHTML = String(html`<span class="${tone === "bad" ? "danger-t" : tone === "ok" ? "ok-t" : "primary-t"}">${icon(tone === "bad" ? "circle-alert" : tone === "ok" ? "circle-check" : "info", 18)}</span><div class="grow"><p class="tt">${title}</p>${description ? html`<p class="td">${description}</p>` : ""}</div>${undo ? html`<button class="btn sm" data-undo>Undo</button>` : ""}${action ? html`<button class="btn sm" data-action>${action.label}</button>` : ""}<button class="icon-btn" aria-label="Dismiss" data-close>${icon("x", 14)}</button>`);
    const close = () => el.remove();
    el.querySelector("[data-close]").onclick = close;
    if (undo) el.querySelector("[data-undo]").onclick = () => { undo(); close(); toast({ title: "Undone", tone: "ok", timeout: 2500 }); };
    if (action) el.querySelector("[data-action]").onclick = () => { action.run(); close(); };
    toastHost.appendChild(el);
    if (timeout) setTimeout(close, undo ? Math.max(timeout, 7000) : timeout);
  }

  // ---------- Dialogs and drawers ----------
  const layers = [];
  function trapFocus(el) {
    const f = () => [...el.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex='0']")].filter((x) => x.offsetParent !== null);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); closeTop(); }
      if (e.key !== "Tab") return; const list = f(); if (!list.length) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    setTimeout(() => { const auto = el.querySelector("[autofocus]") || f().find((x) => !x.matches("[data-close]")) || f()[0]; auto?.focus(); }, 30);
  }
  function closeTop() { const l = layers.pop(); if (l) { l.el.remove(); l.onClose?.(); l.prev?.focus?.(); } }
  function closeAll() { while (layers.length) closeTop(); }
  /** opts: { title, body (html), foot (html), wide, onClose, mount(el) } → { el, close } */
  function dialog(opts) {
    const prev = document.activeElement;
    const el = document.createElement("div"); el.className = "overlay";
    el.innerHTML = String(html`<div class="dialog ${opts.size || ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dialog-head"><div><h2 id="dlg-t">${opts.title}</h2>${opts.subtitle ? html`<p class="small muted mt-1">${opts.subtitle}</p>` : ""}</div><button class="icon-btn" data-close aria-label="Close">${icon("x", 18)}</button></div><div class="dialog-body">${opts.body}</div>${opts.foot ? html`<div class="dialog-foot">${opts.foot}</div>` : ""}</div>`);
    el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
    el.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); close(); }));
    document.body.appendChild(el);
    const layer = { el, onClose: opts.onClose, prev }; layers.push(layer);
    function close() { const i = layers.indexOf(layer); if (i >= 0) { layers.splice(i, 1); el.remove(); opts.onClose?.(); prev?.focus?.(); } }
    trapFocus(el); opts.mount?.(el, close);
    return { el, close };
  }
  function drawer(opts) {
    const prev = document.activeElement;
    const el = document.createElement("div"); el.className = "drawer-wrap";
    el.innerHTML = String(html`<aside class="drawer ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="drw-t"><div class="drawer-head"><div><h2 id="drw-t">${opts.title}</h2>${opts.subtitle ? html`<p class="small muted">${opts.subtitle}</p>` : ""}</div><button class="icon-btn" data-close aria-label="Close">${icon("x", 18)}</button></div><div class="drawer-body">${opts.body}</div>${opts.foot ? html`<div class="drawer-foot">${opts.foot}</div>` : ""}</aside>`);
    el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
    el.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); close(); }));
    document.body.appendChild(el);
    const layer = { el, onClose: opts.onClose, prev }; layers.push(layer);
    function close() { const i = layers.indexOf(layer); if (i >= 0) { layers.splice(i, 1); el.remove(); opts.onClose?.(); prev?.focus?.(); } }
    trapFocus(el); opts.mount?.(el, close);
    return { el, close };
  }
  /** ConfirmDialog: the title states the action, the body lists consequences, the button repeats the verb. */
  function confirm({ title, body, confirm: verb = "Confirm", danger, reason, reasonLabel = "Reason", reasonRequired }) {
    return new Promise((resolve) => {
      let done = false;
      const d = dialog({
        title,
        body: html`<div class="stack-2">${typeof body === "string" ? html`<p>${body}</p>` : body}${reason ? html`<div class="field mt-3"><label for="cf-r">${reasonLabel}${reasonRequired ? "" : " (optional)"}</label><textarea id="cf-r" class="textarea" rows="3"></textarea><p class="err" id="cf-e" hidden>${icon("circle-alert", 14)} A reason is required.</p></div>` : ""}</div>`,
        foot: html`<button class="btn" data-close>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" id="cf-ok">${verb}</button>`,
        onClose: () => { if (!done) resolve(null); },
        mount: (el, close) => {
          el.querySelector("#cf-ok").onclick = () => {
            const r = el.querySelector("#cf-r")?.value.trim() || "";
            if (reason && reasonRequired && !r) { el.querySelector("#cf-e").hidden = false; el.querySelector("#cf-r").setAttribute("aria-invalid", "true"); return; }
            done = true; close(); resolve({ reason: r });
          };
        },
      });
      return d;
    });
  }

  // ---------- Menus and tooltips ----------
  let openMenu = null;
  function menu(anchor, items, opts = {}) {
    closeMenu();
    const el = document.createElement("div"); el.className = "menu"; el.setAttribute("role", "menu");
    el.innerHTML = items.map((it) => (it === "-" ? "<hr>" : it.label && !it.run && !it.href ? `<p class="ml">${esc(it.label)}</p>` : `<${it.href ? `a href="${esc(it.href)}"` : "button type=\"button\""} class="mi ${it.on ? "on" : ""} ${it.danger ? "danger" : ""}" role="menuitem">${it.icon ? icon(it.icon, 15) : ""}<span class="grow">${esc(it.text)}</span>${it.hint ? `<span class="small muted">${esc(it.hint)}</span>` : ""}</${it.href ? "a" : "button"}>`)).join("");
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(); const w = el.offsetWidth; const h = el.offsetHeight;
    let left = opts.align === "start" ? r.left : r.right - w; left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    el.style.left = `${left}px`; el.style.top = `${top}px`;
    const btns = [...el.querySelectorAll(".mi")]; const real = items.filter((it) => it !== "-" && (it.run || it.href));
    btns.forEach((b, i) => b.addEventListener("click", () => { closeMenu(); real[i].run?.(); }));
    el.addEventListener("keydown", (e) => { const i = btns.indexOf(document.activeElement); if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); } if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); } if (e.key === "Escape") { closeMenu(); anchor.focus(); } });
    anchor.setAttribute("aria-expanded", "true");
    openMenu = { el, anchor }; setTimeout(() => btns[0]?.focus(), 10);
  }
  function closeMenu() { if (openMenu) { openMenu.el.remove(); openMenu.anchor.setAttribute("aria-expanded", "false"); openMenu = null; } }
  document.addEventListener("mousedown", (e) => { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.anchor.contains(e.target)) closeMenu(); });
  let tip;
  function showTip(el) { const t = el.dataset.tip; if (!t) return; hideTip(); tip = document.createElement("div"); tip.className = "tooltip"; tip.textContent = t; document.body.appendChild(tip); const r = el.getBoundingClientRect(); const w = tip.offsetWidth; tip.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))}px`; tip.style.top = `${r.bottom + 6 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6}px`; }
  function hideTip() { tip?.remove(); tip = null; }
  document.addEventListener("mouseover", (e) => { const el = e.target.closest?.("[data-tip]"); if (el) showTip(el); else hideTip(); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-tip]"); if (el) showTip(el); else hideTip(); });
  document.addEventListener("scroll", hideTip, true);

  // ---------- Status components ----------
  const STATES = {
    planned: ["Planned", "circle-dashed"], in_progress: ["In progress", "pencil"], ready_for_check: ["Ready for check", "send"], in_check: ["In check", "search-check"], changes_requested: ["Changes requested", "undo-2"], approved_for_issue: ["Approved for issue", "badge-check"], issued: ["Issued", "send-horizontal"], superseded: ["Superseded", "archive"], on_hold: ["On hold", "pause"], cancelled: ["Cancelled", "circle-x"],
  };
  const FLAGS = { at_risk: ["At risk", "clock-alert"], late: ["Late", "alarm-clock-off"], over_allocated: ["Over-allocated", "trending-up"], under_allocated: ["Under-allocated", "trending-down"], timesheet_missing: ["Hours missing", "timer-off"], ready_to_invoice: ["Ready to invoice", "receipt-indian-rupee"] };
  const tone = (k) => `color:var(--state-${k}-fg);background:var(--state-${k}-bg);border-color:color-mix(in srgb,var(--state-${k}-fg) 30%,transparent)`;
  /** StatusChip: colour + icon + word, never colour alone (N-04). */
  function chip(state, revCode, lg) {
    const [lbl, ic] = STATES[state] || [state, "circle"];
    return html`<span class="chip ${lg ? "lg" : ""}" style="${tone(state)}">${icon(ic, lg ? 16 : 14)}<span class="sr-only">State: </span><span class="${state === "superseded" ? "strike" : ""}">${lbl}</span>${state === "issued" && revCode ? html`<span aria-hidden="true">·</span><span class="mono">${revCode}</span>` : ""}</span>`;
  }
  const STAGE = { planned: ["Planned", "planned"], active: ["Active", "in_progress"], deliverables_issued: ["Deliverables issued", "issued"], client_approved: ["Client approved", "approved_for_issue"], ready_to_invoice: ["Ready to invoice", "approved_for_issue"], invoiced: ["Invoiced", "issued"], closed: ["Closed", "superseded"], on_hold: ["On hold", "on_hold"] };
  function stageChip(state) { const [lbl, t] = STAGE[state] || [state, "planned"]; return html`<span class="chip" style="${tone(t)}"><span class="sr-only">Stage: </span>${lbl}</span>`; }
  function flag(kind, text, detail) { const [lbl, ic] = FLAGS[kind]; return html`<span class="flag" style="color:var(--flag-${kind}-fg);background:var(--flag-${kind}-bg)" ${detail ? raw(`tabindex="0" data-tip="${esc(detail)}"`) : ""}>${icon(ic, 14)}<span class="sr-only">Flag: ${lbl}. </span>${text}</span>`; }
  function sheetFlags(s) { return DO.store.flagsFor(s).map((f) => flag(f.kind, f.text, f.detail)); }
  function sheetStatus(s) { const c = DO.store.currentRev(s); return html`<span class="iflex items-center gap-2 wrap">${chip(s.state, c?.code)}${sheetFlags(s)}</span>`; }
  function forecastChip(risk) { if (!risk) return ""; return html`<span class="pill forecast" data-tip="${`Forecast (advisory): ${risk.reasons.join("; ")}. Never changes data.`}" tabindex="0">${icon("sparkles", 12)} Late risk ${risk.prob}%</span>`; }
  const avatar = (name, cls = "") => html`<span class="avatar ${cls}" aria-hidden="true">${DO.initials(name)}</span>`;
  const mono = (t) => html`<span class="mono">${t}</span>`;

  // ---------- Layout pieces ----------
  function pageHead({ title, meta, actions, crumbs }) {
    return html`<header class="page-head"><div class="min-w-0">${crumbs ? html`<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => html`${i ? icon("chevron-right", 12) : ""}${c.href ? html`<a href="${c.href}">${c.label}</a>` : html`<span>${c.label}</span>`}`)}</nav>` : ""}<h1 class="display">${title}</h1>${meta ? html`<p class="meta">${meta}</p>` : ""}</div>${actions ? html`<div class="actions">${actions}</div>` : ""}</header>`;
  }
  function card({ title, actions, body, foot, cls = "", id, h = "h2" }) {
    return html`<section class="card ${cls}" ${id ? raw(`id="${id}"`) : ""}>${title || actions ? html`<div class="card-head">${title ? raw(`<${h}>${esc(title)}</${h}>`) : ""}${actions ? html`<div class="actions">${actions}</div>` : ""}</div>` : ""}${body}${foot ? html`<div class="card-foot">${foot}</div>` : ""}</section>`;
  }
  function metric({ label, value, delta, upIsBad = true, href, hint, icon: ic, act, data }) {
    const deltaEl = delta === undefined || delta === null ? "" : delta === 0 ? html`<span class="small muted">Same as last week</span>` : html`<span class="delta" style="color:${(delta > 0) === upIsBad ? "var(--flag-late-fg)" : "var(--state-issued-fg)"}">${icon(delta > 0 ? "trending-up" : "trending-down", 14)}${delta > 0 ? `+${delta}` : delta} on last week</span>`;
    const inner = html`<span class="lbl">${ic ? icon(ic, 14) : ""}${label}</span><span class="metric-n">${value}</span>${deltaEl}${hint ? html`<span class="small muted">${hint}</span>` : ""}${href || act ? html`<span class="sr-only">Open the list</span>` : ""}`;
    if (href) return html`<a class="metric motion" href="${href}">${inner}</a>`;
    if (act) return html`<button class="metric motion" data-act="${act}" ${raw(Object.entries(data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" "))}>${inner}</button>`;
    return html`<div class="metric">${inner}</div>`;
  }
  function empty(message, action) { return html`<div class="empty"><p>${message}</p>${action || ""}</div>`; }
  function btn(label, o = {}) {
    const a = { class: `btn ${o.variant || ""} ${o.size || ""} ${o.cls || ""}`.trim(), type: o.type || "button", "data-act": o.act, title: o.title, disabled: o.disabled, "aria-label": o.aria, id: o.id };
    Object.entries(o.data || {}).forEach(([k, v]) => { a[`data-${k}`] = v; });
    return html`<button ${DO.attrs(a)}>${o.icon ? icon(o.icon, o.size === "sm" ? 14 : 16) : ""}${label}</button>`;
  }
  const linkBtn = (label, href, o = {}) => html`<a class="btn ${o.variant || ""} ${o.size || ""}" href="${href}" ${o.download ? raw(`download="${esc(o.download)}"`) : ""} ${o.target ? raw('target="_blank" rel="noopener"') : ""}>${o.icon ? icon(o.icon, o.size === "sm" ? 14 : 16) : ""}${label}</a>`;
  function select(o) {
    const opts = o.options.map((op) => { const [v, l] = Array.isArray(op) ? op : [op.value, op.label]; return html`<option value="${v}" ${String(v) === String(o.value ?? "") ? raw("selected") : ""}>${l}</option>`; });
    return html`<select ${DO.attrs({ class: `select ${o.cls || ""}`, id: o.id, name: o.name, "data-change": o.change, "aria-label": o.aria, required: o.required, disabled: o.disabled, ...(o.dataset ? Object.fromEntries(Object.entries(o.dataset).map(([k, v]) => [`data-${k}`, v])) : {}) })}>${o.placeholder !== undefined ? html`<option value="">${o.placeholder}</option>` : ""}${opts}</select>`;
  }
  function field(labelText, control, o = {}) { return html`<div class="field ${o.cls || ""}"><label ${o.for ? raw(`for="${o.for}"`) : ""}>${labelText}</label>${control}${o.hint ? html`<p class="hint">${o.hint}</p>` : ""}${o.error ? html`<p class="err">${icon("circle-alert", 14)}${o.error}</p>` : ""}</div>`; }
  function tabs(items, active, label = "Sections") { return html`<nav class="tabs" aria-label="${label}">${items.map((t) => html`<a href="${t.href}" class="${t.key === active ? "active" : ""}" ${t.key === active ? raw('aria-current="page"') : ""}>${t.label}${t.count !== undefined && t.count !== null ? html`<span class="count">${t.count}</span>` : ""}</a>`)}</nav>`; }
  function seg(name, options, value, act) { return html`<div class="seg" role="group" aria-label="${name}">${options.map(([v, l]) => html`<button type="button" class="${String(v) === String(value) ? "on" : ""}" aria-pressed="${String(v) === String(value)}" data-act="${act}" data-v="${v}">${l}</button>`)}</div>`; }
  function sortTh(label, key, sort, act, cls = "") { const on = sort.key === key; return html`<th scope="col" class="${cls}" aria-sort="${on ? (sort.dir > 0 ? "ascending" : "descending") : "none"}"><button class="sort" data-act="${act}" data-key="${key}">${label}${icon(on ? (sort.dir > 0 ? "arrow-up" : "arrow-down") : "arrow-up-down", 12)}</button></th>`; }
  function pager(total, page, size, act) {
    const pages = Math.max(1, Math.ceil(total / size)); const from = total ? (page - 1) * size + 1 : 0; const to = Math.min(total, page * size);
    return html`<div class="pager"><span>${from}–${to} of ${DO.fmtNum(total)}</span><span class="flex items-center gap-2"><label class="flex items-center gap-1">Rows ${select({ options: [[25, "25"], [50, "50"], [100, "100"], [250, "250"]], value: size, change: `${act}-size`, cls: "sm", aria: "Rows per page" })}</label>${btn("", { size: "sm", icon: "chevron-left", act, data: { p: page - 1 }, disabled: page <= 1, aria: "Previous page" })}<span>Page ${page} of ${pages}</span>${btn("", { size: "sm", icon: "chevron-right", act, data: { p: page + 1 }, disabled: page >= pages, aria: "Next page" })}</span></div>`;
  }
  const bar = (pct, cls = "") => html`<span class="bar ${cls}" style="width:96px" aria-hidden="true"><span style="width:${DO.clamp(pct, 0, 100)}%"></span></span>`;

  // ---------- Charts (SVG, tokens only) ----------
  /** series: [{ label, color, dash, points: [[x, y]] }] where x is a date string. */
  function lineChart({ series, height = 220, todayX, yLabel = "", id = "ch" }) {
    const W = 640; const H = height; const L = 40; const R = 12; const T = 10; const B = 26;
    const xs = series.flatMap((s) => s.points.map((p) => p[0])); if (!xs.length) return empty("No data for this range yet.");
    const minX = xs.reduce((a, b) => (a < b ? a : b)); const maxX = xs.reduce((a, b) => (a > b ? a : b));
    const span = Math.max(1, DO.diffDays(minX, maxX)); const maxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p[1])));
    const niceMax = Math.ceil(maxY / 10) * 10 || 10;
    const X = (d) => L + ((W - L - R) * DO.diffDays(minX, d)) / span; const Y = (v) => T + (H - T - B) * (1 - v / niceMax);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => html`<line class="grid-l" x1="${L}" x2="${W - R}" y1="${Y(niceMax * f)}" y2="${Y(niceMax * f)}"/><text x="${L - 6}" y="${Y(niceMax * f) + 4}" text-anchor="end">${Math.round(niceMax * f)}</text>`);
    const ticks = Array.from({ length: 6 }, (_, i) => DO.addDays(minX, Math.round((span * i) / 5))).map((d) => html`<text x="${X(d)}" y="${H - 8}" text-anchor="middle">${DO.fmtShort(d)}</text>`);
    const lines = series.map((s) => html`<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? raw('stroke-dasharray="6 4"') : ""} points="${s.points.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}"/>`);
    const tmark = todayX && todayX >= minX && todayX <= maxX ? html`<line x1="${X(todayX)}" x2="${X(todayX)}" y1="${T}" y2="${H - B}" stroke="var(--text-muted)" stroke-dasharray="2 3"/><text x="${X(todayX) + 4}" y="${T + 10}">Today</text>` : "";
    return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">${yLabel}</title>${grid}${ticks}${lines}${tmark}</svg>`;
  }
  /** Vertical bar chart: items [{ label, value, color?, href? }]. */
  function barChart({ items, height = 200, unit = "", max }) {
    const W = 640; const H = height; const L = 36; const B = 28; const T = 10;
    const m = max || Math.max(1, ...items.map((i) => i.value)); const bw = (W - L - 8) / Math.max(1, items.length);
    const Y = (v) => T + (H - T - B) * (1 - v / m);
    return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><title>Bar chart</title>${[0, 0.5, 1].map((f) => html`<line class="grid-l" x1="${L}" x2="${W}" y1="${Y(m * f)}" y2="${Y(m * f)}"/><text x="${L - 6}" y="${Y(m * f) + 4}" text-anchor="end">${Math.round(m * f)}${unit}</text>`)}${items.map((it, i) => { const x = L + i * bw + bw * 0.18; const w = bw * 0.64; const rect = html`<rect x="${x}" y="${Y(it.value)}" width="${w}" height="${Math.max(0, H - B - Y(it.value))}" rx="3" fill="${it.color || "var(--chart-1)"}"><title>${it.label}: ${it.value}${unit}</title></rect><text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${it.label}</text><text x="${x + w / 2}" y="${Y(it.value) - 4}" text-anchor="middle" style="fill:var(--text)">${it.value}${unit}</text>`; return it.href ? html`<a href="${it.href}">${rect}</a>` : rect; })}</svg>`;
  }
  /** A chart and its table, with a "View as table" toggle (DESIGN.md §8). */
  function chartBox(id, chartHtml, tableHtml, legendHtml) {
    const asTable = DO.ui.state[`tbl:${id}`];
    return html`<div class="card-body"><div class="flex between items-center wrap gap-2 mb-2">${legendHtml || html`<span></span>`}<button class="btn sm ghost" data-act="toggle-chart-table" data-id="${id}" aria-pressed="${!!asTable}">${icon(asTable ? "chart-column" : "list", 14)}${asTable ? "View as chart" : "View as table"}</button></div>${asTable ? html`<div class="t-wrap">${tableHtml}</div>` : chartHtml}</div>`;
  }
  on("toggle-chart-table", (el) => { DO.ui.state[`tbl:${el.dataset.id}`] = !DO.ui.state[`tbl:${el.dataset.id}`]; DO.app.render(); });

  // ---------- Files: open / download generated PDFs and exports ----------
  const firm = () => DO.store.S.org;
  function revisionPdf(rv, o = {}) {
    const st = DO.store; const s = st.sheet(rv.sheetId); const p = st.project(s.projectId); const stg = st.stage(rv.stageId || s.stageId);
    const all = st.revisionsOf(s.id).slice().reverse().filter((v) => v.seq <= rv.seq);
    return DO.drawing.sheetPdf({ firm: firm(), project: { code: p.code, name: p.name, client: p.client, type: p.type }, sheet: { number: s.number, title: s.title, discipline: s.discipline, cadLink: s.cadLink }, revision: rv, revisions: all.map((v) => ({ ...v, purposeLabel: v.state === "draft" ? "Check print" : st.purposeLabel(v.purpose), byName: st.userName(v.issuedBy || v.uploadedBy) })), owner: st.shortName(s.ownerId), checker: st.shortName(s.checkerId), disciplineName: st.disc(s.discipline)?.name, stageName: stg ? `${stg.seq} ${stg.name}` : "", purposeLabel: st.purposeLabel(rv.purpose), superseded: o.watermark && rv.state === "superseded" ? { date: DO.fmtDate(rv.supersededAt), by: st.revisionsOf(s.id).find((v) => v.seq > rv.seq && v.issuedAt)?.code } : null });
  }
  /** Blob for a revision: the uploaded file this session, else the generated drawing. F-48 watermark on superseded downloads. */
  function revisionBlob(rv, watermark) {
    const f = DO.store.files.get(rv.id);
    if (f && !(watermark && rv.state === "superseded")) return f;
    return new Blob([revisionPdf(rv, { watermark })], { type: "application/pdf" });
  }
  const urls = new Map();
  function revisionUrl(rv, watermark = true) { const k = `${rv.id}:${rv.state}:${watermark}:${DO.store.files.has(rv.id)}`; if (!urls.has(k)) urls.set(k, URL.createObjectURL(revisionBlob(rv, watermark))); return urls.get(k); }
  function downloadRevision(rv) {
    const s = DO.store.sheet(rv.sheetId);
    DO.download(revisionBlob(rv, true), rv.state === "superseded" ? `${s.number}_${rv.code}_SUPERSEDED.pdf` : rv.fileName || `${s.number}_${rv.code}.pdf`);
    rv.downloads = (rv.downloads || 0) + 1;
    DO.store.audit("revision", rv.id, "download", null, { watermarked: rv.state === "superseded" }, { projectId: s.projectId, text: `${DO.store.userName(DO.store.actorId)} downloaded ${s.number} ${rv.code}${rv.state === "superseded" ? " (SUPERSEDED watermark)" : ""}` });
    DO.store.save();
  }
  function exportTable({ name, title, subtitle, columns, rows, format, landscape, headerLines, footnotes }) {
    const stamp = DO.today();
    if (format === "xlsx") DO.download(new Blob([DO.zip.xlsx([{ name: title.slice(0, 31), rows: [columns.map((c) => c.label), ...rows] }])], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}_${stamp}.xlsx`);
    else if (format === "csv") DO.download(DO.csv([columns.map((c) => c.label), ...rows]), `${name}_${stamp}.csv`, "text/csv");
    else DO.download(new Blob([DO.drawing.tablePdf({ firm: firm(), title, subtitle, columns, rows, landscape, headerLines, footnotes })], { type: "application/pdf" }), `${name}_${stamp}.pdf`);
    DO.store.audit("export", name, "export", null, { rows: rows.length, format }, { text: `${DO.store.userName(DO.store.actorId)} exported ${title} (${rows.length} rows, ${format.toUpperCase()})` });
    DO.store.save();
    toast({ title: `Exported ${DO.plural(rows.length, "row")}`, description: `${title} · ${format.toUpperCase()} with the current filters.`, tone: "ok" });
  }
  /** Export button with a format menu (F-52); big exports become background jobs. */
  function exportMenu(el, build) {
    menu(el, [{ label: "Export with current filters" }, { text: "Excel (.xlsx)", icon: "file-spreadsheet", run: () => runExport(build, "xlsx") }, { text: "PDF", icon: "file-text", run: () => runExport(build, "pdf") }, { text: "CSV", icon: "file-text", run: () => runExport(build, "csv") }]);
  }
  function runExport(build, format) {
    const spec = build(); if (spec.rows.length > 5000) { DO.app.backgroundExport(spec, format); return; }
    exportTable({ ...spec, format });
  }
  function pickFile({ accept = "", multiple = false } = {}) {
    return new Promise((resolve) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = multiple; i.style.display = "none"; i.onchange = () => { resolve([...i.files]); i.remove(); }; document.body.appendChild(i); i.click(); });
  }

  DO.ui = { state: {}, on, toast, dialog, drawer, confirm, closeTop, closeAll, menu, closeMenu, showError };
  DO.C = { chip, stageChip, flag, sheetFlags, sheetStatus, forecastChip, avatar, mono, pageHead, card, metric, empty, btn, linkBtn, select, field, tabs, seg, sortTh, pager, bar, lineChart, barChart, chartBox, revisionPdf, revisionBlob, revisionUrl, downloadRevision, exportTable, exportMenu, pickFile, STATES, STAGE };
})(window);

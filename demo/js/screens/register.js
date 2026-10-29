/* DrawingOps demo · drawing register (S-05: F-04, F-46, F-49, F-52), new sheet, import wizard (S-12: F-05,
   I-01), PDF upload with name and title-block matching (F-06, F-35, F-50, A-04) and CAD sync (F-09). */
(function (root) {
  "use strict";
  const DO = root.DO; const { html, raw, icon, C } = DO; const st = DO.store; const ui = DO.ui;
  const S = DO.screens = DO.screens || {};
  const COLS = [["disc", "Discipline"], ["stage", "Stage"], ["package", "Package"], ["owner", "Owner"], ["checker", "Checker"], ["planned", "Planned"], ["rev", "Rev"], ["flags", "Flags"]];
  const sel = (pid) => (ui.state[`sel:${pid}`] = ui.state[`sel:${pid}`] || new Set());
  const cols = () => (ui.state.regCols = ui.state.regCols || new Set(["disc", "owner", "checker", "planned", "rev", "flags", "package"]));
  const canPlan = (u, p, d) => st.isPL(u, p) || st.isDL(u, p, d);

  function filtered(p, q) {
    let list = st.sheetsOf(p.id).slice();
    const states = [].concat(q.state || []);
    if (q.disc) list = list.filter((s) => s.discipline === q.disc);
    if (q.stage) list = list.filter((s) => s.stageId === q.stage);
    if (states.length) list = list.filter((s) => states.includes(s.state));
    if (q.owner) list = list.filter((s) => s.ownerId === q.owner);
    if (q.pkg) list = list.filter((s) => (q.pkg === "none" ? !s.packageId : s.packageId === q.pkg));
    if (q.flag === "late" || q.late) list = list.filter(st.isLate);
    if (q.flag === "at_risk" || q.risk) list = list.filter(st.isAtRisk);
    if (!q.showClosed && !states.includes("cancelled") && !states.includes("superseded")) list = list.filter((s) => !["cancelled", "superseded"].includes(s.state) || q.q);
    if (q.q) { const t = q.q.toLowerCase().replace(/\s+/g, " "); list = list.filter((s) => `${s.number} ${s.number.replace("-", "")} ${s.title} ${(s.aliases || []).join(" ")} ${st.userName(s.ownerId)}`.toLowerCase().includes(t)); }
    const sort = { key: q.sort || "number", dir: q.dir === "-1" ? -1 : 1 };
    const key = { number: (s) => s.number, title: (s) => s.title, owner: (s) => st.userName(s.ownerId), state: (s) => Object.keys(C.STATES).indexOf(s.state), planned: (s) => st.effPlanned(s) || "9999", rev: (s) => st.currentRev(s)?.code || "", disc: (s) => s.discipline }[sort.key] || ((s) => s.number);
    list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * sort.dir);
    return { list, sort };
  }
  DO.registerFiltered = filtered;

  S.register = (ctx, u) => {
    const p = ctx.project; const q = ctx.query; const { list, sort } = filtered(p, q);
    const selection = sel(p.id); [...selection].forEach((id) => { if (!st.sheet(id)) selection.delete(id); });
    const planner = st.isPL(u, p) || p.members.some((m) => m.userId === u.id && m.role === "DL");
    const issuer = st.isPL(u, p) || st.isDC(u, p);
    const c = cols(); const page = +(q.p || 1); const size = +(ui.state.regSize || 100); const group = q.group || "";
    const stages = st.stagesOf(p.id); const pkgs = st.packagesOf(p.id);
    const owners = [...new Set(st.sheetsOf(p.id).map((s) => s.ownerId))].map((id) => st.user(id)).filter(Boolean).sort(DO.by("name"));
    const views = st.S.savedViews.filter((v) => v.userId === u.id && v.projectId === p.id);
    const states = [].concat(q.state || []);
    const pageRows = list.slice((page - 1) * size, page * size);
    ui.state.regPage = { pid: p.id, ids: pageRows.map((s) => s.id), all: list.map((s) => s.id) };
    const focusIdx = ui.state.regFocus ?? -1;
    const designersFor = (s) => [...new Map(p.members.filter((m) => ["Designer", "DL", "PL"].includes(m.role) && (!m.discipline || m.discipline === s.discipline)).map((m) => [m.userId, st.user(m.userId)])).values()];
    const checkersFor = (s) => [...new Map(p.members.filter((m) => ["DL", "SR", "PL"].includes(m.role) && (!m.discipline || m.discipline === s.discipline)).map((m) => [m.userId, st.user(m.userId)])).values()];
    const row = (s, i) => {
      const edit = canPlan(u, p, s.discipline) && !["issued", "superseded", "cancelled"].includes(s.state);
      const editAny = canPlan(u, p, s.discipline);
      const cur = st.currentRev(s); const draft = st.draftOf(s); const pk = s.packageId ? st.pkg(s.packageId) : null;
      return html`<tr class="clickable ${selection.has(s.id) ? "sel" : ""} ${focusIdx === i ? "focus" : ""}" data-href="#/projects/${p.id}/sheets/${s.id}" data-i="${i}" tabindex="${focusIdx === i ? 0 : -1}" aria-selected="${selection.has(s.id)}">
        <td class="cb"><input type="checkbox" aria-label="Select ${s.number}" ${selection.has(s.id) ? raw("checked") : ""} data-act="reg-sel" data-id="${s.id}" data-i="${i}" data-prevent></td>
        <td class="sticky-c"><a class="mono strong hover-u" href="#/projects/${p.id}/sheets/${s.id}">${s.number}</a>${s.aliases?.length ? html`<span class="small muted block">was ${s.aliases.join(", ")}</span>` : ""}</td>
        <td style="min-width:200px"><span class="${s.state === "superseded" ? "strike" : ""}">${s.title}</span></td>
        ${c.has("disc") ? html`<td class="hide-sm" data-tip="${st.disc(s.discipline)?.name}">${s.discipline}</td>` : ""}
        ${c.has("stage") ? html`<td class="hide-md small">${st.stage(s.stageId)?.seq} ${st.stage(s.stageId)?.name}</td>` : ""}
        ${c.has("package") ? html`<td class="hide-md">${edit ? html`<select class="cell" aria-label="Package for ${s.number}" data-change="reg-inline" data-id="${s.id}" data-k="packageId"><option value="">—</option>${pkgs.filter((x) => x.discipline === s.discipline).map((x) => html`<option value="${x.id}" ${x.id === s.packageId ? raw("selected") : ""}>${x.name}</option>`)}</select>` : html`<span class="small">${pk?.name || "—"}</span>`}</td>` : ""}
        ${c.has("owner") ? html`<td class="hide-sm nowrap">${edit ? html`<select class="cell" aria-label="Owner of ${s.number}" data-change="reg-inline" data-id="${s.id}" data-k="ownerId">${designersFor(s).map((x) => html`<option value="${x.id}" ${x.id === s.ownerId ? raw("selected") : ""}>${DO.short(x.name)}</option>`)}${designersFor(s).some((x) => x.id === s.ownerId) ? "" : html`<option value="${s.ownerId}" selected>${st.shortName(s.ownerId)}</option>`}</select>` : st.shortName(s.ownerId)}</td>` : ""}
        ${c.has("checker") ? html`<td class="hide-md nowrap">${edit ? html`<select class="cell" aria-label="Checker of ${s.number}" data-change="reg-inline" data-id="${s.id}" data-k="checkerId">${checkersFor(s).map((x) => html`<option value="${x.id}" ${x.id === s.checkerId ? raw("selected") : ""}>${DO.short(x.name)}</option>`)}${checkersFor(s).some((x) => x.id === s.checkerId) ? "" : html`<option value="${s.checkerId}" selected>${st.shortName(s.checkerId)}</option>`}</select>` : st.shortName(s.checkerId)}</td>` : ""}
        <td>${C.chip(s.state, cur?.code)}</td>
        ${c.has("planned") ? html`<td class="hide-sm nowrap">${editAny && s.state !== "cancelled" ? html`<input type="date" class="cell" style="max-width:138px" aria-label="Planned issue date for ${s.number}" value="${s.planned || ""}" data-change="reg-inline" data-id="${s.id}" data-k="planned" title="${!s.planned && pk ? `Inherits ${DO.fmtDate(pk.date)} from ${pk.name}` : ""}">${!s.planned && pk ? html`<span class="small muted block">pkg ${DO.fmtShort(pk.date)}</span>` : ""}` : DO.plannedCell(s)}</td>` : ""}
        ${c.has("rev") ? html`<td class="hide-sm">${cur ? C.mono(cur.code) : "—"}${draft ? html` <span class="small muted" data-tip="Draft ${draft.code}${draft.namingStatus === "blocked" ? ": blocked by the naming rule" : ""}">+${draft.code}${draft.namingStatus === "blocked" ? icon("triangle-alert", 12, "danger-t") : ""}</span>` : ""}</td>` : ""}
        ${c.has("flags") ? html`<td class="hide-sm"><span class="flex gap-1 wrap">${C.sheetFlags(s)}</span></td>` : ""}
      </tr>`;
    };
    let body;
    if (group) {
      const keyOf = { discipline: (s) => `${s.discipline} · ${st.disc(s.discipline)?.name}`, package: (s) => (s.packageId ? st.pkg(s.packageId)?.name : "No package"), stage: (s) => { const x = st.stage(s.stageId); return `${x.seq} ${x.name}`; } }[group];
      const groups = DO.groupBy(pageRows, keyOf); let i = 0;
      body = Object.entries(groups).map(([k, rows]) => html`<tr class="group-row"><td colspan="20">${k} · ${rows.length} sheets · ${rows.filter((s) => s.state === "issued").length} issued${rows.filter(st.isLate).length ? ` · ${rows.filter(st.isLate).length} late` : ""}</td></tr>${rows.map((s) => row(s, i++))}`);
    } else body = pageRows.map(row);
    const allOnPage = pageRows.length && pageRows.every((s) => selection.has(s.id));
    return html`
      <div class="flex between items-center wrap gap-2 mb-3"><div class="flex items-center gap-2 wrap"><h2 class="title">Register</h2><span class="small muted">${DO.plural(list.length, "sheet")}${list.length !== st.sheetsOf(p.id).length ? ` of ${st.sheetsOf(p.id).length}` : ""} · rendered in ${ui.state.regMs || 1} ms</span></div>
        <div class="actions">${planner ? html`${C.linkBtn("Import Excel", `#/projects/${p.id}/import`, { icon: "file-spreadsheet" })}${C.linkBtn("CAD sync", `#/projects/${p.id}/cad-sync`, { icon: "refresh-ccw-dot" })}` : ""}${planner || issuer ? C.linkBtn("Upload PDFs", `#/projects/${p.id}/upload`, { icon: "cloud-upload" }) : ""}${issuer ? C.linkBtn("Issue…", `#/projects/${p.id}/issue`, { icon: "send-horizontal" }) : ""}${planner ? C.btn("Sheet", { variant: "primary", icon: "plus", act: "reg-new", data: { p: p.id } }) : ""}${C.btn("Export", { icon: "download", act: "reg-export", data: { p: p.id } })}</div></div>
      <div class="filterbar" role="search">
        <div class="search-box">${icon("search", 14)}<input id="reg-q" class="input" placeholder="Number, title, alias or owner" value="${q.q || ""}" data-input="reg-q" data-debounce="150" aria-label="Search the register"></div>
        ${C.select({ options: [["", "All disciplines"], ...[...new Set(st.sheetsOf(p.id).map((s) => s.discipline))].map((d) => [d, `${d} · ${st.disc(d)?.name}`])], value: q.disc, change: "reg-f", dataset: { k: "disc" }, aria: "Discipline" })}
        ${C.select({ options: [["", "All stages"], ...stages.map((x) => [x.id, `${x.seq} ${x.name}`])], value: q.stage, change: "reg-f", dataset: { k: "stage" }, aria: "Stage" })}
        ${C.select({ options: [["", "All states"], ...Object.entries(C.STATES).map(([k, [l]]) => [k, l])], value: states.length === 1 ? states[0] : "", change: "reg-f", dataset: { k: "state" }, aria: "State" })}
        ${C.select({ options: [["", "Any owner"], ...owners.map((x) => [x.id, x.name])], value: q.owner, change: "reg-f", dataset: { k: "owner" }, aria: "Owner" })}
        ${pkgs.length ? C.select({ options: [["", "Any package"], ["none", "No package"], ...pkgs.map((x) => [x.id, x.name])], value: q.pkg, change: "reg-f", dataset: { k: "pkg" }, aria: "Package" }) : ""}
        <label class="fchip"><input type="checkbox" data-change="reg-toggle" data-k="late" ${q.flag === "late" || q.late ? raw("checked") : ""}>${icon("alarm-clock-off", 14)}Late only</label>
        <label class="fchip"><input type="checkbox" data-change="reg-toggle" data-k="at_risk" ${q.flag === "at_risk" || q.risk ? raw("checked") : ""}>${icon("clock-alert", 14)}At risk only</label>
        ${Object.keys(q).some((k) => ["disc", "stage", "state", "owner", "pkg", "flag", "late", "risk", "q"].includes(k)) ? html`<a class="btn sm ghost" href="#/projects/${p.id}/register">${icon("x", 14)}Clear</a>` : ""}
        <span class="ml-auto flex gap-2 items-center wrap">
          ${C.select({ options: [["", "No grouping"], ["discipline", "Group by discipline"], ["package", "Group by package"], ["stage", "Group by stage"]], value: group, change: "reg-f", dataset: { k: "group" }, aria: "Group by" })}
          <button class="btn sm" data-act="reg-views" data-p="${p.id}" aria-haspopup="menu">${icon("bookmark", 14)}${views.find((v) => v.query === location.hash.split("?")[1])?.name || "Saved views"}${icon("chevron-down", 12)}</button>
          <button class="btn sm" data-act="reg-cols" aria-haspopup="menu">${icon("sliders-horizontal", 14)}Columns</button>
        </span>
      </div>
      ${C.card({ body: list.length ? html`<div class="t-wrap" style="max-height:calc(100vh - 260px);overflow:auto" role="region" aria-label="Sheet register" tabindex="-1"><table class="t" aria-rowcount="${list.length}"><thead><tr>
          <th class="cb"><input type="checkbox" aria-label="Select all on this page" ${allOnPage ? raw("checked") : ""} data-act="reg-sel-all" data-prevent></th>
          ${C.sortTh("Sheet", "number", sort, "reg-sort", "sticky-c")}${C.sortTh("Title", "title", sort, "reg-sort")}${c.has("disc") ? C.sortTh("Disc", "disc", sort, "reg-sort", "hide-sm") : ""}${c.has("stage") ? html`<th class="hide-md">Stage</th>` : ""}${c.has("package") ? html`<th class="hide-md">Package</th>` : ""}${c.has("owner") ? C.sortTh("Owner", "owner", sort, "reg-sort", "hide-sm") : ""}${c.has("checker") ? html`<th class="hide-md">Checker</th>` : ""}${C.sortTh("State", "state", sort, "reg-sort")}${c.has("planned") ? C.sortTh("Planned", "planned", sort, "reg-sort", "hide-sm") : ""}${c.has("rev") ? C.sortTh("Rev", "rev", sort, "reg-sort", "hide-sm") : ""}${c.has("flags") ? html`<th class="hide-sm">Flags</th>` : ""}
        </tr></thead><tbody>${body}</tbody></table></div>${list.length > size || page > 1 ? C.pager(list.length, page, size, "reg-page") : ""}` : C.empty(st.sheetsOf(p.id).length ? "No sheets match these filters." : "No sheets yet. Import your Excel register.", planner ? C.linkBtn("Import Excel register", `#/projects/${p.id}/import`, { variant: "primary", icon: "file-spreadsheet" }) : "") })}
      ${selection.size ? html`<div class="bulkbar" role="region" aria-label="Bulk actions"><span class="strong">${selection.size} selected</span>
        ${planner ? html`${C.btn("Assign owner", { size: "sm", icon: "user", act: "bulk-owner", data: { p: p.id } })}${C.btn("Set checker", { size: "sm", icon: "user-check", act: "bulk-checker", data: { p: p.id } })}${C.btn("Shift dates ±", { size: "sm", icon: "calendar-days", act: "bulk-shift", data: { p: p.id } })}${C.btn("Move to package", { size: "sm", icon: "package", act: "bulk-package", data: { p: p.id } })}` : ""}
        <button class="btn sm" data-act="bulk-state" data-p="${p.id}" aria-haspopup="menu">${icon("git-compare-arrows", 14)}Change state${icon("chevron-down", 12)}</button>
        ${issuer ? C.linkBtn("Issue selected…", `#/projects/${p.id}/issue?sheets=${[...selection].join(",")}`, { size: "sm", icon: "send-horizontal" }) : ""}
        ${C.btn("Export selected", { size: "sm", icon: "download", act: "reg-export", data: { p: p.id, sel: "1" } })}
        ${C.btn("Clear", { size: "sm", variant: "ghost", icon: "x", act: "bulk-clear", data: { p: p.id } })}</div>` : ""}
      <p class="small muted mt-3">${icon("keyboard", 12)} j / k move, x selects, Enter opens, Shift-click selects a range. Inline edits save on change, with Undo.</p>`;
  };
  // Keyboard: j/k/x/Enter on the register (DESIGN.md §6).
  document.addEventListener("keydown", (e) => {
    const rp = ui.state.regPage; if (!rp || !location.hash.includes("/register")) return;
    if (e.target.closest("input,select,textarea") || document.querySelector(".overlay,.drawer-wrap") || e.metaKey || e.ctrlKey) return;
    const n = rp.ids.length; let i = ui.state.regFocus ?? -1;
    if (e.key === "j" || e.key === "k") { e.preventDefault(); i = DO.clamp(i + (e.key === "j" ? 1 : -1), 0, n - 1); ui.state.regFocus = i; DO.app.render(); document.querySelector(`tr[data-i="${i}"]`)?.focus(); }
    if (e.key === "x" && i >= 0) { const id = rp.ids[i]; const s = sel(rp.pid); s.has(id) ? s.delete(id) : s.add(id); DO.app.render(); document.querySelector(`tr[data-i="${i}"]`)?.focus(); }
    if (e.key === "Enter" && i >= 0 && e.target.tagName !== "A") { location.hash = `#/projects/${rp.pid}/sheets/${rp.ids[i]}`; }
  });

  ui.on("reg-q", (el) => DO.app.setQuery({ q: el.value, p: "" }));
  ui.on("reg-f", (el) => DO.app.setQuery({ [el.dataset.k]: el.value, p: "" }));
  ui.on("reg-toggle", (el) => { const k = el.dataset.k; const q = DO.app.parseHash().query; const cur = q.flag; DO.app.setQuery({ flag: el.checked ? k : cur === k ? "" : cur, late: "", risk: "", p: "" }); });
  ui.on("reg-sort", (el) => { const q = DO.app.parseHash().query; DO.app.setQuery({ sort: el.dataset.key, dir: (q.sort || "number") === el.dataset.key && q.dir !== "-1" ? "-1" : "" }); });
  ui.on("reg-page", (el) => DO.app.setQuery({ p: el.dataset.p }));
  ui.on("reg-page-size", (el) => { ui.state.regSize = +el.value; DO.app.setQuery({ p: "" }); });
  let lastClicked = null;
  ui.on("reg-sel", (el, ev) => {
    const rp = ui.state.regPage; const s = sel(rp.pid); const i = +el.dataset.i;
    if (ev.shiftKey && lastClicked !== null) { const [a, b] = [Math.min(lastClicked, i), Math.max(lastClicked, i)]; for (let k = a; k <= b; k++) s.add(rp.ids[k]); }
    else if (s.has(el.dataset.id)) s.delete(el.dataset.id); else s.add(el.dataset.id);
    lastClicked = i; ui.state.regFocus = i; DO.app.render();
  });
  ui.on("reg-sel-all", () => { const rp = ui.state.regPage; const s = sel(rp.pid); const all = rp.ids.every((id) => s.has(id)); rp.ids.forEach((id) => (all ? s.delete(id) : s.add(id))); DO.app.render(); });
  ui.on("bulk-clear", (el) => { sel(el.dataset.p).clear(); DO.app.render(); });
  ui.on("reg-inline", (el) => {
    const s = st.sheet(el.dataset.id); const k = el.dataset.k; const v = el.value || null;
    if (k === "planned" && !v && !s.packageId) { ui.toast({ title: "A planned date is needed", description: "Clear it only for sheets in a package; they inherit the package date.", tone: "bad" }); DO.app.render(); return; }
    const undo = st.editSheets([s.id], { [k]: v });
    ui.toast({ title: `${s.number}: ${st.FIELD_LABEL[k]} updated`, description: k === "planned" ? (v ? DO.fmtDate(v) : "Inherits the package date") : k === "packageId" ? st.pkg(v)?.name || "No package" : st.userName(v), tone: "ok", undo });
  });
  ui.on("reg-cols", (el) => { const c = cols(); ui.menu(el, [{ label: "Show columns" }, ...COLS.map(([k, l]) => ({ text: l, icon: c.has(k) ? "square-check" : "square", run: () => { c.has(k) ? c.delete(k) : c.add(k); DO.app.render(); } }))]); });
  ui.on("reg-views", (el) => {
    const u = DO.auth.current(); const pid = el.dataset.p; const views = st.S.savedViews.filter((v) => v.userId === u.id && v.projectId === pid); const qs = location.hash.split("?")[1] || "";
    ui.menu(el, [{ label: "Saved views" }, ...(views.length ? views.map((v) => ({ text: v.name, icon: "bookmark", on: v.query === qs, run: () => DO.app.go(`/projects/${pid}/register?${v.query}`) })) : [{ label: "No saved views yet" }]), "-", { text: "Save current filters as a view…", icon: "plus", run: () => saveView(pid, qs) }, ...(views.length ? [{ text: "Delete a view…", icon: "trash", run: () => deleteView(pid) }] : [])]);
  });
  function saveView(pid, qs) {
    ui.dialog({ title: "Save view", body: html`<form id="sv-f" data-submit="sv-save" class="stack"><input type="hidden" name="p" value="${pid}"><input type="hidden" name="q" value="${qs}">${C.field("View name", html`<input id="sv-n" name="name" class="input" required autofocus placeholder="e.g. My HVAC, late only">`, { for: "sv-n" })}<p class="small muted">Saves the filters, grouping and sort currently in the address bar.</p></form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="sv-f">Save view</button>` });
  }
  ui.on("sv-save", (f, d) => { if (!d.name.trim()) return; st.S.savedViews.push({ id: st.nextId("sv"), userId: DO.auth.current().id, projectId: d.p, name: d.name.trim(), query: d.q }); ui.closeTop(); st.commit(); ui.toast({ title: `View “${d.name.trim()}” saved`, tone: "ok" }); });
  function deleteView(pid) { const u = DO.auth.current(); const views = st.S.savedViews.filter((v) => v.userId === u.id && v.projectId === pid); ui.dialog({ title: "Delete a saved view", body: html`<ul>${views.map((v) => html`<li class="list-row"><span>${v.name}</span>${C.btn("Delete", { size: "sm", variant: "danger", act: "sv-del", data: { id: v.id } })}</li>`)}</ul>`, foot: html`<button class="btn" data-close>Done</button>` }); }
  ui.on("sv-del", (el) => { st.S.savedViews = st.S.savedViews.filter((v) => v.id !== el.dataset.id); ui.closeTop(); st.commit(); ui.toast({ title: "View deleted" }); });
  ui.on("reg-export", (el) => { const p = st.project(el.dataset.p); C.exportMenu(el, () => { const q = DO.app.parseHash().query; let list = filtered(p, q).list; if (el.dataset.sel) list = list.filter((s) => sel(p.id).has(s.id)); return { ...DO.registerExportSpec(list, `Drawing register · ${p.code} ${p.name}`), name: `register_${p.code}`, subtitle: `${list.length} sheets · filters: ${Object.entries(q).filter(([k]) => !["p"].includes(k)).map(([k, v]) => `${k}=${[].concat(v).join("|")}`).join(", ") || "none"} · ${DO.fmtDate(DO.today())}` }; }); });

  // ---------- Bulk actions (F-46) ----------
  const selected = (pid) => [...sel(pid)].map(st.sheet).filter(Boolean);
  function bulkPick(pid, title, label, options, apply) {
    ui.dialog({ title, subtitle: `${selected(pid).length} sheets selected`, body: html`<form id="bk-f" data-submit="bk-apply" class="stack">${C.field(label, C.select({ id: "bk-v", name: "v", options }), { for: "bk-v" })}</form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="bk-f">Apply to ${selected(pid).length} sheets</button>` });
    ui.state.bulkApply = apply;
  }
  ui.on("bk-apply", (f, d) => { const fn = ui.state.bulkApply; ui.closeTop(); fn?.(d.v, d); });
  function report(ok, skipped, verb) {
    const desc = `${ok} updated${skipped.length ? `, ${skipped.length} skipped` : ""}.`;
    if (!skipped.length) { ui.toast({ title: `${verb}`, description: desc, tone: "ok" }); return; }
    ui.toast({ title: verb, description: desc, tone: ok ? "ok" : "bad", action: { label: "See skipped", run: () => ui.dialog({ title: `${skipped.length} sheets skipped`, body: html`<ul>${skipped.map((x) => html`<li class="list-row"><span class="mono strong">${x.number}</span><span class="small muted">${x.why}</span></li>`)}</ul>`, foot: html`<button class="btn primary" data-close>Done</button>` }) } });
  }
  ui.on("bulk-owner", (el) => { const p = st.project(el.dataset.p); const people = [...new Map(p.members.filter((m) => ["Designer", "DL", "PL"].includes(m.role)).map((m) => [m.userId, st.user(m.userId)])).values()]; bulkPick(p.id, "Assign owner", "Owner (designer)", people.map((x) => [x.id, `${x.name} · ${x.title}`]), (v) => { const ids = selected(p.id).filter((s) => !["issued", "superseded", "cancelled"].includes(s.state)); const skipped = selected(p.id).filter((s) => !ids.includes(s)).map((s) => ({ number: s.number, why: `${st.label(s.state)}: start the next revision first` })); const undo = st.editSheets(ids.map((s) => s.id), { ownerId: v }, "bulk"); report(ids.length, skipped, `Owner set to ${st.userName(v)}`); ui.toast({ title: "Undo the owner change?", undo, timeout: 7000 }); }); });
  ui.on("bulk-checker", (el) => { const p = st.project(el.dataset.p); const people = [...new Map(p.members.filter((m) => ["DL", "SR", "PL"].includes(m.role)).map((m) => [m.userId, st.user(m.userId)])).values()]; bulkPick(p.id, "Set checker", "Checker", people.map((x) => [x.id, `${x.name} · ${st.ROLE_LABEL[p.members.find((m) => m.userId === x.id && ["DL", "SR", "PL"].includes(m.role)).role]}`]), (v) => { const list = selected(p.id); const skipped = list.filter((s) => s.ownerId === v).map((s) => ({ number: s.number, why: "A designer cannot check their own sheet" })); const ok = list.filter((s) => s.ownerId !== v); const undo = st.editSheets(ok.map((s) => s.id), { checkerId: v }, "bulk"); report(ok.length, skipped, `Checker set to ${st.userName(v)}`); ui.toast({ title: "Undo the checker change?", undo, timeout: 7000 }); }); });
  ui.on("bulk-package", (el) => { const p = st.project(el.dataset.p); bulkPick(p.id, "Move to package", "Package", [["", "No package"], ...st.packagesOf(p.id).map((x) => [x.id, `${x.name} · ${DO.fmtDate(x.date)}`]), ["__new", "New package…"]], (v) => { if (v === "__new") { newPackage(p); return; } const list = selected(p.id); const undo = st.editSheets(list.map((s) => s.id), { packageId: v || null }, "bulk"); report(list.length, [], v ? `Moved to ${st.pkg(v).name}` : "Removed from package"); ui.toast({ title: "Undo the package move?", undo, timeout: 7000 }); }); });
  function newPackage(p) {
    ui.dialog({ title: "New package", subtitle: "Plan by package first; sheets without their own date inherit the package date (F-49).", body: html`<form id="pk-f" data-submit="pk-save" class="stack"><input type="hidden" name="p" value="${p.id}">${C.field("Name", html`<input id="pk-n" name="name" class="input" required autofocus placeholder="e.g. HVAC GFC set">`, { for: "pk-n" })}${C.field("Discipline", C.select({ id: "pk-d", name: "d", options: st.S.disciplines.map((x) => [x.code, x.name]) }), { for: "pk-d" })}${C.field("Package date", html`<input id="pk-dt" type="date" name="date" class="input" required value="${DO.addWorkingDays(DO.today(), 15)}">`, { for: "pk-dt" })}</form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="pk-f">Create and move</button>` });
  }
  ui.on("pk-save", (f, d) => { if (!d.name.trim()) return; const pk = { id: st.nextId("pk"), projectId: d.p, name: d.name.trim(), discipline: d.d, date: d.date }; st.S.packages.push(pk); const list = selected(d.p); ui.closeTop(); st.editSheets(list.map((s) => s.id), { packageId: pk.id }, "new package"); ui.toast({ title: `${pk.name} created`, description: `${list.length} sheets moved.`, tone: "ok" }); });
  ui.on("bulk-shift", (el) => {
    const p = st.project(el.dataset.p);
    ui.dialog({ title: "Shift planned dates", subtitle: `${selected(p.id).length} sheets · working days use the firm calendar (F-42)`, body: html`<form id="sh-f" data-submit="sh-apply" class="stack"><input type="hidden" name="p" value="${p.id}">${C.field("Shift by (working days, negative to bring forward)", html`<input id="sh-n" name="n" type="number" class="input" value="5" step="1" required autofocus>`, { for: "sh-n" })}</form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="sh-f">Shift dates</button>` });
  });
  ui.on("sh-apply", (f, d) => { const n = +d.n; if (!n) return; const list = selected(d.p); const skipped = list.filter((s) => ["issued", "superseded", "cancelled"].includes(s.state) || !st.effPlanned(s)).map((s) => ({ number: s.number, why: !st.effPlanned(s) ? "No planned date" : `${st.label(s.state)}: nothing to plan` })); const ok = list.filter((s) => !skipped.some((x) => x.number === s.number)); ui.closeTop(); const undo = st.editSheets(ok.map((s) => s.id), (s) => ({ planned: DO.addWorkingDays(st.effPlanned(s), n) }), `shifted ${n > 0 ? "+" : ""}${n} working days`); report(ok.length, skipped, `Dates shifted ${n > 0 ? "+" : ""}${n} working days`); ui.toast({ title: `${ok.length} audit entries written`, undo, timeout: 7000 }); });
  ui.on("bulk-state", (el) => {
    const pid = el.dataset.p; const list = selected(pid);
    const acts = ["start", "submit", "next_revision", "hold", "resume", "cancel"].map((a) => ({ a, n: list.filter((s) => st.allowedActions(DO.auth.current(), s).some((x) => x.action === a)).length }));
    ui.menu(el, [{ label: "Move every allowed sheet; others are skipped" }, ...acts.map(({ a, n }) => ({ text: `${st.ACTIONS[a].label}`, hint: `${n} of ${list.length}`, icon: C.STATES[st.ACTIONS[a].to || "planned"]?.[1], run: async () => {
      let reason = "";
      if (st.ACTIONS[a].needsReason || a === "submit") {
        if (a === "submit" && list.some((s) => st.checklistFor(s))) { report(0, list.map((s) => ({ number: s.number, why: "Submit with the pre-check checklist from the sheet page" })), "Submit for check"); return; }
        const r = await ui.confirm({ title: `${st.ACTIONS[a].label}: ${n} sheets`, body: `${list.length - n} selected sheets cannot move this way and will be skipped.`, confirm: st.ACTIONS[a].label, danger: st.ACTIONS[a].danger, reason: st.ACTIONS[a].needsReason, reasonRequired: st.ACTIONS[a].needsReason }); if (!r) return; reason = r.reason;
      }
      ui.state.batching = true; const res = st.bulkTransition(list.map((s) => s.id), a, { reason }); ui.state.batching = false; DO.app.render();
      report(res.ok, res.skipped, `${st.ACTIONS[a].label}`);
    } }))]);
  });

  // ---------- New sheet (F-04) ----------
  ui.on("reg-new", (el) => openSheetForm(st.project(el.dataset.p)));
  function openSheetForm(p, s) {
    const u = DO.auth.current(); const stages = st.stagesOf(p.id); const def = st.activeStage(p.id);
    const myDisc = p.members.find((m) => m.userId === u.id && m.role === "DL")?.discipline;
    const editing = !!s;
    ui.drawer({ title: editing ? `Edit ${s.number}` : "New sheet", subtitle: editing ? "Changes are audited (F-39)." : "The sheet exists from the day it is planned, before any file.", body: html`<form id="sf-f" data-submit="sf-save" class="stack" novalidate><input type="hidden" name="p" value="${p.id}"><input type="hidden" name="id" value="${s?.id || ""}">
      <div class="form-grid">
      ${C.field("Sheet number", html`<input id="sf-num" name="number" class="input mono" required autofocus value="${s?.number || ""}" placeholder="${myDisc || "A"}-1xx" data-input="sf-num-check" aria-describedby="sf-num-msg">`, { for: "sf-num" })}
      ${C.field("Discipline", C.select({ id: "sf-d", name: "discipline", options: st.S.disciplines.map((x) => [x.code, `${x.code} · ${x.name}`]), value: s?.discipline || myDisc || "A" }), { for: "sf-d" })}
      <p id="sf-num-msg" class="small muted full" aria-live="polite">Format is checked against the discipline rule (F-35).</p>
      ${C.field("Title", html`<input id="sf-t" name="title" class="input" required value="${s?.title || ""}" placeholder="e.g. Ground Floor Plan">`, { for: "sf-t", cls: "full" })}
      ${C.field("Stage", C.select({ id: "sf-st", name: "stageId", options: stages.map((x) => [x.id, `${x.seq} ${x.name}`]), value: s?.stageId || def?.id }), { for: "sf-st" })}
      ${C.field("Package", C.select({ id: "sf-pk", name: "packageId", options: [["", "—"], ...st.packagesOf(p.id).map((x) => [x.id, x.name])], value: s?.packageId || "" }), { for: "sf-pk" })}
      ${C.field("Owner (designer)", C.select({ id: "sf-o", name: "ownerId", options: [...new Map(p.members.filter((m) => ["Designer", "DL", "PL"].includes(m.role)).map((m) => [m.userId, st.user(m.userId)])).values()].map((x) => [x.id, x.name]), value: s?.ownerId }), { for: "sf-o" })}
      ${C.field("Checker", C.select({ id: "sf-c", name: "checkerId", options: [...new Map(p.members.filter((m) => ["DL", "SR", "PL"].includes(m.role)).map((m) => [m.userId, st.user(m.userId)])).values()].map((x) => [x.id, x.name]), value: s?.checkerId }), { for: "sf-c" })}
      ${C.field("Planned issue date", html`<input id="sf-pl" type="date" name="planned" class="input" value="${s?.planned || DO.addWorkingDays(DO.today(), 15)}">`, { for: "sf-pl", hint: "Leave empty to inherit the package date." })}
      ${C.field("CAD file link", html`<input id="sf-cad" name="cadLink" class="input mono" value="${s?.cadLink || `\\\\fileserver\\${p.code}\\`}" placeholder="UNC path, SharePoint/Drive URL or Autodesk link">`, { for: "sf-cad", hint: "Linked, not copied (F-41).", cls: "full" })}
      ${C.field("Working notes", html`<textarea id="sf-n" name="notes" class="textarea" rows="3">${s?.notes || ""}</textarea>`, { for: "sf-n", cls: "full" })}
      </div></form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="sf-f">${editing ? "Save changes" : "Add sheet"}</button>`, wide: true });
  }
  DO.openSheetForm = openSheetForm;
  ui.on("sf-num-check", (el) => { const f = el.form; const num = el.value.trim().toUpperCase(); const d = num[0]; const msg = document.getElementById("sf-num-msg"); if (st.disc(d)) f.discipline.value = d; const p = st.project(f.p.value); const existing = f.id.value ? st.sheet(f.id.value) : null; const err = num && (!existing || existing.number !== num) ? st.sheetNumberCheck(num, f.discipline.value, p) : ""; msg.textContent = num ? err || `${num} is valid for ${st.disc(f.discipline.value)?.name}.` : "Format is checked against the discipline rule (F-35)."; msg.className = `small full ${err ? "danger-t" : num ? "ok-t" : "muted"}`; el.setAttribute("aria-invalid", err ? "true" : "false"); });
  ui.on("sf-save", (f, d) => {
    const p = st.project(d.p); const u = DO.auth.current(); const num = d.number.trim().toUpperCase(); const existing = d.id ? st.sheet(d.id) : null;
    const err = !existing || existing.number !== num ? st.sheetNumberCheck(num, d.discipline, p) : "";
    if (err) { ui.toast({ title: "Check the sheet number", description: err, tone: "bad" }); return; }
    if (!d.title.trim()) { ui.toast({ title: "Enter a title", tone: "bad" }); return; }
    if (!d.planned && !d.packageId) { ui.toast({ title: "Add a planned date or a package", description: "Every sheet needs a date for the at-risk and late rules (A-01, A-02).", tone: "bad" }); return; }
    if (d.ownerId === d.checkerId) { ui.toast({ title: "Owner and checker must differ", description: "A designer cannot check their own sheet.", tone: "bad" }); return; }
    const fields = { number: num, title: d.title.trim(), discipline: d.discipline, stageId: d.stageId, packageId: d.packageId || null, ownerId: d.ownerId, checkerId: d.checkerId, planned: d.planned || null, cadLink: d.cadLink, notes: d.notes };
    if (existing) {
      if (existing.number !== num) fields.aliases = [...new Set([...(existing.aliases || []), existing.number])];
      ui.closeTop(); const undo = st.editSheets([existing.id], fields); ui.toast({ title: `${num} saved`, description: existing.number !== num ? `Renumbered; ${existing.number} kept as an alias and still searchable.` : "", tone: "ok", undo });
      if (existing.number !== num) DO.app.render();
      return;
    }
    const s = { id: st.nextId("s"), projectId: p.id, ...fields, state: "planned", stateBefore: null, currentRevId: null, aliases: [], reviewRound: 0, stateChangedAt: null, createdAt: new Date().toISOString(), replacedBy: null, cancelReason: "" };
    st.S.sheets.push(s);
    st.audit("sheet", s.id, "created", null, { number: num, title: s.title }, { projectId: p.id, text: `${u.name} added sheet ${num} ${s.title}` });
    st.notify([s.ownerId], "assigned", `${num} assigned to you`, `${u.name} planned ${num} ${s.title} (${p.code}) for ${DO.fmtDate(st.effPlanned(s))}.`, `#/projects/${p.id}/sheets/${s.id}`);
    ui.closeTop(); st.commit(); ui.toast({ title: `${num} added`, description: `${st.userName(s.ownerId)} was notified.`, tone: "ok", action: { label: "Open", run: () => DO.app.go(`/projects/${p.id}/sheets/${s.id}`) } });
  });

  // ---------- S-12 Import wizard (F-05, I-01) ----------
  const FIELDS = [["number", "Sheet number", true], ["title", "Title", true], ["discipline", "Discipline", false], ["stage", "Stage", false], ["owner", "Owner (name or email)", false], ["planned", "Planned issue date", false], ["package", "Package", false]];
  const GUESS = { number: /sheet|dwg|drawing\s*no|number|no\.?$/i, title: /title|name|description/i, discipline: /disc/i, stage: /stage|phase/i, owner: /owner|designer|drawn|assigned/i, planned: /date|due|planned|target/i, package: /package|set/i };
  function parseDate(v) {
    const s = String(v ?? "").trim(); if (!s) return { ok: true, v: null };
    if (/^\d{5}(\.\d+)?$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(+s) * 86400000); return { ok: true, v: d.toISOString().slice(0, 10) }; }
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return valid(+m[3], +m[2], +m[1]);
    m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})$/); if (m) { const mo = DO.MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()); if (mo >= 0) return valid(+m[3], mo + 1, +m[1]); }
    return { ok: false };
    function valid(y, mo, d) { const dt = new Date(y, mo - 1, d); return dt.getMonth() === mo - 1 && dt.getDate() === d ? { ok: true, v: DO.iso(dt) } : { ok: false }; }
  }
  S.importWizard = (ctx, u) => {
    const p = ctx.project; const w = (ui.state.imp = ui.state.imp && ui.state.imp.pid === p.id ? ui.state.imp : { pid: p.id, step: 1 });
    if (!(st.isPL(u, p) || p.members.some((m) => m.userId === u.id && m.role === "DL"))) return C.card({ body: C.empty("Only the project lead and discipline leads can import sheets.") });
    const steps = ["Upload", "Map columns", "Preview and fix", "Result"];
    const head = html`<div class="flex between wrap gap-2 mb-3"><div><h2 class="title">Import sheet register</h2><p class="small muted">From Excel (.xlsx) or CSV. All-or-nothing per run; undo within 24 h while no sheet has moved.</p></div><a class="btn" href="#/projects/${p.id}/register">${icon("arrow-left", 16)}Back to register</a></div><ol class="steps">${steps.map((s, i) => html`<li class="s ${w.step === i + 1 ? "on" : w.step > i + 1 ? "done" : ""}"><span class="n">${w.step > i + 1 ? icon("check", 12) : i + 1}</span>${s}</li>`)}</ol>`;
    const recent = st.S.imports.filter((x) => x.projectId === p.id).slice(-3).reverse();
    if (w.step === 1) return html`${head}${C.card({ body: html`<div class="card-body stack"><label class="dropzone" data-drop="imp-file" for="imp-in">${icon("file-spreadsheet", 28, "primary-t")}<span class="strong">Drop your register here, or choose a file</span><span class="small muted">.xlsx or .csv · first row is the header · one row per sheet</span><input id="imp-in" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" data-change="imp-file"></label>${w.error ? html`<p class="alert bad" role="alert">${icon("circle-alert", 16)}<span>${w.error}</span></p>` : ""}<p class="small">No file to hand? Use a sample: <a class="link" href="assets/documents/sample-register-import.xlsx" download>sample-register-import.xlsx</a> · <a class="link" href="assets/documents/sample-register-import.csv" download>.csv</a> (it contains 3 deliberate errors), or ${C.btn("Load the sample now", { size: "sm", act: "imp-sample", data: { p: p.id } })}</p></div>` })}${recent.length ? C.card({ title: "Recent imports", cls: "mt-4", body: html`<ul>${recent.map((x) => html`<li class="list-row"><span>${x.file} · ${DO.plural(x.sheetIds.length, "sheet")} · ${DO.fmtDateTime(x.at)} by ${st.userName(x.by)}${x.undone ? html` · <span class="pill">Undone</span>` : ""}</span>${!x.undone ? undoButton(x) : ""}</li>`)}</ul>` }) : ""}`;
    if (w.step === 2) {
      const hdr = w.rows[0];
      return html`${head}${C.card({ title: `Map columns · ${w.file}`, body: html`<div class="card-body"><p class="small muted mb-3">${DO.plural(w.rows.length - 1, "data row")}. Columns were guessed from the header; change any that are wrong.</p><div class="form-grid">${FIELDS.map(([k, l, req]) => C.field(`${l}${req ? " (required)" : ""}`, C.select({ id: `map-${k}`, options: [["", "— not in file —"], ...hdr.map((h, i) => [i, h || `Column ${i + 1}`])], value: w.map[k] ?? "", change: "imp-map", dataset: { k } }), { for: `map-${k}` }))}</div>
        <p class="section-title mt-4">First rows</p><div class="t-wrap"><table class="t"><thead><tr>${hdr.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${w.rows.slice(1, 5).map((r) => html`<tr>${hdr.map((_, i) => html`<td class="small">${r[i] ?? ""}</td>`)}</tr>`)}</tbody></table></div></div>`, foot: html`<button class="btn" data-act="imp-step" data-s="1">Back</button><button class="btn primary" data-act="imp-preview" ${w.map.number === undefined || w.map.number === "" || w.map.title === undefined || w.map.title === "" ? raw("disabled") : ""}>Preview</button>` })}`;
    }
    if (w.step === 3) {
      const rows = w.preview; const bad = rows.filter((r) => r.errors.length && !r.skip); const good = rows.filter((r) => !r.errors.length && !r.skip);
      return html`${head}${C.card({ title: `Preview · ${good.length} ready, ${bad.length} with problems, ${rows.filter((r) => r.skip).length} skipped`, body: html`<div class="t-wrap" style="max-height:520px;overflow:auto"><table class="t"><thead><tr><th>Row</th><th>Sheet</th><th>Title</th><th>Disc</th><th>Stage</th><th>Owner</th><th>Planned</th><th>Problem</th><th></th></tr></thead><tbody>${rows.map((r, i) => html`<tr style="${r.errors.length && !r.skip ? "background:var(--danger-bg)" : r.skip ? "opacity:.55" : ""}"><td class="small muted">${r.line}</td><td><input class="cell mono" style="max-width:90px" value="${r.number}" aria-label="Sheet number, row ${r.line}" data-change="imp-cell" data-i="${i}" data-k="number"></td><td><input class="cell" style="max-width:220px" value="${r.title}" aria-label="Title, row ${r.line}" data-change="imp-cell" data-i="${i}" data-k="title"></td><td><input class="cell" style="max-width:44px" value="${r.discipline}" aria-label="Discipline, row ${r.line}" data-change="imp-cell" data-i="${i}" data-k="discipline"></td><td class="small">${r.stageName}</td><td class="small">${r.ownerName}</td><td><input class="cell" style="max-width:110px" value="${r.plannedRaw}" aria-label="Planned date, row ${r.line}" data-change="imp-cell" data-i="${i}" data-k="plannedRaw"></td><td class="small" style="color:var(--danger)">${r.skip ? html`<span class="muted">Skipped</span>` : r.errors.join(" ")}</td><td>${C.btn(r.skip ? "Include" : "Skip", { size: "sm", variant: "ghost", act: "imp-skip", data: { i } })}</td></tr>`)}</tbody></table></div>`, foot: html`<button class="btn" data-act="imp-step" data-s="2">Back to mapping</button><span class="actions">${bad.length ? html`<span class="small danger-t">${icon("circle-alert", 14)} Fix or skip ${DO.plural(bad.length, "row")} to continue</span>` : ""}<button class="btn primary" data-act="imp-commit" data-p="${p.id}" ${bad.length || !good.length ? raw("disabled") : ""}>Import ${DO.plural(good.length, "sheet")}</button></span>` })}`;
    }
    const imp = st.S.imports.find((x) => x.id === w.importId);
    return html`${head}${C.card({ body: html`<div class="card-body stack-2"><p class="title">${icon("circle-check", 20, "ok-t")} ${DO.plural(imp?.sheetIds.length || 0, "sheet")} imported</p><p class="muted">${w.skipped ? `${DO.plural(w.skipped, "row")} skipped. ` : ""}Owners were notified of their assignments. The register now shows the new sheets as Planned.</p><div class="actions mt-2">${C.linkBtn("Open the register", `#/projects/${p.id}/register?q=`, { variant: "primary" })}${imp && !imp.undone ? undoButton(imp) : ""}${C.btn("Import another file", { act: "imp-step", data: { s: 1 } })}</div></div>` })}`;
  };
  function undoButton(x) { const until = new Date(new Date(x.at).getTime() + 86400000); const moved = x.sheetIds.some((id) => { const s = st.sheet(id); return s && s.state !== "planned"; }); return until < new Date() ? html`<span class="small muted">Undo window closed</span>` : moved ? html`<span class="small muted" data-tip="A sheet from this import has moved state; undo is no longer possible." tabindex="0">Undo not possible</span>` : C.btn(`Undo import (until ${DO.fmtTime(until)} tomorrow)`, { size: "sm", act: "imp-undo", data: { id: x.id }, icon: "rotate-ccw" }); }
  async function readFileRows(file) {
    if (/\.csv$/i.test(file.name) || file.type === "text/csv") return DO.parseCSV(await file.text());
    if (/\.xlsx$/i.test(file.name)) return DO.zip.readXlsx(new Uint8Array(await file.arrayBuffer()));
    throw new Error(`${file.name} is not an .xlsx or .csv file. Save the register as Excel workbook or CSV and try again.`);
  }
  async function loadRows(rows, name) {
    const w = ui.state.imp;
    if (!rows.length || rows.length < 2) { w.error = `${name} has no data rows.`; DO.app.render(); return; }
    w.rows = rows; w.file = name; w.error = ""; w.map = {};
    FIELDS.forEach(([k]) => { const i = rows[0].findIndex((h) => GUESS[k].test(String(h))); if (i >= 0 && !Object.values(w.map).includes(i)) w.map[k] = i; });
    w.step = 2; DO.app.render();
  }
  ui.on("imp-file", async (el) => { const file = el.files?.[0]; if (!file) return; try { await loadRows(await readFileRows(file), file.name); } catch (e) { ui.state.imp.error = e.message; DO.app.render(); } });
  ui.on("imp-sample", async () => { try { if (location.protocol === "file:") throw new Error("file"); const res = await fetch("assets/documents/sample-register-import.csv"); if (!res.ok) throw new Error(); await loadRows(DO.parseCSV(await res.text()), "sample-register-import.csv"); } catch (e) { await loadRows(DO.parseCSV(SAMPLE_CSV), "sample-register-import.csv"); } });
  ui.on("imp-map", (el) => { ui.state.imp.map[el.dataset.k] = el.value === "" ? undefined : +el.value; DO.app.render(); });
  ui.on("imp-step", (el) => { ui.state.imp.step = +el.dataset.s; DO.app.render(); });
  function validate(p, rows) {
    const seen = new Map();
    rows.forEach((r) => {
      r.errors = [];
      r.number = String(r.number || "").trim().toUpperCase(); r.discipline = String(r.discipline || r.number[0] || "").trim().toUpperCase();
      if (!r.number) r.errors.push("Sheet number missing.");
      else { const e = st.sheetNumberCheck(r.number, r.discipline, p); if (e) r.errors.push(e.includes("already exists") ? `Duplicate: ${r.number} is already in ${p.code}.` : e); }
      if (r.number && seen.has(r.number) && !r.skip) r.errors.push(`Duplicate in this file (row ${seen.get(r.number)}).`); else if (r.number && !r.skip) seen.set(r.number, r.line);
      if (!st.disc(r.discipline)) r.errors.push(`Unknown discipline “${r.discipline}”.`);
      if (!String(r.title || "").trim()) r.errors.push("Title missing.");
      const d = parseDate(r.plannedRaw); r.planned = d.v; if (!d.ok) r.errors.push(`Bad date “${r.plannedRaw}”: use DD-MM-YYYY or 23-Oct-2026.`);
    });
  }
  ui.on("imp-preview", () => {
    const w = ui.state.imp; const p = st.project(w.pid); const stages = st.stagesOf(p.id); const def = st.activeStage(p.id);
    const get = (r, k) => (w.map[k] === undefined ? "" : String(r[w.map[k]] ?? "").trim());
    w.preview = w.rows.slice(1).map((r, i) => {
      const stName = get(r, "stage"); const stg = stName ? stages.find((x) => x.name.toLowerCase().startsWith(stName.toLowerCase()) || String(x.seq) === stName) : def;
      const ow = get(r, "owner"); const owner = ow ? st.S.users.find((x) => x.email.toLowerCase() === ow.toLowerCase() || x.name.toLowerCase() === ow.toLowerCase() || DO.short(x.name).toLowerCase() === ow.toLowerCase()) : null;
      const pkName = get(r, "package"); const pk = pkName ? st.packagesOf(p.id).find((x) => x.name.toLowerCase() === pkName.toLowerCase()) : null;
      return { line: i + 2, number: get(r, "number"), title: get(r, "title"), discipline: get(r, "discipline"), stageId: (stg || def).id, stageName: (stg || def) ? `${(stg || def).seq} ${(stg || def).name}` : "", ownerId: owner?.id || null, ownerName: owner ? owner.name : ow ? `${ow} (unknown: DL assigns)` : "—", plannedRaw: get(r, "planned"), packageId: pk?.id || null, skip: false };
    });
    validate(p, w.preview); w.step = 3; DO.app.render();
  });
  ui.on("imp-cell", (el) => { const w = ui.state.imp; w.preview[+el.dataset.i][el.dataset.k] = el.value; validate(st.project(w.pid), w.preview); DO.app.render(); });
  ui.on("imp-skip", (el) => { const w = ui.state.imp; const r = w.preview[+el.dataset.i]; r.skip = !r.skip; validate(st.project(w.pid), w.preview); DO.app.render(); });
  ui.on("imp-commit", (el) => {
    const w = ui.state.imp; const p = st.project(el.dataset.p); const u = DO.auth.current();
    validate(p, w.preview); const rows = w.preview.filter((r) => !r.skip);
    if (rows.some((r) => r.errors.length)) { ui.toast({ title: "Fix or skip the rows with problems first", tone: "bad" }); DO.app.render(); return; }
    const dlFor = (d) => p.members.find((m) => m.role === "DL" && m.discipline === d)?.userId || p.leadId;
    const ids = [];
    rows.forEach((r) => { const s = { id: st.nextId("s"), projectId: p.id, number: r.number, title: r.title.trim(), discipline: r.discipline, stageId: r.stageId, packageId: r.packageId, ownerId: r.ownerId || dlFor(r.discipline), checkerId: dlFor(r.discipline) === (r.ownerId || dlFor(r.discipline)) ? p.leadId : dlFor(r.discipline), planned: r.planned || DO.addWorkingDays(DO.today(), 20), state: "planned", stateBefore: null, currentRevId: null, notes: "", cadLink: `\\\\fileserver\\${p.code}\\${r.number}.dwg`, aliases: [], reviewRound: 0, stateChangedAt: null, createdAt: new Date().toISOString(), replacedBy: null, cancelReason: "" }; st.S.sheets.push(s); ids.push(s.id); });
    const imp = { id: st.nextId("im"), projectId: p.id, file: w.file, at: new Date().toISOString(), by: u.id, sheetIds: ids, undone: false };
    st.S.imports.push(imp);
    st.audit("import", imp.id, "import", null, { rows: ids.length, file: w.file }, { projectId: p.id, text: `${u.name} imported ${ids.length} sheets from ${w.file}` });
    const byOwner = DO.groupBy(ids.map(st.sheet), (s) => s.ownerId);
    Object.entries(byOwner).forEach(([oid, list]) => st.notify([oid], "assigned", `${DO.plural(list.length, "sheet")} assigned to you on ${p.code}`, `${u.name} imported ${list.map((s) => s.number).slice(0, 6).join(", ")}${list.length > 6 ? "…" : ""}.`, `#/projects/${p.id}/register?owner=${oid}`));
    w.importId = imp.id; w.skipped = w.preview.length - rows.length; w.step = 4; st.commit();
  });
  ui.on("imp-undo", async (el) => {
    const imp = st.S.imports.find((x) => x.id === el.dataset.id);
    const ok = await ui.confirm({ title: `Undo the import of ${DO.plural(imp.sheetIds.length, "sheet")}?`, body: "The sheets created by this import are removed. Nothing else changes.", confirm: "Undo import", danger: true }); if (!ok) return;
    if (imp.sheetIds.some((id) => st.sheet(id)?.state !== "planned")) { ui.toast({ title: "Undo not possible", description: "A sheet from this import has moved state since.", tone: "bad" }); return; }
    st.S.sheets = st.S.sheets.filter((s) => !imp.sheetIds.includes(s.id)); imp.undone = true;
    st.audit("import", imp.id, "undo", null, { rows: imp.sheetIds.length }, { projectId: imp.projectId, text: `${DO.auth.current().name} undid the import of ${imp.sheetIds.length} sheets (${imp.file})` }); st.commit();
    ui.toast({ title: "Import undone", tone: "ok" });
  });
  const SAMPLE_CSV = "Sheet No,Title,Discipline,Stage,Owner,Planned date,Package\nA-120,Fifth Floor Plan (future),A,Working drawings / GFC,Meghna Joshi,15-12-2026,Arch GFC set\nA-121,Roof Plan,A,Working drawings / GFC,arjun.pillai@firm.example,18-Dec-2026,\nM-212,Kitchen Exhaust Layout - Ground Floor,M,Working drawings / GFC,Rahul Kumar,2026-12-04,HVAC GFC set\nM-213,Laundry Exhaust Layout - Basement,M,Working drawings / GFC,Kavya Hegde,07/12/2026,\nE-120,Lightning Arrester Layout - Terrace,E,Working drawings / GFC,Rohan Das,10-12-2026,\nA-101,Ground Floor Plan,A,Working drawings / GFC,Meghna Joshi,01-12-2026,\nQ-301,Kitchen Equipment Layout,Q,Working drawings / GFC,,05-12-2026,\nP-120,Rainwater Harvesting Details,P,Working drawings / GFC,Imran Khan,31-11-2026,\n";
  DO.SAMPLE_CSV = SAMPLE_CSV;

  // ---------- Upload PDFs (UploadDropzone) ----------
  S.uploadPdfs = (ctx, u) => {
    const p = ctx.project; const up = (ui.state.up = ui.state.up && ui.state.up.pid === p.id ? ui.state.up : { pid: p.id, files: [] });
    const sheets = st.sheetsOf(p.id).filter((s) => !["superseded", "cancelled"].includes(s.state)).sort(DO.by("number"));
    return html`<div class="flex between wrap gap-2 mb-3"><div><h2 class="title">Upload PDFs</h2><p class="small muted">One PDF per sheet. Files are matched by the sheet number in the file name, then by the title-block text (F-50). Each upload becomes a draft revision with the next code.</p></div><a class="btn" href="#/projects/${p.id}/register">${icon("arrow-left", 16)}Back to register</a></div>
      ${C.card({ body: html`<div class="card-body stack"><label class="dropzone" data-drop="up-files" for="up-in">${icon("cloud-upload", 28, "primary-t")}<span class="strong">Drop PDFs here, or choose files</span><span class="small muted">Up to 200 MB each · PDF only · checked against the naming rule (A-04)</span><input id="up-in" type="file" multiple accept="application/pdf,.pdf" class="sr-only" data-change="up-files"></label><p class="small">Try the samples: <a class="link" href="assets/documents/sample-pdfs/M-206_C01.pdf" download>M-206_C01.pdf</a> · <a class="link" href="assets/documents/sample-pdfs/A-104_C01.pdf" download>A-104_C01.pdf</a> · <a class="link" href="assets/documents/sample-pdfs/A104 ground floor rev.pdf" download>A104 ground floor rev.pdf</a> (breaks the rule) · <a class="link" href="assets/documents/sample-pdfs/scan_0042.pdf" download>scan_0042.pdf</a> (matched from its title block)</p></div>` })}
      ${up.files.length ? C.card({ title: `${up.files.length} files`, cls: "mt-4", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>File</th><th>Size</th><th>Sheet</th><th>Check</th><th>Progress</th><th></th></tr></thead><tbody>${up.files.map((f, i) => { const s = f.sheetId ? st.sheet(f.sheetId) : null; const chk = s ? st.namingCheck(f.file.name, s) : null; return html`<tr><td class="small"><span class="mono">${f.file.name}</span></td><td class="small">${DO.fileSize(f.file.size)}</td><td>${f.error ? "—" : f.done ? html`${C.mono(s.number)}` : html`<select class="cell" style="max-width:200px" aria-label="Sheet for ${f.file.name}" data-change="up-pick" data-i="${i}"><option value="">Pick a sheet…</option>${sheets.map((x) => html`<option value="${x.id}" ${x.id === f.sheetId ? raw("selected") : ""}>${x.number} ${x.title.slice(0, 30)}</option>`)}</select>`}${f.how && !f.done ? html`<span class="small muted block">${f.how}</span>` : ""}</td><td class="small">${f.error ? html`<span class="danger-t">${f.error}</span>` : !s ? html`<span class="warn-t">Unmatched: pick the sheet</span>` : chk.ok ? html`<span class="ok-t">${icon("circle-check", 12)} Name OK</span>` : html`<span class="danger-t">${icon("triangle-alert", 12)} ${chk.message}</span>`}</td><td style="min-width:120px">${f.error ? "" : html`<span class="bar ${f.done ? "ok" : ""}" style="width:100px"><span style="width:${f.progress || 0}%"></span></span>`}${f.done ? html`<span class="small block">${f.result}</span>` : ""}</td><td>${f.done ? "" : C.btn("", { size: "sm", variant: "ghost", icon: "x", act: "up-remove", data: { i }, aria: `Remove ${f.file.name}` })}</td></tr>`; })}</tbody></table></div>`, foot: html`<span>${up.files.filter((f) => f.done).length} uploaded · ${up.files.filter((f) => !f.done && !f.error && f.sheetId).length} ready</span><span class="actions">${C.btn("Clear list", { size: "sm", act: "up-clear" })}${C.btn(`Upload ${up.files.filter((f) => !f.done && !f.error && f.sheetId).length} files`, { variant: "primary", icon: "upload", act: "up-go", disabled: !up.files.some((f) => !f.done && !f.error && f.sheetId) })}</span>` }) : ""}`;
  };
  async function addFiles(files) {
    const up = ui.state.up; const p = st.project(up.pid);
    for (const file of files) {
      const entry = { file, progress: 0 };
      if (!/\.pdf$/i.test(file.name)) { entry.error = `${file.name.split(".").pop().toUpperCase()} files are not accepted. Upload one PDF per sheet.`; up.files.push(entry); continue; }
      if (file.size > 200 * 1048576) { entry.error = "Larger than 200 MB."; up.files.push(entry); continue; }
      const m = file.name.toUpperCase().match(/([ASCMEPFXG])-?(\d{3})/);
      let s = m ? st.sheetsOf(p.id).find((x) => x.number === `${m[1]}-${m[2]}`) : null;
      if (s) entry.how = `Matched by file name${file.name.toUpperCase().includes(`${m[1]}-${m[2]}`) ? "" : " (hyphen missing)"}`;
      if (!s) { try { const text = new TextDecoder("latin1").decode(await file.slice(0, 2_000_000).arrayBuffer()); const t = text.match(/\(([ASCMEPFXG]-\d{3})\)\s*Tj/); if (t) { s = st.sheetsOf(p.id).find((x) => x.number === t[1]); if (s) entry.how = `Matched from the title block text (F-50): ${t[1]}`; } } catch (e) { /* unreadable */ } }
      entry.sheetId = s?.id || null; up.files.push(entry);
    }
    DO.app.render();
  }
  ui.on("up-files", (el) => { addFiles([...el.files]); el.value = ""; });
  ui.on("up-pick", (el) => { ui.state.up.files[+el.dataset.i].sheetId = el.value || null; ui.state.up.files[+el.dataset.i].how = el.value ? "Picked by hand" : ""; DO.app.render(); });
  ui.on("up-remove", (el) => { ui.state.up.files.splice(+el.dataset.i, 1); DO.app.render(); });
  ui.on("up-clear", () => { ui.state.up.files = []; DO.app.render(); });
  ui.on("up-go", async () => {
    const up = ui.state.up; const todo = up.files.filter((f) => !f.done && !f.error && f.sheetId);
    for (const f of todo) {
      for (let pct = 20; pct <= 100; pct += 40) { f.progress = pct; DO.app.render(); await new Promise((r) => setTimeout(r, 120)); }
      try { ui.state.batching = true; const rv = await st.uploadRevision(st.sheet(f.sheetId), f.file); ui.state.batching = false; f.done = true; f.result = rv.namingStatus === "ok" ? `Draft ${rv.code} created` : `Draft ${rv.code}: issue blocked by the naming rule`; }
      catch (e) { ui.state.batching = false; f.error = e.message; }
      DO.app.render();
    }
    ui.toast({ title: `${todo.filter((f) => f.done).length} PDFs uploaded`, description: "Each is a draft revision; issue them from the issue composer.", tone: "ok" });
  });
  // Drag and drop onto any dropzone.
  document.addEventListener("dragover", (e) => { const z = e.target.closest?.("[data-drop]"); if (z) { e.preventDefault(); z.classList.add("over"); } });
  document.addEventListener("dragleave", (e) => { e.target.closest?.("[data-drop]")?.classList.remove("over"); });
  document.addEventListener("drop", (e) => { const z = e.target.closest?.("[data-drop]"); if (!z) return; e.preventDefault(); z.classList.remove("over"); const files = [...e.dataTransfer.files]; const kind = z.dataset.drop; if (kind === "up-files") addFiles(files); else if (kind === "imp-file" && files[0]) readFileRows(files[0]).then((rows) => loadRows(rows, files[0].name)).catch((err) => { ui.state.imp.error = err.message; DO.app.render(); }); else DO.dropHandlers?.[kind]?.(files, z); });

  // ---------- CAD sync (F-09, I-03, I-04) ----------
  S.cadSync = (ctx, u) => {
    const p = ctx.project; const props = st.S.cadProposals.filter((x) => x.projectId === p.id);
    const open = props.filter((x) => x.status === "proposed"); const done = props.filter((x) => x.status !== "proposed");
    const can = st.isPL(u, p) || p.members.some((m) => m.userId === u.id && m.role === "DL");
    return html`<div class="flex between wrap gap-2 mb-3"><div><h2 class="title">CAD sync</h2><p class="small muted">The Revit add-in and AutoCAD plugin read sheet numbers, titles and revisions from the model or Sheet Set. New sheets are proposed, never created, until a lead accepts them.</p></div><div class="actions">${C.btn("Simulate a Revit sync", { icon: "refresh-ccw-dot", act: "cad-sim", data: { p: p.id } })}<a class="btn" href="#/projects/${p.id}/register">${icon("arrow-left", 16)}Register</a></div></div>
      <div class="grid g-side"><div class="stack">${C.card({ title: `Proposed · ${open.length}`, body: open.length ? html`<ul>${open.map((x) => { const s = x.sheetId ? st.sheet(x.sheetId) : null; return html`<li class="list-row"><span class="min-w-0"><span class="mono strong">${x.number}</span> ${x.kind === "new" ? html`${x.title} <span class="pill info">New sheet</span>` : html`<span class="pill warn">Title differs</span>`}<span class="small muted block">${x.source} · ${st.userName(x.by)} · ${DO.fmtRel(x.at)} · revision on title block ${C.mono(x.revision)}</span>${s ? html`<span class="grid g-2 mt-2" style="gap:8px"><span class="small"><span class="muted">Register:</span> ${s.title}</span><span class="small"><span class="muted">Model:</span> <strong>${x.title}</strong></span></span>` : ""}</span>${can ? html`<span class="actions">${C.btn(x.kind === "new" ? "Accept and create" : "Use model title", { size: "sm", variant: "primary", act: "cad-accept", data: { id: x.id } })}${C.btn(x.kind === "new" ? "Reject" : "Keep register", { size: "sm", act: "cad-reject", data: { id: x.id } })}</span>` : ""}</li>`; })}</ul>` : C.empty("Nothing waiting. Proposals appear here when a designer runs “Sync sheets” in Revit or AutoCAD.") })}${done.length ? C.card({ title: "Decided", body: html`<ul>${done.map((x) => html`<li class="list-row small"><span><span class="mono">${x.number}</span> ${x.title}</span><span class="pill ${x.status === "accepted" ? "ok" : ""}">${x.status}</span></li>`)}</ul>` }) : ""}</div>
      <div class="stack">${C.card({ title: "Plugins", body: html`<ul>${st.S.tokens.filter((t) => t.scope === "sheets:sync").map((t) => html`<li class="list-row"><span>${t.name}<span class="small muted block">Token ${C.mono(`${t.prefix}…`)} · last used ${DO.fmtRel(t.lastUsed)}</span></span><span class="pill ok">${icon("plug", 12)}Connected</span></li>`)}</ul>`, foot: html`<a class="link" href="#/admin/integrations">Manage tokens</a>` })}${C.card({ title: "File storage activity (I-02)", body: html`<ul>${st.S.cadEvents.filter((e) => st.sheet(e.sheetId)?.projectId === p.id).slice(0, 6).map((e) => html`<li class="list-row small"><span><span class="mono">${e.path.split(/[\\/]/).pop()}</span> ${e.event}</span><span class="muted">${DO.fmtRel(e.at)} · ${st.shortName(e.by)}</span></li>`)}</ul>`, foot: "Reported by the office file-server watcher; no CAD file is copied." })}</div></div>`;
  };
  ui.on("cad-accept", (el) => { const x = st.S.cadProposals.find((y) => y.id === el.dataset.id); const p = st.project(x.projectId); const u = DO.auth.current(); if (x.kind === "new") { const err = st.sheetNumberCheck(x.number, x.number[0], p); if (err) { ui.toast({ title: "Cannot create", description: err, tone: "bad" }); return; } const dl = p.members.find((m) => m.role === "DL" && m.discipline === x.number[0])?.userId || p.leadId; const s = { id: st.nextId("s"), projectId: p.id, number: x.number, title: x.title, discipline: x.number[0], stageId: st.activeStage(p.id).id, packageId: st.packagesOf(p.id).find((k) => k.discipline === x.number[0])?.id || null, ownerId: x.by, checkerId: dl === x.by ? p.leadId : dl, planned: DO.addWorkingDays(DO.today(), 20), state: "planned", stateBefore: null, currentRevId: null, notes: `Created from ${x.source}`, cadLink: `\\\\fileserver\\${p.code}\\MEP\\${x.number}.rvt`, aliases: [], reviewRound: 0, stateChangedAt: null, createdAt: new Date().toISOString(), replacedBy: null, cancelReason: "" }; st.S.sheets.push(s); st.audit("sheet", s.id, "created", null, { number: x.number }, { projectId: p.id, text: `${u.name} accepted ${x.number} from CAD sync` }); } else { const s = st.sheet(x.sheetId); st.editSheets([s.id], { title: x.title }, "CAD sync"); } x.status = "accepted"; st.commit(); ui.toast({ title: `${x.number} ${x.kind === "new" ? "added to the register" : "title updated"}`, tone: "ok" }); });
  ui.on("cad-reject", (el) => { const x = st.S.cadProposals.find((y) => y.id === el.dataset.id); x.status = "rejected"; st.audit("cadsync", x.id, "rejected", null, null, { projectId: x.projectId, text: `${DO.auth.current().name} rejected the CAD sync proposal ${x.number}` }); st.commit(); });
  ui.on("cad-sim", (el) => { const p = st.project(el.dataset.p); const n = 214 + st.S.cadProposals.length; st.S.cadProposals.push({ id: st.nextId("cp"), projectId: p.id, number: `M-${n}`, title: "Pharmacy Store Ventilation - Ground Floor", revision: "P01", kind: "new", source: "Revit 2025 · HSR_MEP_Central.rvt", by: "u_des", at: new Date().toISOString(), status: "proposed" }); const t = st.S.tokens.find((x) => x.scope === "sheets:sync"); if (t) t.lastUsed = new Date().toISOString(); st.commit(); ui.toast({ title: "Sync received from Revit", description: `1 new sheet proposed (M-${n}).`, tone: "ok" }); });
})(window);

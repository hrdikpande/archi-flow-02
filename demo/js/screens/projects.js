/* DrawingOps demo · projects: list, new project (F-01, F-02), header and tabs (DESIGN.md §3), overview
   (S-04, D-02), stage plan editor (S-11, F-02, F-03, F-26), team & hours and the activity feed (F-45). */
(function (root) {
  "use strict";
  const DO = root.DO; const { html, raw, icon, C } = DO; const st = DO.store; const ui = DO.ui;
  const S = DO.screens = DO.screens || {};
  const TYPES = [["hospital", "Hospital"], ["residential", "Residential"], ["commercial", "Commercial"], ["other", "Other"]];
  const typeLabel = (t) => (TYPES.find((x) => x[0] === t) || [t, t])[1];
  const canEdit = (u, p) => st.isPL(u, p) || u.orgRole === "owner" || u.orgRole === "admin";

  // ---------- Header + tabs ----------
  S.projectHeader = (p, active, u, ctx) => {
    const sg = st.activeStage(p.id); const accountsOnly = u.orgRole === "accounts" && !st.rolesOn(u, p).length;
    const cc = st.S.comments.filter((c) => c.projectId === p.id && ["new", "assigned"].includes(c.status)).length;
    const ca = st.S.rfis.filter((x) => x.projectId === p.id && x.status === "open").length + st.S.submittals.filter((x) => x.projectId === p.id && x.status === "open").length;
    const items = accountsOnly ? [{ key: "overview", label: "Overview", href: `#/projects/${p.id}` }, { key: "stages", label: "Stages", href: `#/projects/${p.id}/stages` }] : [
      { key: "overview", label: "Overview", href: `#/projects/${p.id}` }, { key: "register", label: "Register", href: `#/projects/${p.id}/register`, count: st.sheetsOf(p.id).length }, { key: "stages", label: "Stages", href: `#/projects/${p.id}/stages` }, { key: "transmittals", label: "Transmittals", href: `#/projects/${p.id}/transmittals` }, { key: "team", label: "Team & hours", href: `#/projects/${p.id}/team` }, { key: "activity", label: "Activity", href: `#/projects/${p.id}/activity` }, { key: "comments", label: "Comments", href: `#/projects/${p.id}/comments`, count: cc || null }, { key: "construction", label: "Construction", href: `#/projects/${p.id}/construction`, count: ca || null }, { key: "decisions", label: "Decisions", href: `#/projects/${p.id}/decisions` },
    ];
    return html`<header class="mb-3"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/projects">Projects</a>${icon("chevron-right", 12)}<span>${p.code}</span></nav><h1 class="display" style="overflow-wrap:anywhere"><span class="mono">${p.code}</span> · ${p.name}</h1>
      <p class="meta" style="margin-top:4px;font-size:12px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center"><span>${p.client}</span>${sg ? html`<span class="iflex items-center gap-1">Stage ${sg.seq} ${sg.name} ${C.stageChip(sg.state)}</span>` : html`<span>No stages yet</span>`}<span>Lead ${st.userName(p.leadId)}</span>${p.cad?.length ? html`<span>CAD: ${p.cad.join(", ")}</span>` : ""}${p.state !== "active" ? html`<span class="pill warn">${icon("pause", 12)}Project ${p.state === "on_hold" ? "on hold" : p.state}</span>` : ""}</p></header>${C.tabs(items, active, "Project sections")}`;
  };

  // ---------- Projects list ----------
  S.projects = (ctx, u) => {
    const q = ctx.query; const caps = st.caps(u);
    let list = st.visibleProjects(u);
    if (q.state) list = list.filter((p) => p.state === q.state); else list = list.filter((p) => p.state !== "closed");
    if (q.type) list = list.filter((p) => p.type === q.type);
    if (q.q) { const t = q.q.toLowerCase(); list = list.filter((p) => `${p.code} ${p.name} ${p.client} ${p.location}`.toLowerCase().includes(t)); }
    list.sort(DO.by("code", -1));
    ui.state.projectsExport = list;
    return html`${C.pageHead({ title: "Projects", meta: `${list.length} of ${st.visibleProjects(u).length} projects you can see`, actions: html`${C.btn("Export", { icon: "download", act: "export-projects" })}${caps.createProject ? C.linkBtn("New project", "#/projects/new", { variant: "primary", icon: "plus" }) : ""}` })}
      <div class="filterbar"><div class="search-box">${icon("search", 14)}<input id="pj-q" class="input" placeholder="Code, name, client or place" value="${q.q || ""}" data-input="pj-q" data-debounce="200" aria-label="Search projects"></div>${C.select({ options: [["", "Active and on hold"], ["active", "Active"], ["on_hold", "On hold"], ["closed", "Closed"]], value: q.state, change: "pj-filter", dataset: { k: "state" }, aria: "State" })}${C.select({ options: [["", "All types"], ...TYPES], value: q.type, change: "pj-filter", dataset: { k: "type" }, aria: "Type" })}</div>
      ${C.card({ body: list.length ? html`<div class="t-wrap"><table class="t"><thead><tr><th>Project</th><th class="hide-sm">Client</th><th class="hide-md">Type</th><th>Stage</th><th class="hide-sm">Lead</th><th class="right">Sheets</th><th class="right">Late</th><th class="right hide-sm">At risk</th><th class="hide-md">Dates</th></tr></thead><tbody>${list.map((p) => { const x = st.projectStats(p); const sg = st.activeStage(p.id); return html`<tr class="clickable" data-href="#/projects/${p.id}" tabindex="0"><td><a class="hover-u" href="#/projects/${p.id}">${C.mono(p.code)} <span class="strong">${p.name}</span></a><span class="small muted block">${p.location}</span></td><td class="hide-sm">${p.client}</td><td class="hide-md">${typeLabel(p.type)}</td><td>${p.state === "on_hold" ? C.chip("on_hold") : sg ? html`<span class="iflex gap-2 items-center nowrap">${sg.seq} ${sg.name} ${C.stageChip(sg.state)}</span>` : "—"}</td><td class="hide-sm">${st.shortName(p.leadId)}</td><td class="right tabular">${x.issued} / ${x.planned}</td><td class="right tabular">${x.late}</td><td class="right tabular hide-sm">${x.atRisk}</td><td class="small hide-md nowrap">${DO.fmtDate(p.start)} – ${DO.fmtDate(p.end)}</td></tr>`; })}</tbody></table></div>` : C.empty("No projects match. Clear the filters, or create a new project.") })}`;
  };
  ui.on("pj-q", (el) => DO.app.setQuery({ q: el.value }));
  ui.on("pj-filter", (el) => DO.app.setQuery({ [el.dataset.k]: el.value }));
  ui.on("export-projects", (el) => C.exportMenu(el, () => ({ name: "projects", title: "Project list", columns: [{ label: "Code", mono: true }, { label: "Name", w: 2 }, { label: "Client", w: 2 }, { label: "Type" }, { label: "Stage", w: 1.6 }, { label: "Lead", w: 1.2 }, { label: "Issued", right: true }, { label: "Planned", right: true }, { label: "Late", right: true }, { label: "Start" }, { label: "End" }], rows: (ui.state.projectsExport || []).map((p) => { const x = st.projectStats(p); const sg = st.activeStage(p.id); return [p.code, p.name, p.client, typeLabel(p.type), sg ? `${sg.seq} ${sg.name}` : "", st.userName(p.leadId), x.issued, x.planned, x.late, DO.fmtDate(p.start), DO.fmtDate(p.end)]; }) })));

  // ---------- New project (F-01, F-02) ----------
  function nextCode() { const y = DO.today().slice(0, 4); const n = Math.max(0, ...st.S.projects.filter((p) => p.code.startsWith(y)).map((p) => +p.code.slice(5))) + 1; return `${y}-${String(n).padStart(3, "0")}`; }
  S.newProject = (ctx, u) => {
    const e = ui.state.npErrors || {}; const v = ui.state.npValues || {};
    const orgs = [...new Set(st.S.contacts.filter((c) => c.kind === "client").map((c) => c.org))];
    return html`${C.pageHead({ title: "New project", crumbs: [{ label: "Projects", href: "#/projects" }, { label: "New project" }], meta: "The project appears in the list and the portfolio with its stages planned. You can attach the appointment letter on the Stages tab." })}
      <form data-submit="np-create" novalidate class="card"><div class="card-body form-grid">
        ${C.field("Project code", html`<input id="np-code" name="code" class="input mono" required value="${v.code || nextCode()}" ${e.code ? raw('aria-invalid="true"') : ""}>`, { for: "np-code", hint: `Format ${st.S.org.projectCodeFormat}, unique in the firm.`, error: e.code })}
        ${C.field("Project name", html`<input id="np-name" name="name" class="input" required value="${v.name || ""}" ${e.name ? raw('aria-invalid="true"') : ""} placeholder="e.g. Sarjapur Road Cancer Centre">`, { for: "np-name", error: e.name })}
        ${C.field("Client", html`<input id="np-client" name="client" class="input" list="np-clients" required value="${v.client || ""}" ${e.client ? raw('aria-invalid="true"') : ""}><datalist id="np-clients">${orgs.map((o) => html`<option value="${o}">`)}</datalist>`, { for: "np-client", hint: "Pick an existing client or type a new one (it is added to Contacts).", error: e.client })}
        ${C.field("Type", C.select({ id: "np-type", name: "type", options: TYPES, value: v.type || "hospital" }), { for: "np-type" })}
        ${C.field("Location", html`<input id="np-loc" name="location" class="input" value="${v.location || ""}" placeholder="Area, city">`, { for: "np-loc" })}
        ${C.field("Fee value (₹, optional)", html`<input id="np-fee" name="fee" class="input tabular" inputmode="numeric" value="${v.fee || ""}" placeholder="e.g. 1,20,00,000">`, { for: "np-fee", hint: "Used to show fee amounts per stage in billing signals." })}
        ${C.field("Start", html`<input id="np-start" type="date" name="start" class="input" required value="${v.start || DO.today()}">`, { for: "np-start" })}
        ${C.field("End", html`<input id="np-end" type="date" name="end" class="input" required value="${v.end || DO.addDays(DO.today(), 540)}" ${e.end ? raw('aria-invalid="true"') : ""}>`, { for: "np-end", error: e.end })}
        ${C.field("Project lead", C.select({ id: "np-lead", name: "lead", options: st.S.users.filter((x) => x.canLead && x.active).map((x) => [x.id, x.name]), value: v.lead || (u.canLead ? u.id : "u_pl") }), { for: "np-lead" })}
        ${C.field("Document controller", C.select({ id: "np-dc", name: "dc", options: [["", "The project lead (small project)"], ...st.S.users.filter((x) => /Document/.test(x.title)).map((x) => [x.id, x.name])], value: v.dc ?? "u_dc" }), { for: "np-dc", hint: "On small projects the PL can act as document controller (AS-07)." })}
        ${C.field("Stage template", C.select({ id: "np-tpl", name: "tpl", options: st.S.stageTemplates.map((t) => [t.id, `${t.name}${t.isDefault ? " (default)" : ""}`]), value: v.tpl || st.S.stageTemplates.find((t) => t.isDefault)?.id }), { for: "np-tpl", hint: "Names, fee % and dates stay editable." })}
        ${C.field("CAD versions in use", html`<input id="np-cad" name="cad" class="input" value="${v.cad || "AutoCAD 2025, Revit 2025"}">`, { for: "np-cad", hint: "Free-text tags, comma-separated." })}
      </div><div class="card-foot" style="justify-content:flex-end"><a class="btn" href="#/projects">Cancel</a><button class="btn primary">${icon("plus", 16)}Create project</button></div></form>`;
  };
  ui.on("np-create", (form, d) => {
    const e = {}; const code = d.code.trim();
    if (!/^\d{4}-\d{3}$/.test(code)) e.code = `Use the format ${st.S.org.projectCodeFormat}, for example ${nextCode()}.`;
    else if (st.S.projects.some((p) => p.code === code)) e.code = `Code ${code} is already used by ${st.S.projects.find((p) => p.code === code).name}. Codes are unique in the firm.`;
    if (!d.name.trim()) e.name = "Enter the project name.";
    if (!d.client.trim()) e.client = "Enter the client.";
    if (d.end < d.start) e.end = "The end date must be on or after the start date.";
    ui.state.npValues = d;
    if (Object.keys(e).length) { ui.state.npErrors = e; DO.app.render(); document.querySelector("[aria-invalid=true]")?.focus(); return; }
    ui.state.npErrors = null; ui.state.npValues = null;
    const u = DO.auth.current(); const id = st.nextId("p");
    let contact = st.S.contacts.find((c) => c.org === d.client.trim() && c.kind === "client");
    if (!contact) { contact = { id: st.nextId("k"), name: `${d.client.trim()} (main contact)`, email: "", org: d.client.trim(), kind: "client", phone: "", notes: "Added from New project" }; st.S.contacts.push(contact); }
    const p = { id, code, name: d.name.trim(), description: "", type: d.type, clientId: contact.id, client: d.client.trim(), location: d.location.trim(), start: d.start, end: d.end, fee: +String(d.fee).replace(/[^\d]/g, "") || 0, cad: d.cad.split(",").map((x) => x.trim()).filter(Boolean), state: "active", leadId: d.lead, members: [{ userId: d.lead, role: "PL", discipline: "" }, ...(d.dc ? [{ userId: d.dc, role: "DC", discipline: "" }] : [])], letter: null, projectEmail: `p-${code}@in.drawingops.example`, createdAt: new Date().toISOString(), recipients: [contact.id], siteToken: `site-${code}-${Math.random().toString(36).slice(2, 7)}` };
    st.S.projects.push(p);
    const tpl = st.S.stageTemplates.find((t) => t.id === d.tpl) || st.S.stageTemplates[0];
    const span = DO.diffDays(d.start, d.end); let cur = d.start;
    tpl.items.forEach((it, i) => { const len = Math.max(7, Math.round(span / tpl.items.length)); const pe = DO.addDays(cur, len); st.S.stages.push({ id: st.nextId("st"), projectId: id, seq: i + 1, name: it.name, pct: it.pct, plannedStart: cur, plannedEnd: pe, actualStart: null, actualEnd: null, state: "planned", requiredPurposes: /GFC|Working|Construction/.test(it.name) ? ["GFC"] : ["FA", "FC"], seniorQC: false, final: Math.abs(DO.sum(tpl.items, (x) => x.pct) - 100) < 0.01, readySince: null, invoicedAt: null, invoiceRef: null }); cur = DO.addDays(pe, 1); });
    st.audit("project", id, "created", null, { code, name: p.name }, { projectId: id, text: `${u.name} created project ${code} ${p.name} with the “${tpl.name}” stage template` });
    st.notify([d.lead, d.dc].filter((x) => x && x !== u.id), "team", `You were added to ${code} ${p.name}`, `${u.name} added you as ${d.lead === u.id ? "document controller" : "project lead"}.`, `#/projects/${id}`);
    st.commit();
    ui.toast({ title: `${code} created`, description: "Next: check the stage plan and add the team.", tone: "ok" });
    DO.app.go(`/projects/${id}/stages`);
  });

  // ---------- S-04 Project overview (D-02) ----------
  function burnUp(p, disc) {
    const list = st.sheetsOf(p.id).filter((s) => s.state !== "cancelled" && (!disc || s.discipline === disc));
    const deliverableIssue = (s) => { const v = st.revisionsOf(s.id).filter((r) => r.issuedAt && r.stageId === s.stageId).sort(DO.by("issuedAt"))[0]; return v ? DO.dateOf(v.issuedAt) : null; };
    const planned = list.map((s) => st.effPlanned(s)).filter(Boolean).sort(); const issued = list.map(deliverableIssue).filter(Boolean).sort();
    if (!planned.length) return null;
    const start = [planned[0], issued[0] || planned[0]].sort()[0]; const end = planned[planned.length - 1] > DO.today() ? planned[planned.length - 1] : DO.today();
    const pts = []; const step = Math.max(7, Math.round(DO.diffDays(start, end) / 24));
    for (let d = start; d <= end; d = DO.addDays(d, step)) pts.push(d); if (pts[pts.length - 1] !== end) pts.push(end);
    const T = DO.today();
    return { planned: pts.map((d) => [d, planned.filter((x) => x <= d).length]), issued: pts.filter((d) => d <= T).concat(T > pts[pts.length - 1] ? [] : [T]).sort().map((d) => [d, issued.filter((x) => x <= d).length]), total: list.length };
  }
  S.projectOverview = (ctx, u) => {
    const p = ctx.project; const x = st.projectStats(p); const caps = st.caps(u); const stages = st.stagesOf(p.id);
    const accountsOnly = u.orgRole === "accounts" && !st.rolesOn(u, p).length;
    const stageTl = html`<div class="stage-tl" role="list">${stages.map((sg) => html`<div role="listitem" class="st ${["active", "on_hold"].includes(sg.state) ? "cur" : ["invoiced", "closed", "ready_to_invoice", "client_approved", "deliverables_issued"].includes(sg.state) ? "done" : ""}"><p class="strong">${sg.seq} ${sg.name}</p><p>${sg.pct}% · ${DO.fmtShort(sg.plannedStart)} – ${DO.fmtShort(sg.plannedEnd)}</p><p class="mt-1">${C.stageChip(sg.state)}</p></div>`)}</div>`;
    if (accountsOnly) return html`${C.card({ title: "Stages and fees", body: html`<div class="card-body">${stageTl}</div>`, foot: html`<span>Accounts sees stage data only.</span><a class="link" href="#/billing">Billing signals</a>` })}`;
    const disc = ctx.query.disc || ""; const bu = burnUp(p, disc);
    const late = st.sheetsOf(p.id).filter(st.isLate).sort((a, b) => (st.effPlanned(a) > st.effPlanned(b) ? 1 : -1));
    const week = DO.mondayOf(DO.today());
    const alloc = DO.groupBy(st.S.allocations.filter((a) => a.projectId === p.id && a.week === week), (a) => a.userId);
    const trs = st.S.transmittals.filter((t) => t.projectId === p.id).slice(-5).reverse();
    const unack = st.S.transmittals.filter((t) => t.projectId === p.id && t.recipients.some((r) => r.delivery === "email" && !r.ackAt && DO.diffDays(DO.dateOf(t.sentAt), DO.today()) > st.S.org.ackDays));
    const comments = st.S.comments.filter((c) => c.projectId === p.id && ["new", "assigned", "responded"].includes(c.status));
    const cos = st.S.changeOrders.filter((c) => c.projectId === p.id);
    const discs = [...new Set(st.sheetsOf(p.id).map((s) => s.discipline))];
    const risks = caps.forecasts ? st.sheetsOf(p.id).map((s) => ({ s, r: st.lateRisk(s) })).filter((y) => y.r).sort((a, b) => b.r.prob - a.r.prob).slice(0, 4) : [];
    return html`<div class="stack">
      <div class="metrics">${C.metric({ label: "Sheets issued / planned", value: `${x.issued} / ${x.planned}`, href: `#/projects/${p.id}/register`, hint: `${x.planned ? Math.round((x.issued / x.planned) * 100) : 0}% issued` })}${C.metric({ label: "Late", icon: "alarm-clock-off", value: x.late, href: `#/projects/${p.id}/register?flag=late` })}${C.metric({ label: "At risk", icon: "clock-alert", value: x.atRisk, href: `#/projects/${p.id}/register?flag=at_risk` })}${C.metric({ label: "Waiting for check", icon: "search-check", value: st.sheetsOf(p.id).filter((s) => ["ready_for_check", "in_check"].includes(s.state)).length, href: `#/projects/${p.id}/register?state=ready_for_check&state=in_check` })}${C.metric({ label: "Unacknowledged transmittals", icon: "mail", value: unack.length, href: `#/projects/${p.id}/transmittals?ack=0`, hint: `older than ${st.S.org.ackDays} days` })}${C.metric({ label: "Open client comments", icon: "message-square-text", value: comments.length, href: `#/projects/${p.id}/comments` })}</div>
      <div class="grid g-side">
        <div class="stack">
          ${bu ? C.card({ title: "Sheets planned vs issued", actions: C.select({ options: [["", "All disciplines"], ...discs.map((d) => [d, st.disc(d)?.name])], value: disc, change: "po-disc", aria: "Discipline", cls: "sm" }), body: C.chartBox(`bu-${p.id}`, C.lineChart({ id: `bu-${p.id}`, yLabel: "Cumulative sheets", todayX: DO.today(), series: [{ label: "Planned", color: "var(--chart-1)", dash: true, points: bu.planned }, { label: "Issued", color: "var(--chart-2)", points: bu.issued }] }), html`<table class="t"><thead><tr><th>Date</th><th class="right">Planned (cumulative)</th><th class="right">Issued (cumulative)</th></tr></thead><tbody>${bu.planned.map(([d, n]) => html`<tr><td>${DO.fmtDate(d)}</td><td class="right">${n}</td><td class="right">${bu.issued.find((y) => y[0] === d)?.[1] ?? "—"}</td></tr>`)}</tbody></table>`, html`<span class="legend"><span><i class="dash" style="border-color:var(--chart-1)"></i>Planned</span><span><i style="border-color:var(--chart-2)"></i>Issued</span><span>${bu.total} sheets</span></span>`) }) : ""}
          ${C.card({ title: "Stage timeline", actions: C.linkBtn("Stage plan", `#/projects/${p.id}/stages`, { size: "sm" }), body: html`<div class="card-body">${stageTl}</div>` })}
          ${C.card({ title: `Late sheets · ${late.length}`, actions: late.length ? C.linkBtn("Open in register", `#/projects/${p.id}/register?flag=late`, { size: "sm" }) : "", body: late.length ? html`<div class="t-wrap"><table class="t"><tbody>${late.slice(0, 10).map((s) => html`<tr class="clickable" data-href="#/projects/${p.id}/sheets/${s.id}" tabindex="0"><td>${DO.sheetLink(s)}</td><td class="hide-sm">${st.shortName(s.ownerId)}</td><td>${C.sheetStatus(s)}</td><td class="small nowrap">${DO.fmtDate(st.effPlanned(s))}</td></tr>`)}</tbody></table></div>` : C.empty("No late sheets on this project.") })}
        </div>
        <div class="stack">
          ${C.card({ title: "Project", actions: html`${canEdit(u, p) ? C.btn("Edit", { size: "sm", icon: "pencil", act: "po-edit", data: { id: p.id } }) : ""}${canEdit(u, p) ? C.btn("Export data", { size: "sm", icon: "download", act: "po-export", data: { id: p.id }, title: "Full project export: JSON plus every issued PDF (N-06)" }) : ""}`, body: html`<dl class="kv card-body"><dt>Client</dt><dd>${p.client}</dd><dt>Type</dt><dd>${typeLabel(p.type)}</dd><dt>Location</dt><dd>${p.location || "—"}</dd><dt>Dates</dt><dd>${DO.fmtDate(p.start)} – ${DO.fmtDate(p.end)}</dd><dt>Fee</dt><dd>${p.fee ? DO.fmtINR(p.fee) : "—"}</dd><dt>CAD</dt><dd>${p.cad.map((c) => html`<span class="pill">${c}</span> `)}</dd><dt>Letter</dt><dd>${p.letter ? html`<button class="link" data-act="po-letter" data-id="${p.id}">${p.letter.name}</button>` : html`<a class="link" href="#/projects/${p.id}/stages">Attach</a>`}</dd><dt>Comments in</dt><dd><span class="mono small" style="white-space:normal;overflow-wrap:anywhere">${p.projectEmail}</span></dd><dt>Site view</dt><dd><a class="link" href="#/site/${p.siteToken}">Open</a> · <button class="link" data-act="po-copy-site" data-id="${p.id}">Copy link</button></dd></dl>` })}
          ${C.card({ title: "Team allocation this week", actions: C.linkBtn("Workload", `#/workload?project=${p.id}`, { size: "sm" }), body: Object.keys(alloc).length ? html`<ul>${Object.entries(alloc).map(([uid, list]) => { const pu = st.user(uid); const pct = st.loadPct(pu, week); const fl = st.loadFlag(pct); return html`<li class="list-row"><span>${pu.name}<span class="small muted block">${DO.sum(list, (a) => a.hours)} h here</span></span>${fl === "over" ? C.flag("over_allocated", `${pct}%`, "Above 110% of capacity this week (A-05).") : fl === "under" ? C.flag("under_allocated", `${pct}%`, "Below 50% of capacity this week (A-05).") : html`<span class="small tabular">${pct}%</span>`}</li>`; })}</ul>` : C.empty("No hours allocated this week.") })}
          ${C.card({ title: "Recent transmittals", actions: C.linkBtn("All", `#/projects/${p.id}/transmittals`, { size: "sm" }), body: trs.length ? html`<ul>${trs.map((t) => html`<li class="list-row"><a class="hover-u" href="#/projects/${p.id}/transmittals/${t.id}">${C.mono(t.number)}<span class="small muted block">${t.items.length} sheets · ${st.purposeLabel(t.purpose)}</span></a><span class="small muted">${DO.fmtDate(t.sentAt)}<br>${t.recipients.filter((r) => r.ackAt).length}/${t.recipients.length} ack</span></li>`)}</ul>` : C.empty("Nothing issued yet.") })}
          ${comments.length ? C.card({ title: `Open client comments · ${comments.length}`, actions: C.linkBtn("Comments", `#/projects/${p.id}/comments`, { size: "sm" }), body: html`<ul>${comments.slice(0, 4).map((c) => html`<li class="list-row"><a class="hover-u small" href="#/projects/${p.id}/comments?c=${c.id}">${C.mono(c.number)} ${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}</a></li>`)}</ul>` }) : ""}
          ${cos.length ? C.card({ title: `Change orders · ${cos.length}`, actions: C.linkBtn("Construction", `#/projects/${p.id}/construction/changes`, { size: "sm" }), body: html`<ul>${cos.map((c) => html`<li class="list-row"><span class="small">${C.mono(c.number)} ${c.description}</span><span class="pill ${c.status === "approved" ? "ok" : c.status === "pending" ? "warn" : ""}">${c.status}</span></li>`)}</ul>` }) : ""}
          ${risks.length ? C.card({ title: "Forecast: likely to go late", actions: html`<span class="pill forecast">${icon("sparkles", 12)}Advisory</span>`, body: html`<ul>${risks.map(({ s, r }) => html`<li class="list-row"><span class="min-w-0">${DO.sheetLink(s)}<span class="small muted block">${r.reasons[0]}</span></span><span class="pill forecast">${r.prob}%</span></li>`)}</ul>` }) : ""}
        </div>
      </div></div>`;
  };
  ui.on("po-disc", (el) => DO.app.setQuery({ disc: el.value }));
  /** N-06: full project export, JSON records plus the current issued PDFs, as one ZIP. */
  ui.on("po-export", (el) => {
    const p = st.project(el.dataset.id); const sheets = st.sheetsOf(p.id); const sids = new Set(sheets.map((s) => s.id));
    const data = { exportedAt: new Date().toISOString(), exportedBy: DO.auth.current().email, project: p, stages: st.stagesOf(p.id), packages: st.packagesOf(p.id), sheets, revisions: st.S.revisions.filter((v) => sids.has(v.sheetId)), reviews: st.S.reviews.filter((v) => sids.has(v.sheetId)), transitions: st.S.transitions.filter((t) => sids.has(t.sheetId)), transmittals: st.S.transmittals.filter((t) => t.projectId === p.id), comments: st.S.comments.filter((c) => c.projectId === p.id), approvals: st.S.approvals.filter((a) => a.projectId === p.id), rfis: st.S.rfis.filter((x) => x.projectId === p.id), submittals: st.S.submittals.filter((x) => x.projectId === p.id), changeOrders: st.S.changeOrders.filter((x) => x.projectId === p.id), decisions: st.S.decisions.filter((x) => x.projectId === p.id) };
    const pdfs = sheets.filter((s) => s.currentRevId).slice(0, 60).map((s) => { const v = st.revision(s.currentRevId); return { name: `issued/${s.number}_${v.code}.pdf`, data: C.revisionPdf(v) }; });
    DO.download(new Blob([DO.zip.zip([{ name: "project.json", data: JSON.stringify(data, null, 2) }, ...pdfs])], { type: "application/zip" }), `${p.code}_full-export.zip`);
    st.audit("project", p.id, "export", null, { sheets: sheets.length, pdfs: pdfs.length }, { projectId: p.id, text: `${DO.auth.current().name} exported ${p.code} (JSON + ${pdfs.length} issued PDFs)` }); st.save();
    ui.toast({ title: `${p.code} exported`, description: `project.json with ${sheets.length} sheets and ${pdfs.length} current issued PDFs${pdfs.length === 60 ? " (first 60 in the demo)" : ""}.`, tone: "ok" });
  });
  ui.on("po-copy-site", (el) => { const p = st.project(el.dataset.id); const url = `${location.href.split("#")[0]}#/site/${p.siteToken}`; navigator.clipboard?.writeText(url).then(() => ui.toast({ title: "Site view link copied", description: "Anyone with the link sees only current issued drawings.", tone: "ok" }), () => ui.toast({ title: "Copy this link", description: url })); });
  ui.on("po-letter", (el) => { const p = st.project(el.dataset.id); DO.download(new Blob([appointmentLetter(p)], { type: "application/pdf" }), p.letter.name); });
  function appointmentLetter(p) {
    const doc = new DO.pdf.Doc({ title: `${p.code} appointment letter` }); const pg = doc.page();
    const c = st.contact(p.clientId);
    pg.text(40, 60, p.client, { size: 14, font: "F2" }); pg.text(40, 76, p.location, { size: 9, color: [0.4, 0.4, 0.45] });
    pg.text(555, 60, DO.fmtDate(p.start), { size: 9, align: "right" });
    pg.text(40, 120, `To: ${st.S.org.name}`, { size: 10 }); pg.text(40, 134, st.S.org.address, { size: 9 });
    pg.text(40, 170, `Subject: Appointment as architects and MEP consultants for ${p.name}`, { size: 11, font: "F2" });
    let y = pg.para(40, 196, `We are pleased to appoint you as the architects and MEP engineering consultants for ${p.name} (${p.description || typeLabel(p.type)}) at ${p.location}, with a total professional fee of ${DO.fmtINR(p.fee).replace("₹", "Rs ")} plus applicable taxes, payable on completion of each stage as below.`, 515, { size: 10 }) + 10;
    st.stagesOf(p.id).forEach((sg) => { pg.text(56, y, `${sg.seq}. ${sg.name}`, { size: 10 }); pg.text(400, y, `${sg.pct}%`, { size: 10, align: "right" }); pg.text(530, y, DO.fmtINR(st.stageFee(sg)).replace("₹", "Rs "), { size: 10, align: "right" }); y += 16; });
    y = pg.para(40, y + 14, "Stage payments fall due when the stage deliverables are issued and approved by us in writing. Drawings will be issued with numbered transmittals.", 515, { size: 10 }) + 30;
    pg.text(40, y, "For the client,", { size: 10 }); pg.text(40, y + 40, c?.name || "Authorised signatory", { size: 10, font: "F2" });
    pg.text(40, 800, "Sample document generated by the DrawingOps demo. Fictional parties and amounts.", { size: 7, color: [0.5, 0.5, 0.55] });
    return doc.output();
  }
  DO.appointmentLetter = appointmentLetter;
  ui.on("po-edit", (el) => {
    const p = st.project(el.dataset.id);
    ui.drawer({ title: `Edit ${p.code}`, body: html`<form id="pe-f" data-submit="po-save" class="stack"><input type="hidden" name="id" value="${p.id}">${C.field("Name", html`<input id="pe-n" name="name" class="input" value="${p.name}" required>`, { for: "pe-n" })}${C.field("Location", html`<input id="pe-l" name="location" class="input" value="${p.location}">`, { for: "pe-l" })}${C.field("End date", html`<input id="pe-e" name="end" type="date" class="input" value="${p.end}">`, { for: "pe-e" })}${C.field("CAD versions", html`<input id="pe-c" name="cad" class="input" value="${p.cad.join(", ")}">`, { for: "pe-c" })}${C.field("Fee value (₹)", html`<input id="pe-fee" name="fee" class="input" value="${p.fee}">`, { for: "pe-fee" })}${C.field("Project state", C.select({ id: "pe-s", name: "state", options: [["active", "Active"], ["on_hold", "On hold"], ["closed", "Closed"]], value: p.state }), { for: "pe-s", hint: "Closing a project keeps every record; it leaves the active portfolio." })}</form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="pe-f">Save</button>` });
  });
  ui.on("po-save", (form, d) => { const p = st.project(d.id); const before = { name: p.name, location: p.location, end: p.end, state: p.state, fee: p.fee }; if (d.end < p.start) { ui.toast({ title: "End date is before the start date", tone: "bad" }); return; } Object.assign(p, { name: d.name.trim() || p.name, location: d.location, end: d.end, cad: d.cad.split(",").map((x) => x.trim()).filter(Boolean), state: d.state, fee: +String(d.fee).replace(/[^\d]/g, "") || 0 }); st.audit("project", p.id, "edit", before, { name: p.name, location: p.location, end: p.end, state: p.state, fee: p.fee }, { projectId: p.id, text: `${DO.auth.current().name} edited project ${p.code}` }); ui.closeTop(); st.commit(); ui.toast({ title: "Project saved", tone: "ok" }); });

  // ---------- S-11 Stage plan editor ----------
  S.stages = (ctx, u) => {
    const p = ctx.project; const editable = canEdit(u, p) && st.project(p.id).state !== "closed";
    const stages = st.stagesOf(p.id); const total = Math.round(DO.sum(stages, (x) => x.pct) * 100) / 100;
    const ok = Math.abs(total - 100) <= 0.01; const final = stages.every((x) => x.final);
    const admin = u.orgRole === "admin";
    const approvals = st.S.approvals.filter((a) => a.projectId === p.id);
    return html`<div class="flex between items-start wrap gap-3 mb-3"><div><h2 class="title">Stage plan</h2><p class="small muted">Fee stages from the appointment letter. Stages move as sheets move (§4); approvals and invoicing follow.</p></div>
      ${editable ? html`<div class="actions">${C.select({ id: "sp-tpl", options: st.S.stageTemplates.map((t) => [t.id, t.name]), value: "", placeholder: "Apply template…", change: "sp-template", dataset: { p: p.id }, aria: "Apply stage template" })}${C.btn(p.letter ? "Replace appointment letter" : "Attach appointment letter", { icon: "upload", act: "sp-letter", data: { p: p.id } })}</div>` : ""}</div>
      ${p.letter ? html`<p class="small mb-3">${icon("file-text", 14)} <button class="link" data-act="po-letter" data-id="${p.id}">${p.letter.name}</button> <span class="muted">· ${DO.fileSize(p.letter.size)} · uploaded ${DO.fmtDate(p.letter.uploadedAt)} by ${st.userName(p.letter.by)}</span></p>` : ""}
      ${C.card({ body: html`<div class="t-wrap"><table class="t"><thead><tr><th>#</th><th>Stage</th><th class="right">Fee %</th><th class="hide-sm right">Fee</th><th>Planned start</th><th>Planned end</th><th class="hide-md">Required purposes</th><th class="hide-md">Senior QC</th><th>State</th><th class="hide-md">Actual</th>${editable ? html`<th></th>` : ""}</tr></thead><tbody>
        ${stages.map((sg) => { const locked = ["invoiced", "closed"].includes(sg.state) && !admin; const dis = !editable || locked; return html`<tr>
          <td class="tabular">${sg.seq}</td>
          <td>${dis ? sg.name : html`<input id="sp-n-${sg.id}" class="input sm" style="min-width:160px" value="${sg.name}" data-change="sp-field" data-id="${sg.id}" data-k="name" aria-label="Stage ${sg.seq} name">`}</td>
          <td class="right">${dis ? html`${sg.pct}%${locked ? html` <span data-tip="Fee % is locked after invoicing unless an Admin changes it." tabindex="0">${icon("lock", 12)}</span>` : ""}` : html`<input id="sp-p-${sg.id}" class="input sm tabular right" style="width:72px" inputmode="decimal" value="${sg.pct}" data-change="sp-field" data-id="${sg.id}" data-k="pct" aria-label="Stage ${sg.seq} fee percent">`}</td>
          <td class="right tabular hide-sm small">${p.fee ? DO.fmtINR(st.stageFee(sg)) : "—"}</td>
          <td>${dis ? DO.fmtDate(sg.plannedStart) : html`<input id="sp-s-${sg.id}" type="date" class="input sm" value="${sg.plannedStart}" data-change="sp-field" data-id="${sg.id}" data-k="plannedStart" aria-label="Stage ${sg.seq} planned start">`}</td>
          <td>${dis ? DO.fmtDate(sg.plannedEnd) : html`<input id="sp-e-${sg.id}" type="date" class="input sm" value="${sg.plannedEnd}" data-change="sp-field" data-id="${sg.id}" data-k="plannedEnd" aria-label="Stage ${sg.seq} planned end" ${sg.plannedEnd < sg.plannedStart ? raw('aria-invalid="true"') : ""}>`}${sg.plannedEnd < sg.plannedStart ? html`<p class="err small">${icon("circle-alert", 12)} End before start</p>` : ""}</td>
          <td class="hide-md"><span class="flex wrap gap-1">${st.S.org.purposes.filter((x) => x.active).map((pp) => html`<label class="pill" style="cursor:${dis ? "default" : "pointer"};${sg.requiredPurposes.includes(pp.code) ? "background:var(--info-bg);color:var(--info-fg);border-color:transparent" : ""}"><input type="checkbox" class="sr-only" ${sg.requiredPurposes.includes(pp.code) ? raw("checked") : ""} ${dis ? raw("disabled") : ""} data-change="sp-purpose" data-id="${sg.id}" data-code="${pp.code}">${pp.code}</label>`)}</span></td>
          <td class="hide-md"><label class="check"><input type="checkbox" ${sg.seniorQC ? raw("checked") : ""} ${dis ? raw("disabled") : ""} data-change="sp-qc" data-id="${sg.id}"><span class="sr-only">Senior QC required for stage ${sg.seq}</span></label></td>
          <td>${C.stageChip(sg.state)}${sg.state === "ready_to_invoice" ? html`<span class="small muted block">${st.workingDaysWaiting(sg.readySince)} days waiting</span>` : ""}${sg.state === "invoiced" && sg.invoiceRef ? html`<span class="small muted block mono">${sg.invoiceRef}</span>` : ""}</td>
          <td class="small hide-md nowrap">${sg.actualStart ? DO.fmtDate(sg.actualStart) : "—"} – ${sg.actualEnd ? DO.fmtDate(sg.actualEnd) : "—"}</td>
          ${editable ? html`<td class="right">${stageActions(sg, u, p)}</td>` : ""}
        </tr>`; })}
      </tbody><tfoot><tr><td></td><td class="strong">Total</td><td class="right strong tabular" style="color:${ok ? "var(--ok-fg)" : "var(--danger)"}">${total}%</td><td class="right tabular hide-sm small">${p.fee ? DO.fmtINR(DO.sum(stages, st.stageFee)) : ""}</td><td colspan="${editable ? 7 : 6}">${ok ? html`<span class="small ok-t">${icon("circle-check", 14)} Fees total 100%</span>` : html`<span class="small danger-t">${icon("circle-alert", 14)} Fees must total 100% (± 0.01) to save the plan as final. You can keep a draft.</span>`}</td></tr></tfoot></table></div>`,
        foot: html`<span>${final ? html`${icon("lock", 12)} Plan saved as final` : html`${icon("pencil", 12)} Draft plan`} · changes are audited (F-39)</span>${editable ? html`<span class="actions">${C.btn("Add stage", { size: "sm", icon: "plus", act: "sp-add", data: { p: p.id } })}${C.btn(final ? "Saved as final" : "Save as final", { size: "sm", variant: "primary", icon: "lock", act: "sp-final", data: { p: p.id }, disabled: !ok || final, title: ok ? "" : "Fees must total 100%" })}</span>` : ""}` })}
      ${approvals.length ? C.card({ title: "Client approvals", cls: "mt-4", body: html`<ul>${approvals.map((a) => { const sg = st.stage(a.stageId); return html`<li class="list-row"><span>Stage ${sg.seq} ${sg.name} · approved by ${st.contact(a.by)?.name || a.by} on ${DO.fmtDate(a.date)}<span class="small muted block">${a.note}</span></span><span class="small">${icon("file-text", 12)} ${a.evidence}</span></li>`; })}</ul>` }) : ""}`;
  };
  function stageActions(sg, u, p) {
    const out = [];
    if (sg.state === "deliverables_issued" && st.isPL(u, p)) out.push(C.btn("Record client approval", { size: "sm", variant: "primary", act: "sp-approve", data: { id: sg.id } }));
    if (sg.state === "planned" && st.isPL(u, p)) out.push(C.btn("Start stage", { size: "sm", act: "sp-start", data: { id: sg.id } }));
    if (["active"].includes(sg.state) && st.isPL(u, p)) out.push(C.btn("Record approval…", { size: "sm", act: "sp-approve", data: { id: sg.id }, title: "P1: the PL can mark client approval manually" }));
    if (sg.state === "invoiced" && st.isPL(u, p)) out.push(C.btn("Close", { size: "sm", act: "sp-close", data: { id: sg.id } }));
    return html`<span class="flex gap-1 jend">${out}</span>`;
  }
  const stageAudit = (sg, before, after, text) => st.audit("stage", sg.id, "edit", before, after, { projectId: sg.projectId, text });
  ui.on("sp-field", (el) => {
    const sg = st.stage(el.dataset.id); const k = el.dataset.k; let v = el.value; const u = DO.auth.current();
    if (k === "pct") { v = +String(v).replace(",", "."); if (!isFinite(v) || v < 0 || v > 100) { ui.toast({ title: "Fee % must be between 0 and 100", tone: "bad" }); DO.app.render(); return; } }
    if (k === "plannedEnd" && v < sg.plannedStart) ui.toast({ title: "Planned end is before planned start", description: "Fix the dates before saving the plan as final.", tone: "bad" });
    const before = sg[k]; sg[k] = v; st.stagesOf(sg.projectId).forEach((x) => { x.final = false; });
    stageAudit(sg, { [k]: before }, { [k]: v }, `${u.name} changed stage ${sg.seq} ${st.FIELD_LABEL[k] || k} from ${before} to ${v}`); st.commit();
  });
  ui.on("sp-purpose", (el) => { const sg = st.stage(el.dataset.id); const c = el.dataset.code; sg.requiredPurposes = el.checked ? [...new Set([...sg.requiredPurposes, c])] : sg.requiredPurposes.filter((x) => x !== c); stageAudit(sg, null, { requiredPurposes: sg.requiredPurposes }, `${DO.auth.current().name} set required purposes for stage ${sg.seq} to ${sg.requiredPurposes.join(", ")}`); st.commit(); });
  ui.on("sp-qc", (el) => { const sg = st.stage(el.dataset.id); sg.seniorQC = el.checked; stageAudit(sg, null, { seniorQC: sg.seniorQC }, `${DO.auth.current().name} ${sg.seniorQC ? "required" : "removed"} senior QC on stage ${sg.seq}`); st.commit(); });
  ui.on("sp-final", (el) => { const list = st.stagesOf(el.dataset.p); if (list.some((x) => x.plannedEnd < x.plannedStart)) { ui.toast({ title: "A stage ends before it starts", tone: "bad" }); return; } list.forEach((x) => { x.final = true; }); st.audit("project", el.dataset.p, "stage_plan_final", null, { total: 100 }, { projectId: el.dataset.p, text: `${DO.auth.current().name} saved the stage plan as final (100%)` }); st.commit(); ui.toast({ title: "Stage plan saved as final", tone: "ok" }); });
  ui.on("sp-add", (el) => { const list = st.stagesOf(el.dataset.p); const last = list[list.length - 1]; st.S.stages.push({ id: st.nextId("st"), projectId: el.dataset.p, seq: list.length + 1, name: "New stage", pct: 0, plannedStart: DO.addDays(last?.plannedEnd || DO.today(), 1), plannedEnd: DO.addDays(last?.plannedEnd || DO.today(), 60), actualStart: null, actualEnd: null, state: "planned", requiredPurposes: ["FA"], seniorQC: false, final: false, readySince: null, invoicedAt: null, invoiceRef: null }); list.forEach((x) => { x.final = false; }); st.commit(); });
  ui.on("sp-template", async (el) => {
    const tpl = st.S.stageTemplates.find((t) => t.id === el.value); if (!tpl) return;
    const p = st.project(el.dataset.p); const list = st.stagesOf(p.id);
    if (list.some((x) => !["planned"].includes(x.state))) { ui.toast({ title: "Template can only replace a plan that has not started", description: "Edit the stages directly instead.", tone: "bad" }); DO.app.render(); return; }
    const ok = await ui.confirm({ title: `Apply “${tpl.name}”?`, body: `The ${list.length} planned stages are replaced by ${tpl.items.length} stages from the template. Dates are spread across the project period.`, confirm: "Apply template" });
    if (!ok) { DO.app.render(); return; }
    st.S.stages = st.S.stages.filter((x) => x.projectId !== p.id);
    const span = DO.diffDays(p.start, p.end); let cur = p.start;
    tpl.items.forEach((it, i) => { const pe = DO.addDays(cur, Math.round(span / tpl.items.length)); st.S.stages.push({ id: st.nextId("st"), projectId: p.id, seq: i + 1, name: it.name, pct: it.pct, plannedStart: cur, plannedEnd: pe, actualStart: null, actualEnd: null, state: "planned", requiredPurposes: ["FA"], seniorQC: false, final: false, readySince: null, invoicedAt: null, invoiceRef: null }); cur = DO.addDays(pe, 1); });
    st.sheetsOf(p.id).forEach((s) => { s.stageId = st.stagesOf(p.id)[0].id; });
    st.audit("project", p.id, "template", null, { template: tpl.name }, { projectId: p.id, text: `${DO.auth.current().name} applied the “${tpl.name}” template` }); st.commit();
    ui.toast({ title: "Template applied", description: "Check the fee % before saving as final.", tone: "ok" });
  });
  ui.on("sp-letter", async (el) => {
    const [file] = await C.pickFile({ accept: "application/pdf,.pdf" }); if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { ui.toast({ title: `${file.name} is not a PDF`, description: "Attach the appointment letter as a PDF.", tone: "bad" }); return; }
    const p = st.project(el.dataset.p); p.letter = { name: file.name, size: file.size, uploadedAt: new Date().toISOString(), by: DO.auth.current().id }; st.files.set(`letter:${p.id}`, file);
    st.audit("project", p.id, "letter", null, { file: file.name }, { projectId: p.id, text: `${DO.auth.current().name} attached the appointment letter ${file.name}` }); st.commit(); ui.toast({ title: "Appointment letter attached", tone: "ok" });
  });
  ui.on("sp-start", (el) => { const sg = st.stage(el.dataset.id); sg.state = "active"; sg.actualStart = DO.today(); stageAudit(sg, { state: "planned" }, { state: "active" }, `${DO.auth.current().name} started stage ${sg.seq} ${sg.name}`); st.commit(); });
  ui.on("sp-close", (el) => { const sg = st.stage(el.dataset.id); sg.state = "closed"; stageAudit(sg, { state: "invoiced" }, { state: "closed" }, `${DO.auth.current().name} closed stage ${sg.seq} ${sg.name}`); st.commit(); });
  ui.on("sp-approve", (el) => {
    const sg = st.stage(el.dataset.id); const p = st.project(sg.projectId);
    const clients = st.S.contacts.filter((c) => c.kind === "client" && c.org === p.client);
    ui.dialog({ title: `Record client approval · stage ${sg.seq} ${sg.name}`, subtitle: `${p.code} ${p.name}`, body: html`<form id="ap-f" data-submit="sp-approve-save" class="stack"><input type="hidden" name="id" value="${sg.id}">${C.field("Approved by", C.select({ id: "ap-by", name: "by", options: clients.map((c) => [c.id, `${c.name} (${c.org})`]), value: clients[0]?.id }), { for: "ap-by" })}${C.field("Date of approval", html`<input id="ap-d" type="date" name="date" class="input" value="${DO.today()}" max="${DO.today()}">`, { for: "ap-d" })}${C.field("Evidence (letter, email or minutes)", html`<input id="ap-e" type="file" name="file" class="input" style="padding:6px" accept=".pdf,.png,.jpg,.jpeg,.eml,.msg">`, { for: "ap-e", hint: sg.state === "active" ? "Phase 1 allows a manual approval without evidence; from Phase 2 evidence is required (F-26)." : "Required (F-26)." })}${C.field("Note", html`<textarea id="ap-n" name="note" class="textarea" rows="2" placeholder="e.g. Approved at the steering committee"></textarea>`, { for: "ap-n" })}<p class="alert info">${icon("receipt-indian-rupee", 16)}<span>If every deliverable of this stage is issued, the stage becomes <strong>Ready to invoice</strong> and Accounts is told (A-09): ${p.fee ? DO.fmtINR(st.stageFee(sg)) : `${sg.pct}% of the fee`}.</span></p></form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="ap-f">Record approval</button>` });
  });
  ui.on("sp-approve-save", (form, d) => {
    const sg = st.stage(d.id); const file = form.querySelector("input[type=file]").files[0];
    if (sg.state === "deliverables_issued" && !file) { ui.toast({ title: "Attach the evidence", description: "A letter, email or minutes showing the approval.", tone: "bad" }); return; }
    const u = DO.auth.current();
    st.S.approvals.push({ id: st.nextId("ap"), projectId: sg.projectId, stageId: sg.id, by: d.by, date: d.date, evidence: file?.name || "Recorded manually (no evidence)", note: d.note, recordedBy: u.id, at: new Date().toISOString() });
    if (file) st.files.set(`approval:${sg.id}`, file);
    const before = sg.state;
    if (sg.state === "active") { sg.state = "client_approved"; }
    else { sg.state = "client_approved"; }
    stageAudit(sg, { state: before }, { state: "client_approved" }, `${u.name} recorded client approval of stage ${sg.seq} ${sg.name} (${st.contact(d.by)?.name})`);
    st.billingRule(sg); ui.closeTop(); st.commit();
    ui.toast({ title: sg.state === "ready_to_invoice" ? `Stage ${sg.seq} is ready to invoice` : "Client approval recorded", description: sg.state === "ready_to_invoice" ? "Accounts, the owner and you were notified (A-09)." : "It becomes ready to invoice once every deliverable is issued.", tone: "ok" });
  });

  // ---------- Team & hours ----------
  S.team = (ctx, u) => {
    const p = ctx.project; const editable = st.isPL(u, p) || u.orgRole === "admin";
    const week = DO.mondayOf(DO.today());
    const members = p.members.slice().sort((a, b) => ["PL", "DC", "SR", "DL", "Designer", "Viewer"].indexOf(a.role) - ["PL", "DC", "SR", "DL", "Designer", "Viewer"].indexOf(b.role) || st.userName(a.userId).localeCompare(st.userName(b.userId)));
    const stages = st.stagesOf(p.id);
    const month = DO.addDays(week, -28); const weeks = [0, 1, 2, 3].map((i) => DO.addDays(month, i * 7));
    const hours = stages.map((sg) => ({ sg, planned: DO.sum(st.S.allocations.filter((a) => a.stageId === sg.id && weeks.includes(a.week)), (a) => a.hours), logged: DO.sum(st.S.timesheets.filter((t) => weeks.includes(t.week) && t.state !== "draft"), (t) => DO.sum(t.rows.filter((r) => r.stageId === sg.id), (r) => DO.sum(r.hours))) })).filter((x) => x.planned || x.logged);
    return html`<div class="grid g-side"><div class="stack">${C.card({ title: `Team · ${new Set(members.map((m) => m.userId)).size} people`, actions: editable ? C.btn("Add member", { size: "sm", variant: "primary", icon: "user-plus", act: "tm-add", data: { p: p.id } }) : "", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Person</th><th>Project role</th><th class="hide-sm">Discipline</th><th class="right hide-sm">This week here</th><th class="right">Load (all projects)</th>${editable ? html`<th></th>` : ""}</tr></thead><tbody>${members.map((m) => { const pu = st.user(m.userId); const here = DO.sum(st.S.allocations.filter((a) => a.userId === m.userId && a.projectId === p.id && a.week === week), (a) => a.hours); const pct = st.loadPct(pu, week); const fl = st.loadFlag(pct); const seeHours = st.canSeeHoursOf(u, pu); return html`<tr><td>${pu.name}<span class="small muted block">${pu.title}</span></td><td>${st.ROLE_LABEL[m.role]}</td><td class="hide-sm">${m.discipline ? st.disc(m.discipline)?.name : "—"}</td><td class="right tabular hide-sm">${seeHours ? `${here} h` : html`<span class="muted" data-tip="Hours are visible to the person, their discipline lead, the project lead and the owner." tabindex="0">—</span>`}</td><td class="right">${!seeHours || pct === null ? "—" : fl === "over" ? C.flag("over_allocated", `${pct}%`) : fl === "under" ? C.flag("under_allocated", `${pct}%`) : html`<span class="tabular">${pct}%</span>`}</td>${editable ? html`<td class="right">${m.role !== "PL" || p.members.filter((x) => x.role === "PL").length > 1 ? C.btn("", { size: "sm", variant: "ghost", icon: "trash", act: "tm-remove", aria: `Remove ${pu.name} as ${st.ROLE_LABEL[m.role]}`, data: { p: p.id, u: m.userId, r: m.role, d: m.discipline } }) : ""}</td>` : ""}</tr>`; })}</tbody></table></div>` })}</div>
      <div class="stack">${C.card({ title: "Hours, last 4 weeks", actions: C.linkBtn("Workload", `#/workload?project=${p.id}`, { size: "sm" }), body: hours.length ? html`<div class="t-wrap"><table class="t"><thead><tr><th>Stage</th><th class="right">Planned</th><th class="right">Logged</th></tr></thead><tbody>${hours.map((x) => html`<tr><td>${x.sg.seq} ${x.sg.name}</td><td class="right tabular">${x.planned} h</td><td class="right tabular">${Math.round(x.logged)} h</td></tr>`)}</tbody></table></div>` : C.empty("No hours in the last four weeks."), foot: "Project totals (PL view, docs/03 §9)." })}
      ${C.card({ title: "External recipients", body: html`<ul>${p.recipients.map((cid) => { const c = st.contact(cid); return c ? html`<li class="list-row"><span>${c.name}<span class="small muted block">${c.org}</span></span><span class="pill">${c.kind}</span></li>` : ""; })}</ul>`, foot: html`<a class="link" href="#/contacts">Manage contacts</a>` })}</div></div>`;
  };
  ui.on("tm-add", (el) => {
    const p = st.project(el.dataset.p);
    ui.dialog({ title: `Add to ${p.code} team`, body: html`<form id="tm-f" data-submit="tm-save" class="stack"><input type="hidden" name="p" value="${p.id}">${C.field("Person", C.select({ id: "tm-u", name: "u", options: st.S.users.filter((x) => x.active && x.orgRole !== "accounts").map((x) => [x.id, `${x.name} · ${x.title}`]) }), { for: "tm-u" })}${C.field("Project role", C.select({ id: "tm-r", name: "r", options: Object.entries(st.ROLE_LABEL).map(([k, v]) => [k, v]), value: "Designer" }), { for: "tm-r" })}${C.field("Discipline (for discipline leads and designers)", C.select({ id: "tm-d", name: "d", options: [["", "—"], ...st.S.disciplines.map((x) => [x.code, x.name])] }), { for: "tm-d" })}<p class="small muted">They get an in-app notification and an email (to the demo mailbox).</p></form>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" form="tm-f">Add to team</button>` });
  });
  ui.on("tm-save", (form, d) => { const p = st.project(d.p); if (p.members.some((m) => m.userId === d.u && m.role === d.r && (m.discipline || "") === (d.d || ""))) { ui.toast({ title: "Already on the team in this role", tone: "bad" }); return; } p.members.push({ userId: d.u, role: d.r, discipline: d.d || st.user(d.u).discipline || "" }); const u = DO.auth.current(); st.audit("project", p.id, "member_added", null, { user: d.u, role: d.r }, { projectId: p.id, text: `${u.name} added ${st.userName(d.u)} as ${st.ROLE_LABEL[d.r]}` }); st.notify([d.u], "team", `You were added to ${p.code} ${p.name}`, `${u.name} added you as ${st.ROLE_LABEL[d.r]}.`, `#/projects/${p.id}`); ui.closeTop(); st.commit(); ui.toast({ title: `${st.userName(d.u)} added`, tone: "ok" }); });
  ui.on("tm-remove", async (el) => { const p = st.project(el.dataset.p); const ok = await ui.confirm({ title: `Remove ${st.userName(el.dataset.u)} as ${st.ROLE_LABEL[el.dataset.r]}?`, body: "They keep their history; they lose access to this project if this was their only role. Sheets they own stay assigned until you reassign them.", confirm: "Remove from team", danger: true }); if (!ok) return; p.members = p.members.filter((m) => !(m.userId === el.dataset.u && m.role === el.dataset.r && (m.discipline || "") === (el.dataset.d || ""))); st.audit("project", p.id, "member_removed", { user: el.dataset.u, role: el.dataset.r }, null, { projectId: p.id, text: `${DO.auth.current().name} removed ${st.userName(el.dataset.u)} (${st.ROLE_LABEL[el.dataset.r]})` }); st.commit(); });

  // ---------- F-45 Activity feed ----------
  function activity(p) {
    const ev = [];
    st.sheetsOf(p.id).forEach((s) => st.transitionsOf(s.id).forEach((t) => ev.push({ at: t.at, by: t.userId, type: t.to === "issued" ? "issue" : "state", disc: s.discipline, icon: C.STATES[t.to]?.[1] || "activity", text: html`moved ${DO.sheetLink(s)} ${t.from === t.to ? "" : html`from ${st.label(t.from)} `}to ${C.chip(t.to)}${t.reason ? html` · <span class="muted">“${t.reason}”</span>` : ""}` })));
    st.S.transmittals.filter((t) => t.projectId === p.id).forEach((t) => ev.push({ at: t.sentAt, by: t.sentBy, type: "transmittal", icon: "send-horizontal", text: html`sent <a class="link" href="#/projects/${p.id}/transmittals/${t.id}">${C.mono(t.number)}</a> · ${t.items.length} sheets to ${t.recipients.length} recipients for ${st.purposeLabel(t.purpose)}` }));
    st.S.audit.filter((a) => a.projectId === p.id && ["stage", "project", "import"].includes(a.entity)).forEach((a) => ev.push({ at: a.at, by: a.actorId, type: a.entity === "import" ? "import" : "stage", icon: a.entity === "import" ? "file-spreadsheet" : "layers", text: html`${a.text.replace(/^\S+ \S+ /, "")}` }));
    st.S.stages.filter((x) => x.projectId === p.id && x.invoicedAt).forEach((x) => ev.push({ at: x.invoicedAt, by: "u_acc", type: "stage", icon: "receipt-indian-rupee", text: html`marked stage ${x.seq} ${x.name} invoiced ${x.invoiceRef ? html`(${C.mono(x.invoiceRef)})` : ""}` }));
    st.S.comments.filter((c) => c.projectId === p.id).forEach((c) => ev.push({ at: c.receivedAt, by: null, type: "comment", icon: "message-square-text", text: html`client comment <a class="link" href="#/projects/${p.id}/comments?c=${c.id}">${C.mono(c.number)}</a> received by ${c.source} from ${st.contact(c.fromId)?.name}` }));
    return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
  }
  S.activity = (ctx, u) => {
    const p = ctx.project; const q = ctx.query; let ev = activity(p);
    if (q.person) ev = ev.filter((e) => e.by === q.person); if (q.type) ev = ev.filter((e) => e.type === q.type); if (q.disc) ev = ev.filter((e) => e.disc === q.disc);
    const n = +(q.n || 40);
    const people = [...new Set(activity(p).map((e) => e.by).filter(Boolean))];
    return html`<div class="filterbar">${C.select({ options: [["", "Everyone"], ...people.map((id) => [id, st.userName(id)])], value: q.person, change: "act-filter", dataset: { k: "person" }, aria: "Person" })}${C.select({ options: [["", "All events"], ["state", "State changes"], ["issue", "Issues"], ["transmittal", "Transmittals"], ["stage", "Stage and project"], ["import", "Imports"], ["comment", "Client comments"]], value: q.type, change: "act-filter", dataset: { k: "type" }, aria: "Event type" })}${C.select({ options: [["", "All disciplines"], ...st.S.disciplines.map((d) => [d.code, d.name])], value: q.disc, change: "act-filter", dataset: { k: "disc" }, aria: "Discipline" })}<span class="small muted">${DO.fmtNum(ev.length)} events, newest first</span></div>
      ${C.card({ body: ev.length ? html`<ol class="tl">${ev.slice(0, n).map((e) => html`<li><span class="tli">${icon(e.icon, 14)}</span><span class="small muted">${DO.fmtDateTime(e.at)}</span> · ${e.by ? html`<span class="strong">${st.userName(e.by)}</span> ` : ""}${e.text}</li>`)}</ol>${ev.length > n ? html`<div class="card-foot"><span>Showing ${n} of ${DO.fmtNum(ev.length)}</span>${C.btn("Load more", { size: "sm", act: "act-more", data: { n: n + 40 } })}</div>` : ""}` : C.empty("No events match these filters.") })}`;
  };
  ui.on("act-filter", (el) => DO.app.setQuery({ [el.dataset.k]: el.value, n: "" }));
  ui.on("act-more", (el) => DO.app.setQuery({ n: el.dataset.n }));
})(window);

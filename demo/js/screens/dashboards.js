/* DrawingOps demo · dashboards: My work (S-02, D-04), Portfolio (S-03, D-01), Sheets list, Discipline
   (D-03), Reports (D-05 baseline, hours, utilisation, review cycle) and export jobs. Every number is
   computed from the store, so cards, tables and lists always agree. */
(function (root) {
  "use strict";
  const DO = root.DO; const { html, raw, icon, C } = DO; const st = DO.store; const ui = DO.ui;
  const S = DO.screens = DO.screens || {};
  const sheetLink = (s, showProject) => html`<a class="hover-u" href="#/projects/${s.projectId}/sheets/${s.id}"><span class="mono strong">${s.number}</span> ${s.title}</a>${showProject ? html`<span class="small muted block">${st.project(s.projectId).code} ${st.project(s.projectId).name}</span>` : ""}`;
  DO.sheetLink = sheetLink;
  const plannedCell = (s) => { const p = st.effPlanned(s); return p ? html`${DO.fmtDate(p)}${!s.planned ? html`<span class="small muted block">from package</span>` : ""}` : html`<span class="muted">No date</span>`; };
  DO.plannedCell = plannedCell;
  const thisWeek = () => DO.mondayOf(DO.today());

  /** The one next action for a row (S-02): one click for simple moves, a link for ones that need input. */
  function nextAction(u, s) {
    const acts = st.allowedActions(u, s).filter((a) => a.primary);
    const a = acts[0]; if (!a) return "";
    if (a.action === "issue") return a.blocked ? html`<span class="small muted">${a.blocked}</span>` : html`<a class="btn sm primary" href="#/projects/${s.projectId}/issue?sheets=${s.id}">Issue…</a>`;
    if (a.needsReason || a.action === "return" || (a.action === "submit" && st.checklistFor(s))) return html`<a class="link small" href="#/projects/${s.projectId}/sheets/${s.id}">${a.label}…</a>`;
    return C.btn(a.label, { size: "sm", variant: "primary", act: "quick-transition", data: { id: s.id, a: a.action } });
  }
  DO.nextAction = nextAction;
  ui.on("quick-transition", (el) => {
    const s = st.sheet(el.dataset.id); const a = st.ACTIONS[el.dataset.a];
    el.classList.add("busy"); el.disabled = true; el.insertAdjacentHTML("afterbegin", String(icon("loader-circle", 14, "spin")));
    setTimeout(() => { try { st.transition(s, el.dataset.a); ui.toast({ title: `${s.number}: ${a.label}`, description: `Now ${st.label(s.state).toLowerCase()}.`, tone: "ok" }); } catch (e) { ui.showError(e); DO.app.render(); } }, 350);
  });

  // ---------- S-02 My work ----------
  S.myWork = (ctx, u) => {
    const T = DO.today(); const caps = st.caps(u);
    const mine = st.S.sheets.filter((s) => s.ownerId === u.id && st.OPEN.has(s.state) && st.canSeeProject(u, st.project(s.projectId)) && st.project(s.projectId).state === "active").sort((a, b) => (st.effPlanned(a) || "9999") < (st.effPlanned(b) || "9999") ? -1 : 1);
    const due = mine.filter((s) => s.state !== "changes_requested");
    const returned = mine.filter((s) => s.state === "changes_requested").map((s) => ({ s, rv: st.reviewsOf(s.id).find((v) => v.state === "returned") }));
    const queue = st.reviewQueue(u); const oldest = queue.length ? st.workingDaysWaiting(queue[0].review.openedAt) : 0;
    const ts = st.timesheet(u.id, thisWeek()); const logged = ts ? st.tsTotal(ts) : 0; const cap = st.capacityOf(u, thisWeek()); const planned = st.allocated(u.id, thisWeek());
    const lastTs = st.timesheet(u.id, DO.addDays(thisWeek(), -7));
    const ledDisc = [...new Set(st.S.projects.flatMap((p) => p.members.filter((m) => m.userId === u.id && m.role === "DL").map((m) => m.discipline)))];
    const led = st.S.projects.filter((p) => st.isPL(u, p));
    const dcReady = st.S.projects.filter((p) => st.isDC(u, p)).map((p) => ({ p, list: st.sheetsOf(p.id).filter((s) => s.state === "approved_for_issue") })).filter((x) => x.list.length);
    const member = st.S.projects.some((p) => st.rolesOn(u, p).length);
    const showMine = due.length || returned.length || st.S.sheets.some((s) => s.ownerId === u.id);
    const risk = (s) => (caps.forecasts ? C.forecastChip(st.lateRisk(s)) : "");
    const leftCards = [];
    if (showMine || (!led.length && !dcReady.length && u.orgRole === "staff")) {
      leftCards.push(C.card({ title: `Due soon · ${due.length}`, body: due.length ? html`<div class="t-wrap"><table class="t"><caption class="sr-only">Your sheets by planned issue date</caption><tbody>${due.slice(0, 12).map((s) => html`<tr class="hover"><td>${sheetLink(s, true)}</td><td>${C.sheetStatus(s)} ${risk(s)}</td><td class="small nowrap">${plannedCell(s)}</td><td class="right">${nextAction(u, s)}</td></tr>`)}</tbody></table></div>${due.length > 12 ? html`<div class="card-foot"><span>${due.length - 12} more</span><a class="link" href="#/sheets?owner=${u.id}">See all my sheets</a></div>` : ""}` : C.empty(member ? "No sheets are assigned to you right now." : "You are not on any project yet. A project lead adds you to their team.") }));
      leftCards.push(C.card({ title: `Returned to you · ${returned.length}`, body: returned.length ? html`<ul>${returned.map(({ s, rv }) => html`<li class="list-row"><span class="min-w-0">${sheetLink(s, true)}</span><span class="small muted">${icon("undo-2", 12)} by ${st.shortName(rv?.reviewerId)} · ${DO.fmtRel(rv?.closedAt)}${rv?.comment ? html` · “${rv.comment}”` : ""}${rv?.redlines?.length ? html` · ${DO.plural(rv.redlines.length, "redline file")}` : ""}</span><span>${nextAction(u, s)}</span></li>`)}</ul>` : C.empty("Nothing has been returned with comments.") }));
    }
    if (led.length) {
      leftCards.push(C.card({ title: `Projects you lead · ${led.length}`, actions: C.linkBtn("Portfolio", "#/portfolio", { size: "sm" }), body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Project</th><th>Stage</th><th class="right">Issued / planned</th><th class="right">Late</th><th class="right">At risk</th></tr></thead><tbody>${led.map((p) => { const x = st.projectStats(p); const sg = st.activeStage(p.id); return html`<tr class="hover"><td><a class="hover-u" href="#/projects/${p.id}">${C.mono(p.code)} ${p.name}</a></td><td>${sg ? html`${sg.seq} ${sg.name} ${C.stageChip(sg.state)}` : "—"}</td><td class="right tabular">${x.issued} / ${x.planned}</td><td class="right">${x.late ? html`<a class="link" href="#/projects/${p.id}/register?flag=late">${x.late}</a>` : 0}</td><td class="right">${x.atRisk ? html`<a class="link" href="#/projects/${p.id}/register?flag=at_risk">${x.atRisk}</a>` : 0}</td></tr>`; })}</tbody></table></div>` }));
    }
    if (dcReady.length) {
      leftCards.push(C.card({ title: "Approved and ready to issue", body: html`<ul>${dcReady.map(({ p, list }) => html`<li class="list-row"><span><span class="mono">${p.code}</span> ${p.name}<span class="small muted block">${list.slice(0, 8).map((s) => s.number).join(", ")}${list.length > 8 ? "…" : ""}</span></span><a class="btn sm primary" href="#/projects/${p.id}/issue">Issue ${DO.plural(list.length, "sheet")}…</a></li>`)}</ul>` }));
    }
    if (u.orgRole === "accounts" || u.orgRole === "owner") {
      const ready = st.S.stages.filter((x) => x.state === "ready_to_invoice");
      leftCards.push(C.card({ title: `Ready to invoice · ${ready.length}`, actions: C.linkBtn("Billing signals", "#/billing", { size: "sm" }), body: ready.length ? html`<ul>${ready.map((x) => { const p = st.project(x.projectId); return html`<li class="list-row"><span>${C.mono(p.code)} ${p.name} · ${x.seq} ${x.name}<span class="small muted block">${x.pct}% · ${DO.fmtINR(st.stageFee(x))}</span></span>${C.flag("ready_to_invoice", `Ready to invoice · ${DO.plural(st.workingDaysWaiting(x.readySince), "day")}`)}</li>`; })}</ul>` : C.empty("No stage is waiting to be invoiced.") }));
    }
    if (u.orgRole === "admin") {
      leftCards.push(C.card({ title: "Set up your firm", body: html`<ul class="card-body stack-2">${[["#/admin/disciplines", "Disciplines and sheet-number prefixes"], ["#/admin/calendar", "Working week and holidays"], ["#/admin/naming-rules", "Naming rules with a live tester"], ["#/admin/onboarding", "Load a live project (onboarding)"], ["#/admin/users", "Users, roles and invitations"], ["#/admin/integrations", "SSO, email, CAD plugins and tokens"], ["#/admin/audit", "Audit trail and export"]].map(([h, l]) => html`<li><a class="link" href="${h}">${l}</a></li>`)}</ul>` }));
    }
    const right = [];
    if (caps.timesheet) right.push(C.card({ title: "Hours this week", body: html`<div class="card-body stack-2"><p class="title tabular">${logged} / ${cap} h</p><div class="bar lg" role="progressbar" aria-label="Hours logged this week" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${logged}"><span style="width:${DO.clamp((logged / (cap || 1)) * 100, 0, 100)}%"></span></div><p class="small muted">Planned ${planned} h · last week: ${lastTs ? { draft: "Not submitted", submitted: "Submitted", approved: "Approved", returned: "Returned for correction" }[lastTs.state] : "Not submitted"}</p>${!lastTs || lastTs.state === "draft" ? C.flag("timesheet_missing", "Hours missing", "A-06: last week's timesheet was due Tuesday 12:00.") : lastTs.state === "returned" ? html`<p class="alert warn">${icon("undo-2", 14)}<span>${lastTs.reason}</span></p>` : ""}<a class="link small" href="#/timesheets">Open timesheet</a></div>` }));
    if (queue.length || caps.dls || st.S.projects.some((p) => st.isSR(u, p))) right.push(C.card({ title: "Waiting for your check", body: html`<div class="card-body stack-2"><p>${queue.length ? `${DO.plural(queue.length, "sheet")} · oldest ${oldest} d` : "Nothing waiting."}</p>${queue.length ? html`<ul class="small">${queue.slice(0, 4).map((x) => html`<li class="mt-1"><a class="hover-u" href="#/reviews?open=${x.review.id}">${C.mono(x.sheet.number)} ${x.sheet.title}</a> <span class="muted">· ${x.review.kind === "senior_qc" ? "senior QC" : "check"} · ${st.workingDaysWaiting(x.review.openedAt)} d</span></li>`)}</ul><a class="link small" href="#/reviews">Open reviews</a>` : ""}</div>` }));
    if (ledDisc.length) right.push(C.card({ title: "Your disciplines", body: html`<ul class="card-body stack-2">${ledDisc.map((d) => html`<li><a class="link" href="#/disciplines/${d}">${d} · ${st.disc(d)?.name}</a></li>`)}</ul>` }));
    const unread = st.S.notifications.filter((n) => n.userId === u.id && !n.read).slice(0, 4);
    if (unread.length) right.push(C.card({ title: "Latest for you", body: html`<ul>${unread.map((n) => html`<li class="list-row"><a class="hover-u" href="${n.link || "#/"}" data-act="open-notif" data-id="${n.id}" data-prevent>${n.title}</a><span class="small muted">${DO.fmtRel(n.at)}</span></li>`)}</ul>` }));
    return html`${C.pageHead({ title: "My work", meta: html`<span>Welcome, ${u.name.split(" ")[0]}</span><span>Week ${DO.isoWeek(T)} · ${DO.fmtDate(T)}</span><span>${u.title}</span>` })}
      <div class="grid g-side"><div class="stack">${leftCards.length ? leftCards : C.card({ body: C.empty("You are not on any project yet. A project lead adds you to their team; until then you can browse Knowledge and Contacts.") })}</div><div class="stack">${right}</div></div>`;
  };

  // ---------- S-03 Portfolio (D-01) ----------
  function portfolioData(u, filters = {}) {
    const T = DO.today(); const lastWeek = DO.addDays(T, -7);
    const projects = st.visibleProjects(u).filter((p) => p.state === "active" && (!filters.lead || p.leadId === filters.lead) && (!filters.type || p.type === filters.type));
    const sheets = projects.flatMap((p) => st.sheetsOf(p.id));
    const late = sheets.filter(st.isLate).length; const atRisk = sheets.filter(st.isAtRisk).length;
    const lateLW = sheets.filter((s) => st.flagsAsOf(s, lastWeek).late).length; const riskLW = sheets.filter((s) => st.flagsAsOf(s, lastWeek).at_risk).length;
    const open = st.S.reviews.filter((v) => v.state === "open" && projects.some((p) => p.id === st.sheet(v.sheetId)?.projectId)).sort(DO.by("openedAt"));
    const week = thisWeek(); const people = st.S.users.filter((x) => x.active && st.allocated(x.id, week) > 0);
    const over = people.filter((x) => st.loadFlag(st.loadPct(x, week)) === "over");
    const ready = st.S.stages.filter((x) => x.state === "ready_to_invoice" && projects.some((p) => p.id === x.projectId));
    return { projects, sheets, late, atRisk, lateDelta: late - lateLW, riskDelta: atRisk - riskLW, oldestReview: open.length ? st.workingDaysWaiting(open[0].openedAt) : null, oldestReviewSheet: open[0] ? st.sheet(open[0].sheetId) : null, over, ready, readyAmount: DO.sum(ready, st.stageFee), readyOldest: ready.length ? Math.max(...ready.map((x) => st.workingDaysWaiting(x.readySince))) : null };
  }
  DO.portfolioData = portfolioData;
  S.portfolio = (ctx, u) => {
    const q = ctx.query; const d = portfolioData(u, q); const caps = st.caps(u);
    const sort = { key: q.sort || "late", dir: q.dir === "1" ? 1 : -1 };
    const rows = d.projects.map((p) => { const x = st.projectStats(p); const sg = st.activeStage(p.id); const next = st.stagesOf(p.id).find((y) => y.seq > (sg?.seq || 0)); const risky = caps.forecasts ? st.sheetsOf(p.id).map(st.lateRisk).filter((r) => r && r.prob >= 60).length : 0; return { p, ...x, sg, next, risky, pct: x.planned ? Math.round((x.issued / x.planned) * 100) : 0 }; });
    const val = (r) => ({ late: r.late, risk: r.atRisk, code: r.p.code, issued: r.pct, next: r.next?.plannedStart || "9999", lead: st.userName(r.p.leadId) })[sort.key];
    rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    const weeks = [0, 1, 2, 3].map((i) => DO.addDays(thisWeek(), i * 7));
    const discLoad = st.S.disciplines.map((dd) => { const people = st.S.users.filter((x) => x.discipline === dd.code && x.active); const cells = weeks.map((w) => { const cap = DO.sum(people, (x) => st.capacityOf(x, w)); const al = DO.sum(people, (x) => st.allocated(x.id, w)); return cap ? Math.round((al / cap) * 100) : null; }); return { dd, cells }; }).filter((x) => x.cells.some((c) => c !== null));
    const topRisk = caps.forecasts ? d.sheets.map((s) => ({ s, r: st.lateRisk(s) })).filter((x) => x.r).sort((a, b) => b.r.prob - a.r.prob).slice(0, 6) : [];
    const leads = [...new Set(st.visibleProjects(u).map((p) => p.leadId))];
    return html`${C.pageHead({ title: "Portfolio", meta: html`<span>Active projects ${d.projects.length}</span><span>Updated ${DO.fmtTime(new Date())} (data no older than 15 minutes)</span>`, actions: html`${C.select({ options: [["", "All leads"], ...leads.map((id) => [id, st.userName(id)])], value: q.lead, change: "pf-filter", dataset: { k: "lead" }, aria: "Filter by project lead", cls: "sm" })}${C.select({ options: [["", "All types"], ["hospital", "Hospital"], ["residential", "Residential"], ["commercial", "Commercial"], ["other", "Other"]], value: q.type, change: "pf-filter", dataset: { k: "type" }, aria: "Filter by project type", cls: "sm" })}${C.btn("Export", { icon: "download", act: "export-late" })}` })}
      <div class="stack">
        <div class="metrics">
          ${C.metric({ label: "Late sheets", icon: "alarm-clock-off", value: d.late, delta: d.lateDelta, href: `#/sheets?flag=late${q.lead ? `&lead=${q.lead}` : ""}` })}
          ${C.metric({ label: "At risk", icon: "clock-alert", value: d.atRisk, delta: d.riskDelta, href: `#/sheets?flag=at_risk${q.lead ? `&lead=${q.lead}` : ""}` })}
          ${C.metric({ label: "Oldest review", icon: "search-check", value: d.oldestReview === null ? "—" : DO.plural(d.oldestReview, "day"), href: "#/sheets?state=ready_for_check&state=in_check", hint: d.oldestReviewSheet ? `working days · ${d.oldestReviewSheet.number}` : "working days waiting" })}
          ${C.metric({ label: "Over-allocated", icon: "trending-up", value: DO.plural(d.over.length, "person", "people"), href: "#/workload?flag=over", hint: "this week, above 110%" })}
          ${C.metric({ label: "Ready to invoice", icon: "receipt-indian-rupee", value: DO.plural(d.ready.length, "stage"), href: "#/billing", hint: [d.readyAmount ? DO.fmtINR(d.readyAmount) : "", d.readyOldest !== null ? `oldest ${d.readyOldest} days` : ""].filter(Boolean).join(" · ") })}
        </div>
        ${C.card({ title: "Projects", body: rows.length ? html`<div class="t-wrap" role="region" aria-label="Projects" tabindex="0"><table class="t"><thead><tr>${C.sortTh("Project", "code", sort, "pf-sort")}<th>Stage</th>${C.sortTh("Sheets issued / planned", "issued", sort, "pf-sort")}${C.sortTh("Late", "late", sort, "pf-sort", "right")}${C.sortTh("At risk", "risk", sort, "pf-sort", "right")}${caps.forecasts ? html`<th class="right hide-md"><span class="pill forecast">${icon("sparkles", 12)}Forecast</span></th>` : ""}${C.sortTh("Lead", "lead", sort, "pf-sort", "hide-sm")}${C.sortTh("Next stage date", "next", sort, "pf-sort", "hide-sm")}</tr></thead><tbody>${rows.map((r) => html`<tr class="hover"><td><a class="hover-u" href="#/projects/${r.p.id}">${C.mono(r.p.code)} ${r.p.name}</a><span class="small muted block">${r.p.client}</span></td><td>${r.sg ? html`<span class="iflex items-center gap-2 nowrap">${r.sg.seq} ${r.sg.name} ${C.stageChip(r.sg.state)}</span>` : "—"}</td><td><a class="iflex items-center gap-2 hover-u" href="#/projects/${r.p.id}/register"><span class="tabular">${r.issued} / ${r.planned}</span><span class="sr-only">sheets issued (${r.pct}%)</span>${C.bar(r.pct)}</a></td><td class="right tabular">${r.late ? html`<a class="link" href="#/projects/${r.p.id}/register?flag=late">${r.late}</a>` : 0}</td><td class="right tabular">${r.atRisk ? html`<a class="link" href="#/projects/${r.p.id}/register?flag=at_risk">${r.atRisk}</a>` : 0}</td>${caps.forecasts ? html`<td class="right hide-md small">${r.risky ? html`<span data-tip="Open sheets with a forecast late risk of 60% or more (advisory)." tabindex="0">${r.risky} likely late</span>` : html`<span class="muted">—</span>`}</td>` : ""}<td class="hide-sm">${st.shortName(r.p.leadId)}</td><td class="tabular hide-sm">${r.next ? DO.fmtDate(r.next.plannedStart) : "—"}</td></tr>`)}</tbody></table></div>` : C.empty("No active projects match these filters.") })}
        <div class="grid g-2">
          ${C.card({ title: "Discipline workload, next 4 weeks", body: html`<div class="t-wrap" role="region" aria-label="Discipline workload" tabindex="0"><table class="t"><thead><tr><th>Discipline</th>${weeks.map((w) => html`<th class="right">W${DO.isoWeek(w)}</th>`)}</tr></thead><tbody>${discLoad.map(({ dd, cells }) => html`<tr><th scope="row" style="font-weight:400;background:none;position:static"><a class="hover-u" href="#/disciplines/${dd.code}">${dd.code} · ${dd.name}</a></th>${cells.map((c) => { const fl = st.loadFlag(c); return html`<td class="right"><a class="heat ${c === null ? "none" : fl}" href="#/workload?disc=${dd.code}">${fl === "over" ? icon("trending-up", 12) : fl === "under" ? icon("trending-down", 12) : ""}${c === null ? "—" : `${c}%`}${fl === "over" ? html`<span class="sr-only"> over-allocated</span>` : fl === "under" ? html`<span class="sr-only"> under-allocated</span>` : ""}</a></td>`; })}</tr>`)}</tbody></table></div>` })}
          ${caps.forecasts ? C.card({ title: "Forecast: sheets most likely to go late", actions: html`<span class="pill forecast">${icon("sparkles", 12)}Advisory</span>`, body: topRisk.length ? html`<ul>${topRisk.map(({ s, r }) => html`<li class="list-row"><span class="min-w-0">${sheetLink(s, true)}<span class="small muted block">${r.reasons.join(" · ")}</span></span><span class="pill forecast">${r.prob}%</span></li>`)}</ul>` : C.empty("No open sheets to forecast."), foot: html`<span>Gradient-boosted model, back-tested against A-01 alone (precision ${Math.round(st.S.org.intelligence.precisionMeasured * 100)}% vs target ${Math.round(st.S.org.intelligence.precisionTarget * 100)}%). Never changes data.</span>` }) : ""}
        </div>
      </div>`;
  };
  ui.on("pf-filter", (el) => DO.app.setQuery({ [el.dataset.k]: el.value }));
  ui.on("pf-sort", (el) => { const q = DO.app.parseHash().query; DO.app.setQuery({ sort: el.dataset.key, dir: q.sort === el.dataset.key && q.dir !== "1" ? "1" : "" }); });
  ui.on("export-late", (el) => { const u = DO.auth.current(); C.exportMenu(el, () => { const d = portfolioData(u, DO.app.parseHash().query); const rows = d.sheets.filter((s) => st.isLate(s) || st.isAtRisk(s)).map((s) => { const fl = st.flagsFor(s)[0]; return [st.project(s.projectId).code, s.number, s.title, st.disc(s.discipline)?.name, st.userName(s.ownerId), st.label(s.state), DO.fmtDate(st.effPlanned(s)), fl.kind === "late" ? "Late" : "At risk", fl.text]; }); return { name: "late-at-risk", title: "Late and at-risk sheets", subtitle: `All active projects you can see · ${DO.fmtDate(DO.today())}`, columns: [{ label: "Project", mono: true }, { label: "Sheet", mono: true }, { label: "Title", w: 3 }, { label: "Discipline", w: 1.4 }, { label: "Owner", w: 1.4 }, { label: "State", w: 1.3 }, { label: "Planned" }, { label: "Flag" }, { label: "Detail" }], rows }; }); });

  // ---------- Sheets list (the list behind every portfolio number) ----------
  S.sheetsList = (ctx, u) => {
    const q = ctx.query; const states = [].concat(q.state || []);
    let list = st.S.sheets.filter((s) => st.canSeeProject(u, st.project(s.projectId)) && st.project(s.projectId).state === "active");
    if (q.flag === "late") list = list.filter(st.isLate); if (q.flag === "at_risk") list = list.filter(st.isAtRisk);
    if (states.length) list = list.filter((s) => states.includes(s.state));
    if (q.owner) list = list.filter((s) => s.ownerId === q.owner);
    if (q.lead) list = list.filter((s) => st.project(s.projectId).leadId === q.lead);
    if (q.disc) list = list.filter((s) => s.discipline === q.disc);
    if (q.q) { const t = q.q.toLowerCase(); list = list.filter((s) => `${s.number} ${s.title}`.toLowerCase().includes(t)); }
    list.sort((a, b) => ((st.effPlanned(a) || "9") > (st.effPlanned(b) || "9") ? 1 : -1));
    const title = q.flag === "late" ? "Late sheets" : q.flag === "at_risk" ? "At-risk sheets" : states.length ? `Sheets ${states.map(st.label).join(" or ").toLowerCase()}` : q.owner ? `Sheets owned by ${st.userName(q.owner)}` : "Sheets";
    const page = +(q.p || 1); const size = +(ui.state.sheetsSize || 50);
    ui.state.sheetsExport = list;
    return html`${C.pageHead({ title, crumbs: [{ label: "Portfolio", href: "#/portfolio" }, { label: title }], meta: html`${DO.plural(list.length, "sheet")} across ${new Set(list.map((s) => s.projectId)).size} projects you can see`, actions: html`${C.btn("Export", { icon: "download", act: "export-sheets" })}` })}
      <div class="filterbar"><div class="search-box">${icon("search", 14)}<input id="sl-q" class="input" placeholder="Filter by number or title" value="${q.q || ""}" data-input="sl-q" data-debounce="200" aria-label="Filter sheets"></div>${C.select({ options: [["", "Any flag"], ["late", "Late"], ["at_risk", "At risk"]], value: q.flag, change: "sl-filter", dataset: { k: "flag" }, aria: "Flag" })}${C.select({ options: [["", "All disciplines"], ...st.S.disciplines.map((d) => [d.code, d.name])], value: q.disc, change: "sl-filter", dataset: { k: "disc" }, aria: "Discipline" })}${q.state || q.owner || q.lead ? html`<a class="btn sm ghost" href="#/sheets${q.flag ? `?flag=${q.flag}` : ""}">${icon("x", 14)}Clear other filters</a>` : ""}</div>
      ${C.card({ body: list.length ? html`<div class="t-wrap"><table class="t"><thead><tr><th>Sheet</th><th class="hide-sm">Project</th><th class="hide-md">Owner</th><th>State and flags</th><th>Planned</th></tr></thead><tbody>${list.slice((page - 1) * size, page * size).map((s) => html`<tr class="clickable" data-href="#/projects/${s.projectId}/sheets/${s.id}" tabindex="0"><td>${sheetLink(s)}</td><td class="hide-sm">${C.mono(st.project(s.projectId).code)} <span class="small muted">${st.project(s.projectId).name}</span></td><td class="hide-md">${st.shortName(s.ownerId)}</td><td>${C.sheetStatus(s)}</td><td class="small nowrap">${plannedCell(s)}</td></tr>`)}</tbody></table></div>${C.pager(list.length, page, size, "sl-page")}` : C.empty("No sheets match these filters. Good news if you were looking for late ones.") })}`;
  };
  ui.on("sl-q", (el) => DO.app.setQuery({ q: el.value, p: "" }));
  ui.on("sl-filter", (el) => DO.app.setQuery({ [el.dataset.k]: el.value, p: "" }));
  ui.on("sl-page", (el) => DO.app.setQuery({ p: el.dataset.p }));
  ui.on("sl-page-size", (el) => { ui.state.sheetsSize = +el.value; DO.app.setQuery({ p: "" }); });
  const registerExportSpec = (list, title) => ({ name: "sheets", title, subtitle: `${list.length} sheets · ${DO.fmtDate(DO.today())}`, columns: [{ label: "Project", mono: true }, { label: "Sheet", mono: true }, { label: "Title", w: 3 }, { label: "Discipline", w: 1.3 }, { label: "Stage", w: 1.3 }, { label: "Owner", w: 1.2 }, { label: "Checker", w: 1.2 }, { label: "State", w: 1.3 }, { label: "Planned" }, { label: "Rev", mono: true }, { label: "Flags", w: 1.2 }], rows: list.map((s) => [st.project(s.projectId).code, s.number, s.title, st.disc(s.discipline)?.name, `${st.stage(s.stageId)?.seq} ${st.stage(s.stageId)?.name}`, st.userName(s.ownerId), st.userName(s.checkerId), st.label(s.state), DO.fmtDate(st.effPlanned(s)), st.currentRev(s)?.code || st.draftOf(s)?.code || "", st.flagsFor(s).map((f) => f.text).join("; ")]) });
  DO.registerExportSpec = registerExportSpec;
  ui.on("export-sheets", (el) => C.exportMenu(el, () => registerExportSpec(ui.state.sheetsExport || [], "Sheets")));

  // ---------- D-03 Discipline dashboard ----------
  S.discipline = (ctx, u) => {
    const d = st.disc(ctx.params.code); if (!d) return C.empty("Unknown discipline.");
    const projects = st.visibleProjects(u).filter((p) => p.state === "active");
    const sheets = projects.flatMap((p) => st.sheetsOf(p.id)).filter((s) => s.discipline === d.code);
    const people = st.S.users.filter((x) => x.discipline === d.code && x.active && x.orgRole === "staff");
    const queue = st.S.reviews.filter((v) => v.state === "open" && sheets.some((s) => s.id === v.sheetId)).sort(DO.by("openedAt"));
    const weeks = [thisWeek(), DO.addDays(thisWeek(), 7)];
    const byOwner = people.map((pp) => { const mine = sheets.filter((s) => s.ownerId === pp.id); const counts = {}; mine.forEach((s) => { counts[s.state] = (counts[s.state] || 0) + 1; }); return { pp, mine, counts, late: mine.filter(st.isLate).length, risk: mine.filter(st.isAtRisk).length }; });
    const fc = st.caps(u).forecasts ? st.workloadForecast(d.code, Array.from({ length: 8 }, (_, i) => DO.addDays(thisWeek(), i * 7))) : null;
    const flagged = sheets.filter((s) => st.isLate(s) || st.isAtRisk(s)).sort((a, b) => (st.effPlanned(a) > st.effPlanned(b) ? 1 : -1));
    return html`${C.pageHead({ title: `${d.code} · ${d.name}`, crumbs: [{ label: "My work", href: "#/" }, { label: "Discipline dashboard" }], meta: html`<span>Lead ${st.userName(st.S.projects.flatMap((p) => p.members).find((m) => m.role === "DL" && m.discipline === d.code)?.userId)}</span><span>${DO.plural(people.length, "person", "people")}</span><span>${sheets.length} sheets on ${new Set(sheets.map((s) => s.projectId)).size} projects</span>`, actions: html`${C.linkBtn("Workload", `#/workload?disc=${d.code}`, { icon: "layout-grid" })}${C.linkBtn("All sheets", `#/sheets?disc=${d.code}`, { icon: "list" })}` })}
      <div class="stack">
        <div class="metrics">${C.metric({ label: "Late", icon: "alarm-clock-off", value: sheets.filter(st.isLate).length, href: `#/sheets?flag=late&disc=${d.code}` })}${C.metric({ label: "At risk", icon: "clock-alert", value: sheets.filter(st.isAtRisk).length, href: `#/sheets?flag=at_risk&disc=${d.code}` })}${C.metric({ label: "Check queue", icon: "search-check", value: queue.length, hint: queue.length ? `oldest ${st.workingDaysWaiting(queue[0].openedAt)} working days` : "", href: "#/reviews" })}${C.metric({ label: "Approved, not issued", icon: "badge-check", value: sheets.filter((s) => s.state === "approved_for_issue").length, href: `#/sheets?state=approved_for_issue&disc=${d.code}` })}</div>
        <div class="grid g-2">
          ${C.card({ title: "Assignments", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Person</th><th class="right">Open</th><th class="right">In check</th><th class="right">Late</th><th class="right">At risk</th></tr></thead><tbody>${byOwner.map((r) => html`<tr class="hover"><td><a class="hover-u" href="#/sheets?owner=${r.pp.id}">${r.pp.name}</a></td><td class="right tabular">${r.mine.filter((s) => st.OPEN.has(s.state)).length}</td><td class="right tabular">${(r.counts.ready_for_check || 0) + (r.counts.in_check || 0)}</td><td class="right tabular">${r.late || 0}</td><td class="right tabular">${r.risk || 0}</td></tr>`)}</tbody></table></div>` })}
          ${C.card({ title: "Capacity this week and next", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Person</th>${weeks.map((w) => html`<th class="right">W${DO.isoWeek(w)}</th>`)}</tr></thead><tbody>${people.map((pp) => html`<tr><td>${pp.name}</td>${weeks.map((w) => { const pct = st.loadPct(pp, w); const fl = st.loadFlag(pct); return html`<td class="right"><a class="heat ${pct === null ? "none" : fl}" href="#/workload?disc=${d.code}&cell=${pp.id}:${w}">${fl === "over" ? icon("trending-up", 12) : fl === "under" ? icon("trending-down", 12) : ""}${pct === null ? "—" : `${pct}%`}</a></td>`; })}</tr>`)}</tbody></table></div>` })}
        </div>
        <div class="grid g-2">
          ${C.card({ title: `Check queue · ${queue.length}`, body: queue.length ? html`<ul>${queue.slice(0, 10).map((v) => { const s = st.sheet(v.sheetId); return html`<li class="list-row"><span>${sheetLink(s, true)}</span><span class="small muted">${v.kind === "senior_qc" ? "Senior QC" : "Check"} · ${st.shortName(v.reviewerId)} · ${st.workingDaysWaiting(v.openedAt)} working days</span></li>`; })}</ul>` : C.empty("No sheets waiting for a check.") })}
          ${C.card({ title: `Late and at risk · ${flagged.length}`, body: flagged.length ? html`<ul>${flagged.slice(0, 10).map((s) => html`<li class="list-row"><span>${sheetLink(s, true)}</span>${C.sheetStatus(s)}</li>`)}</ul>` : C.empty("Nothing late or at risk.") })}
        </div>
        ${fc ? C.card({ title: "Workload forecast, next 8 weeks", actions: html`<span class="pill forecast">${icon("sparkles", 12)}Forecast · MAPE ${st.mape(d.code)}%</span>`, body: C.chartBox(`fc-${d.code}`, C.lineChart({ id: `fc-${d.code}`, yLabel: "Hours per week", series: [{ label: "Capacity", color: "var(--text-muted)", dash: true, points: fc.map((x) => [x.week, x.capacity]) }, { label: "Planned allocations", color: "var(--chart-1)", points: fc.map((x) => [x.week, x.planned]) }, { label: "Forecast", color: "var(--chart-4)", dash: true, points: fc.map((x) => [x.week, x.forecast]) }] }), html`<table class="t"><thead><tr><th>Week</th><th class="right">Capacity h</th><th class="right">Planned h</th><th class="right">Forecast h</th></tr></thead><tbody>${fc.map((x) => html`<tr><td>W${DO.isoWeek(x.week)} · ${DO.fmtDate(x.week)}</td><td class="right">${x.capacity}</td><td class="right">${x.planned}</td><td class="right">${x.forecast}</td></tr>`)}</tbody></table>`, html`<span class="legend"><span><i style="border-color:var(--text-muted)" class="dash"></i>Capacity</span><span><i style="border-color:var(--chart-1)"></i>Planned</span><span><i style="border-color:var(--chart-4)" class="dash"></i>Forecast (advisory, never replaces allocations)</span></span>`) }) : ""}
      </div>`;
  };

  // ---------- Reports (D-05 baseline metrics, hours, utilisation, review cycle) ----------
  function baseline(from, to, projectsVisible) {
    const pids = new Set(projectsVisible.map((p) => p.id));
    const revs = st.S.revisions.filter((v) => v.issuedAt && DO.dateOf(v.issuedAt) >= from && DO.dateOf(v.issuedAt) <= to);
    const deliverable = revs.filter((v) => { const s = st.sheet(v.sheetId); if (!s || !pids.has(s.projectId)) return false; const sg = st.stage(v.stageId); return sg && sg.requiredPurposes.includes(v.purpose) && st.effPlanned(s); });
    const lateIssues = deliverable.filter((v) => DO.dateOf(v.issuedAt) > st.effPlanned(st.sheet(v.sheetId)));
    const checks = []; const bySheet = DO.groupBy(st.S.transitions.filter((t) => pids.has(st.sheet(t.sheetId)?.projectId)), (t) => t.sheetId);
    Object.values(bySheet).forEach((list) => { list.sort(DO.by("at")); let startAt = null; list.forEach((t) => { if (t.to === "ready_for_check") startAt = t.at; if (startAt && (t.to === "approved_for_issue" || t.to === "changes_requested")) { const end = DO.dateOf(t.at); if (end >= from && end <= to) checks.push({ days: DO.workingDaysBetween(DO.dateOf(startAt), end), sheetId: t.sheetId, by: t.userId, disc: st.sheet(t.sheetId).discipline }); startAt = null; } }); });
    const weeks = []; for (let w = DO.mondayOf(from); w <= to; w = DO.addDays(w, 7)) weeks.push(w);
    const hours = projectsVisible.map((p) => { const plannedH = DO.sum(st.S.allocations.filter((a) => a.projectId === p.id && weeks.includes(a.week)), (a) => a.hours); const loggedH = DO.sum(st.S.timesheets.filter((t) => weeks.includes(t.week) && t.state !== "draft"), (t) => DO.sum(t.rows.filter((r) => r.projectId === p.id), (r) => DO.sum(r.hours))); return { p, plannedH, loggedH }; }).filter((x) => x.plannedH || x.loggedH);
    const inv = st.S.stages.filter((x) => pids.has(x.projectId) && x.invoicedAt && x.actualEnd && DO.dateOf(x.invoicedAt) >= from && DO.dateOf(x.invoicedAt) <= to).map((x) => ({ x, days: DO.diffDays(x.actualEnd, DO.dateOf(x.invoicedAt)) }));
    const waiting = st.S.stages.filter((x) => pids.has(x.projectId) && x.state === "ready_to_invoice");
    return { deliverable, lateIssues, pctLate: deliverable.length ? Math.round((lateIssues.length / deliverable.length) * 100) : null, checks, avgCheck: checks.length ? Math.round((DO.sum(checks, (c) => c.days) / checks.length) * 10) / 10 : null, hours, inv, avgInv: inv.length ? Math.round(DO.sum(inv, (i) => i.days) / inv.length) : null, waiting };
  }
  const DEFS = [
    ["% sheets issued after the planned date", "Deliverable issues (purpose required by the sheet's stage) in the range whose issue date is after the sheet's planned issue date (own or package), divided by all deliverable issues in the range."],
    ["Average working days in check", "For every check that ended in the range: working days from 'Submit for check' to 'Approve' or 'Return', using the firm's working calendar (F-42)."],
    ["Hours logged vs planned per project", "Submitted and approved timesheet hours in the range against planned allocations for the same ISO weeks."],
    ["Days from deliverables issued to invoice", "For stages invoiced in the range: calendar days from 'deliverables issued' to 'invoiced'. Stages still waiting are listed separately."],
  ];
  S.reports = (ctx, u) => {
    const q = ctx.query; const caps = st.caps(u); const tab = q.tab || (caps.baseline ? "baseline" : "hours");
    const T = DO.today(); const preset = q.range || "90";
    const from = q.from || DO.addDays(T, -(+preset || 90)); const to = q.to || T;
    const projects = st.visibleProjects(u).filter((p) => u.orgRole === "owner" || u.orgRole === "admin" || u.orgRole === "accounts" || st.isPL(u, p) || st.isDL(u, p));
    const tabsList = [caps.baseline && { key: "baseline", label: "Baseline metrics", href: "#/reports?tab=baseline" }, { key: "hours", label: "Hours by project and stage", href: "#/reports?tab=hours" }, u.orgRole !== "accounts" && { key: "util", label: "Utilisation", href: "#/reports?tab=util" }, { key: "review", label: "Review cycle", href: "#/reports?tab=review" }, u.orgRole !== "accounts" && { key: "missing", label: "Missing timesheets", href: "#/reports?tab=missing" }].filter(Boolean);
    const rangeBar = html`<div class="filterbar">${C.seg("Date range", [["30", "Last 30 days"], ["90", "Last quarter"], ["180", "Last 6 months"], ["custom", "Custom"]], q.from ? "custom" : preset, "rp-range")}<label class="flex items-center gap-2 small">From <input type="date" id="rp-from" class="input sm" style="width:150px" value="${from}" data-change="rp-date" data-k="from"></label><label class="flex items-center gap-2 small">To <input type="date" id="rp-to" class="input sm" style="width:150px" value="${to}" data-change="rp-date" data-k="to"></label></div>`;
    let body = "";
    if (tab === "baseline" && caps.baseline) {
      const b = baseline(from, to, projects);
      const months = []; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = DO.addDays(`${m}-28`, 5).slice(0, 7)) months.push(m);
      const monthly = months.map((m) => { const mb = baseline(`${m}-01`, DO.addDays(`${DO.addDays(`${m}-28`, 5).slice(0, 7)}-01`, -1), projects); return { m, pct: mb.pctLate ?? 0, check: mb.avgCheck ?? 0, n: mb.deliverable.length }; });
      ui.state.baselineExport = { b, from, to, monthly };
      body = html`<div class="metrics mb-4">
          ${C.metric({ label: "Sheets issued after planned date", value: b.pctLate === null ? "—" : `${b.pctLate}%`, hint: `${b.lateIssues.length} of ${b.deliverable.length} deliverable issues`, href: "#/sheets?flag=late" })}
          ${C.metric({ label: "Average working days in check", value: b.avgCheck ?? "—", hint: `${b.checks.length} checks closed`, href: "#/reports?tab=review" })}
          ${C.metric({ label: "Hours logged vs planned", value: b.hours.length ? `${Math.round((DO.sum(b.hours, (h) => h.loggedH) / Math.max(1, DO.sum(b.hours, (h) => h.plannedH))) * 100)}%` : "—", hint: `${DO.fmtNum(Math.round(DO.sum(b.hours, (h) => h.loggedH)))} h logged · ${DO.fmtNum(DO.sum(b.hours, (h) => h.plannedH))} h planned`, href: "#/reports?tab=hours" })}
          ${C.metric({ label: "Days from deliverables issued to invoice", value: b.avgInv ?? "—", hint: `${b.inv.length} stages invoiced · ${b.waiting.length} still waiting`, href: "#/billing" })}
        </div>
        <div class="grid g-2">
          ${C.card({ title: "Issued after planned date, by month", body: C.chartBox("bl-month", C.barChart({ items: monthly.map((x) => ({ label: `${DO.MONTHS[+x.m.slice(5) - 1]} ${x.m.slice(2, 4)}`, value: x.pct, color: "var(--chart-5)" })), unit: "%", max: 100 }), html`<table class="t"><thead><tr><th>Month</th><th class="right">Deliverable issues</th><th class="right">% late</th><th class="right">Avg days in check</th></tr></thead><tbody>${monthly.map((x) => html`<tr><td>${x.m}</td><td class="right">${x.n}</td><td class="right">${x.pct}%</td><td class="right">${x.check}</td></tr>`)}</tbody></table>`) })}
          ${C.card({ title: "Hours logged vs planned per project", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Project</th><th class="right">Planned h</th><th class="right">Logged h</th><th class="right">Ratio</th></tr></thead><tbody>${b.hours.map((h) => html`<tr><td>${C.mono(h.p.code)} ${h.p.name}</td><td class="right">${DO.fmtNum(h.plannedH)}</td><td class="right">${DO.fmtNum(Math.round(h.loggedH))}</td><td class="right">${h.plannedH ? Math.round((h.loggedH / h.plannedH) * 100) : 0}%</td></tr>`)}</tbody></table></div>` })}
        </div>
        ${C.card({ title: "Definitions (printed on the report)", cls: "mt-4", body: html`<dl class="card-body stack-2">${DEFS.map(([t, d]) => html`<div><dt class="strong">${t}</dt><dd class="muted">${d}</dd></div>`)}</dl>` })}`;
    } else if (tab === "hours") {
      const weeks = []; for (let w = DO.mondayOf(from); w <= to; w = DO.addDays(w, 7)) weeks.push(w);
      const rows = []; projects.forEach((p) => st.stagesOf(p.id).forEach((sg) => { const plannedH = DO.sum(st.S.allocations.filter((a) => a.stageId === sg.id && weeks.includes(a.week)), (a) => a.hours); const logged = DO.sum(st.S.timesheets.filter((t) => weeks.includes(t.week) && t.state !== "draft"), (t) => DO.sum(t.rows.filter((r) => r.stageId === sg.id), (r) => DO.sum(r.hours))); if (plannedH || logged) rows.push({ p, sg, plannedH, logged }); }));
      ui.state.hoursExport = rows;
      body = C.card({ title: "Planned vs actual hours", actions: C.btn("Export", { icon: "download", act: "export-hours", size: "sm" }), body: rows.length ? html`<div class="t-wrap"><table class="t"><thead><tr><th>Project</th><th>Stage</th><th class="right">Planned h</th><th class="right">Logged h</th><th>Progress</th></tr></thead><tbody>${rows.map((r) => { const pct = r.plannedH ? Math.round((r.logged / r.plannedH) * 100) : 0; return html`<tr><td>${C.mono(r.p.code)} ${r.p.name}</td><td>${r.sg.seq} ${r.sg.name}</td><td class="right">${DO.fmtNum(r.plannedH)}</td><td class="right">${DO.fmtNum(Math.round(r.logged))}</td><td><span class="iflex items-center gap-2">${C.bar(pct, pct > 110 ? "bad" : "")}<span class="small tabular">${pct}%</span></span></td></tr>`; })}</tbody></table></div>` : C.empty("No hours in this range."), foot: html`<span>${u.orgRole === "accounts" ? "Accounts sees hour totals only, never individuals (docs/03 §9)." : "Project totals; individual hours follow the visibility rules in docs/03 §9."}</span>` });
    } else if (tab === "util") {
      const weeks = []; for (let w = DO.mondayOf(from); w <= to; w = DO.addDays(w, 7)) weeks.push(w);
      const people = st.S.users.filter((x) => x.active && x.orgRole === "staff" && st.canSeeHoursOf(u, x)).sort(DO.by("name"));
      const rows = people.map((x) => { const avail = DO.sum(weeks, (w) => st.capacityOf(x, w)); const billable = DO.sum(st.S.timesheets.filter((t) => t.userId === x.id && weeks.includes(t.week) && t.state !== "draft"), (t) => DO.sum(t.rows.filter((r) => r.projectId), (r) => DO.sum(r.hours))); return { x, avail, billable, pct: avail ? Math.round((billable / avail) * 100) : 0 }; });
      const byDisc = st.S.disciplines.map((d) => { const r = rows.filter((y) => y.x.discipline === d.code); return { d, avail: DO.sum(r, (y) => y.avail), billable: DO.sum(r, (y) => y.billable) }; }).filter((y) => y.avail);
      body = html`<p class="alert neutral mb-3">${icon("info", 16)}<span>Utilisation = billable hours / available hours. People are listed alphabetically: DrawingOps never ranks individual productivity (docs/03 §9).</span></p><div class="grid g-2">${C.card({ title: "By discipline", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Discipline</th><th class="right">Available h</th><th class="right">Billable h</th><th class="right">Utilisation</th></tr></thead><tbody>${byDisc.map((y) => html`<tr><td>${y.d.name}</td><td class="right">${DO.fmtNum(Math.round(y.avail))}</td><td class="right">${DO.fmtNum(Math.round(y.billable))}</td><td class="right">${Math.round((y.billable / y.avail) * 100)}%</td></tr>`)}</tbody></table></div>` })}${C.card({ title: "By person (you can see)", body: html`<div class="t-wrap max-h-80 scroll-y"><table class="t"><thead><tr><th>Person</th><th class="right">Available h</th><th class="right">Billable h</th><th class="right">Utilisation</th></tr></thead><tbody>${rows.map((y) => html`<tr><td>${y.x.name}</td><td class="right">${Math.round(y.avail)}</td><td class="right">${Math.round(y.billable)}</td><td class="right">${y.pct}%</td></tr>`)}</tbody></table></div>` })}</div>`;
    } else if (tab === "review") {
      const b = baseline(from, to, projects);
      const byDisc = DO.groupBy(b.checks, (c) => c.disc); const byChecker = DO.groupBy(b.checks, (c) => c.by);
      const inState = {}; st.S.sheets.filter((s) => projects.some((p) => p.id === s.projectId)).forEach((s) => { const tl = st.transitionsOf(s.id).slice().reverse(); tl.forEach((t, i) => { const next = tl[i + 1]; if (!next) return; const d = DO.workingDaysBetween(DO.dateOf(t.at), DO.dateOf(next.at)); if (DO.dateOf(next.at) < from || DO.dateOf(next.at) > to) return; (inState[t.to] = inState[t.to] || []).push(d); }); });
      body = html`<div class="grid g-2">${C.card({ title: "Average working days in check, by discipline", body: C.chartBox("rc-disc", C.barChart({ items: Object.entries(byDisc).map(([d, l]) => ({ label: d, value: Math.round((DO.sum(l, (c) => c.days) / l.length) * 10) / 10, color: "var(--chart-3)" })), unit: " d" }), html`<table class="t"><thead><tr><th>Discipline</th><th class="right">Checks</th><th class="right">Avg working days</th></tr></thead><tbody>${Object.entries(byDisc).map(([d, l]) => html`<tr><td>${st.disc(d)?.name}</td><td class="right">${l.length}</td><td class="right">${(DO.sum(l, (c) => c.days) / l.length).toFixed(1)}</td></tr>`)}</tbody></table>`) })}${C.card({ title: "By checker", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>Checker</th><th class="right">Checks closed</th><th class="right">Avg working days</th></tr></thead><tbody>${Object.entries(byChecker).sort((a, b) => st.userName(a[0]).localeCompare(st.userName(b[0]))).map(([id, l]) => html`<tr><td>${st.userName(id)}</td><td class="right">${l.length}</td><td class="right">${(DO.sum(l, (c) => c.days) / l.length).toFixed(1)}</td></tr>`)}</tbody></table></div>` })}</div>${C.card({ title: "Time in each state", cls: "mt-4", body: html`<div class="t-wrap"><table class="t"><thead><tr><th>State</th><th class="right">Visits</th><th class="right">Avg working days</th></tr></thead><tbody>${Object.entries(inState).map(([k, l]) => html`<tr><td>${C.chip(k)}</td><td class="right">${l.length}</td><td class="right">${(DO.sum(l) / l.length).toFixed(1)}</td></tr>`)}</tbody></table></div>` })}`;
    } else if (tab === "missing") {
      const lastWeek = DO.addDays(thisWeek(), -7);
      const people = st.S.users.filter((x) => x.active && x.orgRole !== "admin" && st.canSeeHoursOf(u, x));
      const miss = people.filter((x) => st.timesheetMissing(x.id, lastWeek));
      body = C.card({ title: `Missing timesheets for week ${DO.isoWeek(lastWeek)} · ${miss.length}`, actions: miss.length ? C.btn("Send reminders now", { size: "sm", icon: "mail", act: "remind-ts", data: { w: lastWeek } }) : "", body: miss.length ? html`<ul>${miss.map((x) => html`<li class="list-row"><span>${x.name}<span class="small muted block">${x.title}</span></span>${C.flag("timesheet_missing", "Hours missing", "A-06: due Tuesday 12:00 for the previous week.")}</li>`)}</ul>` : C.empty("Everyone you can see has submitted last week's timesheet.") });
    }
    return html`${C.pageHead({ title: "Reports", meta: html`${DO.fmtDate(from)} to ${DO.fmtDate(to)} · projects you can see`, actions: tab === "baseline" ? C.btn("Export report (PDF)", { icon: "download", act: "export-baseline", variant: "primary" }) : "" })}${C.tabs(tabsList, tab, "Reports")}${tab !== "missing" ? rangeBar : ""}${body}`;
  };
  ui.on("rp-range", (el) => DO.app.setQuery({ range: el.dataset.v === "custom" ? "" : el.dataset.v, from: el.dataset.v === "custom" ? DO.addDays(DO.today(), -60) : "", to: "" }));
  ui.on("rp-date", (el) => DO.app.setQuery({ [el.dataset.k]: el.value }));
  ui.on("export-baseline", () => { const x = ui.state.baselineExport; if (!x) return; const { b, from, to, monthly } = x; DO.download(new Blob([DO.drawing.tablePdf({ firm: st.S.org, title: "Baseline metrics report (D-05)", subtitle: `${DO.fmtDate(from)} to ${DO.fmtDate(to)}`, headerLines: [`% sheets issued after planned date: ${b.pctLate ?? "-"}%   (${b.lateIssues.length} of ${b.deliverable.length})`, `Average working days in check: ${b.avgCheck ?? "-"}   (${b.checks.length} checks)`, `Hours logged vs planned: ${Math.round(DO.sum(b.hours, (h) => h.loggedH))} h / ${DO.sum(b.hours, (h) => h.plannedH)} h`, `Days from deliverables issued to invoice: ${b.avgInv ?? "-"}   (${b.inv.length} stages; ${b.waiting.length} waiting)`, " "], columns: [{ label: "Month" }, { label: "Deliverable issues", right: true }, { label: "% late", right: true }, { label: "Avg days in check", right: true }], rows: monthly.map((m) => [m.m, m.n, `${m.pct}%`, m.check]), footnotes: DEFS.map(([t, d]) => `${t}: ${d}`) })], { type: "application/pdf" }), `baseline-metrics_${from}_${to}.pdf`); ui.toast({ title: "Baseline report downloaded", description: "Definitions are printed on the report.", tone: "ok" }); });
  ui.on("export-hours", (el) => C.exportMenu(el, () => ({ name: "hours", title: "Hours by project and stage", columns: [{ label: "Project", mono: true }, { label: "Name", w: 2 }, { label: "Stage", w: 1.5 }, { label: "Planned h", right: true }, { label: "Logged h", right: true }], rows: (ui.state.hoursExport || []).map((r) => [r.p.code, r.p.name, `${r.sg.seq} ${r.sg.name}`, r.plannedH, Math.round(r.logged)]) })));
  ui.on("remind-ts", (el) => { let n = 0; st.S.users.filter((x) => x.active && x.orgRole !== "admin" && st.timesheetMissing(x.id, el.dataset.w)).forEach((x) => { st.notify([x.id], "timesheet_missing", `Reminder: timesheet for week ${DO.isoWeek(el.dataset.w)}`, "Please submit last week's hours.", "#/timesheets"); n++; }); st.commit(); ui.toast({ title: `${DO.plural(n, "reminder")} sent`, description: "In-app and to the demo mailbox.", tone: "ok" }); });

  // ---------- Export jobs ----------
  S.exportJob = (ctx) => {
    const j = st.S.exports.find((x) => x.id === ctx.params.id);
    if (!j) return C.card({ body: C.empty("This export does not exist or has expired.") });
    const spec = ui.state.exportSpecs?.[j.id];
    return html`${C.pageHead({ title: j.title, crumbs: [{ label: "Exports" }], meta: `${DO.fmtNum(j.rows)} rows · ${j.format.toUpperCase()} · started ${DO.fmtDateTime(j.at)}` })}${C.card({ body: html`<div class="card-body stack-2"><p>${j.state === "done" ? html`${icon("circle-check", 16, "ok-t")} Ready since ${DO.fmtTime(j.doneAt)}. A link was emailed to you.` : html`${icon("loader-circle", 16, "spin")} Building the file in the background… ${j.progress}%`}</p><div class="bar lg"><span style="width:${j.progress}%"></span></div>${j.state === "done" && spec ? C.btn("Download", { variant: "primary", icon: "download", act: "job-dl", data: { id: j.id } }) : j.state === "done" ? html`<p class="small muted">The file was built in an earlier session; run the export again to download it.</p>` : ""}</div>` })}`;
  };
  ui.on("job-dl", (el) => { const j = st.S.exports.find((x) => x.id === el.dataset.id); C.exportTable({ ...ui.state.exportSpecs[j.id], format: j.format }); });
})(window);

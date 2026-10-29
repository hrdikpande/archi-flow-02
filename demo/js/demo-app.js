/* DrawingOps demo · router, app shell (DESIGN.md §3), command palette, notifications panel,
   keyboard shortcuts and the demo controls (mailbox, sweep, reset). */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const { html, raw, icon, C } = DO;
  const st = DO.store;
  const ui = DO.ui;
  DO.screens = DO.screens || {};

  // ---------- Routes ----------
  const ROUTES = [
    ["/sign-in", "signIn", { pub: true, title: "Sign in" }], ["/sso", "sso", { pub: true, title: "Single sign-on" }], ["/forgot", "forgot", { pub: true, title: "Forgot password" }], ["/reset", "reset", { pub: true, title: "Reset password" }], ["/invite/:token", "invite", { pub: true, title: "Accept invitation" }],
    ["/t/:token", "extTransmittal", { pub: true, title: "Transmittal" }], ["/site/:token", "siteView", { pub: true, title: "Site view" }], ["/mailbox", "mailbox", { pub: true, title: "Demo mailbox" }],
    ["/", "myWork", { title: "My work" }], ["/portfolio", "portfolio", { title: "Portfolio", need: "portfolio" }], ["/sheets", "sheetsList", { title: "Sheets" }], ["/disciplines/:code", "discipline", { title: "Discipline" }],
    ["/projects", "projects", { title: "Projects" }], ["/projects/new", "newProject", { title: "New project", need: "createProject" }],
    ["/projects/:pid", "projectOverview", { title: "Project", project: "overview" }], ["/projects/:pid/register", "register", { project: "register" }], ["/projects/:pid/import", "importWizard", { project: "register" }], ["/projects/:pid/upload", "uploadPdfs", { project: "register" }], ["/projects/:pid/cad-sync", "cadSync", { project: "register" }],
    ["/projects/:pid/sheets/:sid", "sheetDetail", { project: "register" }], ["/projects/:pid/stages", "stages", { project: "stages" }], ["/projects/:pid/team", "team", { project: "team" }], ["/projects/:pid/issue", "issueComposer", { project: "transmittals" }],
    ["/projects/:pid/transmittals", "transmittals", { project: "transmittals" }], ["/projects/:pid/transmittals/:tid", "transmittalDetail", { project: "transmittals" }], ["/projects/:pid/activity", "activity", { project: "activity" }], ["/projects/:pid/comments", "comments", { project: "comments" }],
    ["/projects/:pid/construction", "construction", { project: "construction" }], ["/projects/:pid/construction/:tab", "construction", { project: "construction" }], ["/projects/:pid/decisions", "decisions", { project: "decisions" }],
    ["/reviews", "reviews", { title: "Reviews" }], ["/workload", "workload", { title: "Workload" }], ["/workload/staff", "staff", { title: "Staff directory" }], ["/timesheets", "timesheet", { title: "Timesheets", need: "timesheet" }], ["/timesheets/approvals", "approvals", { title: "Timesheet approvals", need: "approveTs" }],
    ["/reports", "reports", { title: "Reports", need: "reports" }], ["/knowledge", "knowledge", { title: "Knowledge" }], ["/intelligence/findings", "findings", { title: "Drawing check findings" }], ["/billing", "billing", { title: "Billing signals", need: "billing" }], ["/billing/invoiced", "billing", { title: "Invoiced stages", need: "billing" }],
    ["/contacts", "contacts", { title: "Contacts" }], ["/settings/notifications", "prefs", { title: "Notification preferences" }], ["/settings/profile", "profile", { title: "Profile" }], ["/exports/:id", "exportJob", { title: "Export" }], ["/admin", "admin", { title: "Admin", need: "admin" }], ["/admin/:section", "admin", { title: "Admin" }],
  ].map(([pattern, screen, meta]) => ({ pattern, screen, meta, re: new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`), keys: (pattern.match(/:[a-z]+/g) || []).map((k) => k.slice(1)) }));

  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
    const [path, qs = ""] = h.split("?");
    const query = {}; new URLSearchParams(qs).forEach((v, k) => { query[k] = k in query ? [].concat(query[k], v) : v; });
    for (const r of ROUTES) { const m = r.re.exec(path === "" ? "/" : path); if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = m[i + 1]; }); return { path, query, params, route: r }; } }
    return { path, query, params: {}, route: null };
  }
  /** Change query params in place (filters live in the URL, DESIGN.md §4 FilterBar). */
  function setQuery(patch, replace = true) {
    const { path, query } = parseHash(); const q = { ...query, ...patch };
    Object.keys(q).forEach((k) => { if (q[k] === "" || q[k] === null || q[k] === undefined || q[k] === false || (Array.isArray(q[k]) && !q[k].length)) delete q[k]; });
    const sp = new URLSearchParams(); Object.entries(q).forEach(([k, v]) => [].concat(v).forEach((x) => sp.append(k, x)));
    const next = `#${path}${sp.toString() ? `?${sp}` : ""}`;
    if (replace) { history.replaceState(null, "", next); render(); } else location.hash = next;
  }
  const go = (h) => { location.hash = h.startsWith("#") ? h : `#${h}`; };

  // ---------- Render with focus and scroll preserved ----------
  const app = () => document.getElementById("app");
  let lastPath = null; let pendingScroll = null;
  function render() {
    ui.closeMenu?.();
    const ctx = parseHash(); const u = DO.auth.current(); st.setActor(u?.id || null);
    const active = document.activeElement; const focusId = active?.id; const sel = active && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
    const samePage = lastPath === ctx.path; const scrollY = window.scrollY;
    let out;
    if (!ctx.route) out = u ? shell(u, ctx, notFound()) : page("signIn", ctx);
    else if (ctx.route.meta.pub) { out = page(ctx.route.screen, ctx, u); }
    else if (!u) { location.replace(`#/sign-in?next=${encodeURIComponent(location.hash.slice(1))}`); return; }
    else out = shell(u, ctx, content(u, ctx));
    const target = app();
    try { target.innerHTML = String(out.html ?? out); } catch (e) { setTimeout(render, 0); return; }
    document.title = `${ctx.route?.meta.title || DO.ui.state.pageTitle || "DrawingOps"} · DrawingOps demo`;
    out.mount?.(target);
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus({ preventScroll: true }); if (sel && "setSelectionRange" in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not text */ } } }
    if (samePage) window.scrollTo(0, scrollY); else { window.scrollTo(0, 0); if (lastPath !== null && !focusId) document.getElementById("main")?.focus({ preventScroll: true }); }
    lastPath = ctx.path;
  }
  function page(screen, ctx, u) { const fn = DO.screens[screen]; return fn ? fn(ctx, u) : notFound(); }
  function content(u, ctx) {
    const meta = ctx.route.meta; const caps = st.caps(u);
    if (meta.need && !caps[meta.need] && !(meta.need === "admin" && caps.audit)) return noAccess();
    if (meta.project) {
      const p = st.project(ctx.params.pid);
      if (!p || !st.canSeeProject(u, p)) return html`${C.pageHead({ title: "Project not available" })}${C.card({ body: C.empty("This project does not exist or you are not on its team. A project lead adds people to the team.", C.linkBtn("Back to projects", "#/projects")) })}`;
      ctx.project = p;
      const body = DO.screens[ctx.route.screen](ctx, u);
      return { html: html`${DO.screens.projectHeader(p, meta.project, u, ctx)}${body.html ?? body}`, mount: body.mount };
    }
    return DO.screens[ctx.route.screen](ctx, u);
  }
  const notFound = () => html`${C.pageHead({ title: "Page not found" })}${C.card({ body: C.empty("That address does not match a page in DrawingOps.", C.linkBtn("Go to My work", "#/")) })}`;
  const noAccess = () => html`${C.pageHead({ title: "No access" })}${C.card({ body: C.empty("Your role does not include this page. Permissions come from your organisation role and your project roles (docs/03 §17).", C.linkBtn("Go to My work", "#/")) })}`;

  // ---------- Shell ----------
  function navItems(u) {
    const c = st.caps(u); const reviews = st.reviewQueue(u).length;
    return [
      { href: "#/", label: "My work", icon: "house", match: (p) => p === "/" },
      c.portfolio && { href: "#/portfolio", label: "Portfolio", icon: "layout-dashboard" },
      { href: "#/projects", label: "Projects", icon: "folder-kanban", match: (p) => p.startsWith("/projects") },
      { href: "#/reviews", label: "Reviews", icon: "check-check", count: reviews },
      u.orgRole !== "accounts" && { href: "#/workload", label: "Workload", icon: "layout-grid", match: (p) => p.startsWith("/workload") },
      c.timesheet && { href: "#/timesheets", label: "Timesheets", icon: "clock", match: (p) => p.startsWith("/timesheets") },
      c.reports && { href: "#/reports", label: "Reports", icon: "chart-column" },
      { href: "#/knowledge", label: "Knowledge", icon: "book-open" },
      c.billing && { href: "#/billing", label: "Billing", icon: "receipt-indian-rupee", match: (p) => p.startsWith("/billing") },
      { href: "#/contacts", label: "Contacts", icon: "book-user" },
      "-",
      (c.admin || c.audit) && { href: c.admin ? "#/admin" : "#/admin/audit", label: "Admin", icon: "settings", match: (p) => p.startsWith("/admin") },
    ].filter(Boolean);
  }
  function shell(u, ctx, body) {
    const unread = st.S.notifications.filter((n) => n.userId === u.id && !n.read).length;
    const collapsed = ui.state.navCollapsed; const navOpen = ui.state.navOpen;
    const items = navItems(u);
    const main = body.html ?? body;
    return {
      html: html`<div class="shell ${collapsed ? "collapsed" : ""} ${navOpen ? "nav-open" : ""}">
        <a href="#main" class="skip-link" data-act="skip">Skip to content</a>
        <header class="topbar">
          <div class="flex items-center gap-2 min-w-0">
            <button class="icon-btn" data-act="toggle-nav" aria-label="${collapsed ? "Expand navigation" : "Collapse navigation"}" aria-expanded="${!collapsed}" aria-controls="primary-nav">${icon(collapsed ? "panel-left-open" : "panel-left-close", 18)}</button>
            <a class="brand" href="#/"><img src="assets/images/logo.svg" alt="" width="22" height="22">DrawingOps</a>
            <span class="small muted org-name nowrap hide-sm">· ${st.S.org.name}</span>
          </div>
          <div class="flex grow jcenter"><button class="search-trigger" data-act="palette" aria-label="Search sheets, projects, transmittals (Ctrl+K)">${icon("search", 16)}<span class="hint grow trunc">Search sheets, projects, transmittals…</span><span class="kbd">${navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl K"}</span></button></div>
          <div class="flex items-center gap-1">
            <button class="icon-btn" data-act="notifications" aria-label="Notifications, ${unread} unread" aria-haspopup="dialog">${icon("bell", 18)}${unread ? html`<span class="dot">${unread > 99 ? "99+" : unread}</span>` : ""}</button>
            <button class="user-btn" data-act="user-menu" aria-haspopup="menu" aria-expanded="false"><span class="sr-only">Account menu for ${u.name}</span>${C.avatar(u.name)}<span class="hide-sm small" style="color:var(--text)">${DO.short(u.name)}</span>${icon("chevron-down", 14)}</button>
          </div>
        </header>
        <div class="body-row">
          ${navOpen ? html`<div class="scrim only-sm" data-act="toggle-nav"></div>` : ""}
          <nav id="primary-nav" class="sidenav" aria-label="Primary"><ul class="flex col gap-1">${items.map((it) => (it === "-" ? html`<li><hr></li>` : html`<li><a href="${it.href}" class="motion ${(it.match ? it.match(ctx.path) : ctx.path === it.href.slice(1)) ? "active" : ""}" title="${it.label}" ${(it.match ? it.match(ctx.path) : ctx.path === it.href.slice(1)) ? raw('aria-current="page"') : ""}>${icon(it.icon, 18)}<span class="lbl">${it.label}</span>${it.count ? html`<span class="count" aria-label="${it.count} waiting">${it.count}</span>` : ""}</a></li>`))}</ul>
            <div class="mt-4 small muted lbl" style="padding:0 12px">${st.S.org.name}<br>${C.mono(st.S.org.timezone)}</div>
          </nav>
          <main id="main" tabindex="-1" class="main">${main}</main>
        </div>
        <button class="demo-fab" data-act="demo-menu" aria-haspopup="menu">${icon("presentation", 14)} Demo</button>
      </div>`,
      mount: body.mount,
    };
  }

  ui.on("toggle-nav", () => { if (innerWidth < 1280) ui.state.navOpen = !ui.state.navOpen; else ui.state.navCollapsed = !ui.state.navCollapsed; render(); });
  ui.on("skip", () => document.getElementById("main")?.focus());
  ui.on("user-menu", (el) => {
    const u = DO.auth.current(); const theme = ui.state.theme || readTheme();
    ui.menu(el, [
      { label: `${u.name} · ${u.email}` },
      { label: `${{ owner: "Owner / Principal", staff: "Staff", accounts: "Accounts", admin: "System admin" }[u.orgRole]} · ${u.title}` },
      "-", { label: "Theme" },
      ...[["system", "Match system", "monitor"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]].map(([v, l, i]) => ({ text: l, icon: i, on: theme === v, run: () => applyTheme(v) })),
      { text: ui.state.comfortable ? "Compact rows (36 px)" : "Comfortable rows (44 px)", icon: "rows-3", run: () => { ui.state.comfortable = !ui.state.comfortable; document.body.classList.toggle("comfortable", ui.state.comfortable); try { localStorage.setItem("drawingops-demo-density", ui.state.comfortable ? "1" : ""); } catch (e) { /* */ } } },
      "-",
      { text: "Profile and delegation", icon: "user", href: "#/settings/profile" },
      { text: "Notification preferences", icon: "bell", href: "#/settings/notifications" },
      { text: "Keyboard shortcuts", icon: "keyboard", hint: "?", run: shortcuts },
      "-",
      { text: "Sign out", icon: "log-out", run: () => { DO.auth.signOut(); ui.toast({ title: "Signed out", description: "Sign in as another demo account to see a different role." }); go("/sign-in"); } },
    ]);
  });

  // ---------- Theme ----------
  function readTheme() { try { return localStorage.getItem("drawingops-demo-theme") || "system"; } catch (e) { return "system"; } }
  function applyTheme(v) { ui.state.theme = v; if (v === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v); try { localStorage.setItem("drawingops-demo-theme", v); } catch (e) { /* */ } }

  // ---------- Notifications panel (S-13) ----------
  ui.on("notifications", () => {
    const u = DO.auth.current();
    const draw = () => {
      const list = st.S.notifications.filter((n) => n.userId === u.id).slice(0, 60);
      const T = DO.today(); const today = list.filter((n) => DO.dateOf(n.at) === T); const earlier = list.filter((n) => DO.dateOf(n.at) !== T);
      const item = (n) => html`<a href="${n.link || "#/"}" class="notif ${n.read ? "read" : "unread"}" data-act="open-notif" data-id="${n.id}" data-prevent><span class="ndot" aria-hidden="true"></span><span class="grow min-w-0"><span class="strong block">${n.title}</span>${n.body ? html`<span class="small muted" style="display:block">${n.body}</span>` : ""}<span class="small muted">${DO.fmtRel(n.at)}${n.digest ? " · in your daily digest" : ""}${n.read ? "" : html`<span class="sr-only">, unread</span>`}</span></span></a>`;
      return html`<div class="flex between items-center px-4 py-3" style="border-bottom:1px solid var(--border)"><h2 class="title">Notifications</h2><div class="flex gap-1">${C.btn("Mark all read", { size: "sm", act: "notif-read-all" })}<a class="btn sm ghost" href="#/settings/notifications" data-act="close-panel-go" data-href="#/settings/notifications">${icon("settings", 14)}<span class="sr-only">Preferences</span></a><button class="icon-btn" data-act="close-panel" aria-label="Close">${icon("x", 16)}</button></div></div>
        <div class="scroll-y grow">${list.length ? html`${today.length ? html`<p class="section-title px-4 mt-3">Today</p>${today.map(item)}` : ""}${earlier.length ? html`<p class="section-title px-4 mt-3">Earlier</p>${earlier.map(item)}` : ""}` : C.empty("You're all caught up. New assignments, reviews and alerts appear here.")}</div>`;
    };
    closePanel();
    const el = document.createElement("aside"); el.className = "panel-right"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Notifications"); el.id = "notif-panel";
    el.innerHTML = String(draw()); document.body.appendChild(el); el.querySelector("button")?.focus();
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
    ui.state.redrawPanel = () => { el.innerHTML = String(draw()); };
  });
  const closePanel = () => { document.getElementById("notif-panel")?.remove(); ui.state.redrawPanel = null; };
  ui.on("close-panel", closePanel);
  ui.on("close-panel-go", (el) => { closePanel(); go(el.dataset.href); });
  ui.on("open-notif", (el) => { const n = st.S.notifications.find((x) => x.id === el.dataset.id); if (n) { n.read = true; st.commit(); } closePanel(); if (n?.link) go(n.link); });
  ui.on("notif-read-all", () => { const u = DO.auth.current(); st.S.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; }); st.commit(); ui.state.redrawPanel?.(); });
  document.addEventListener("mousedown", (e) => { const p = document.getElementById("notif-panel"); if (p && !p.contains(e.target) && !e.target.closest("[data-act=notifications]")) closePanel(); });

  // ---------- Command palette (⌘K) ----------
  const ACTIONS = [["Go to My work", "#/", "house"], ["Go to Portfolio", "#/portfolio", "layout-dashboard"], ["Go to Projects", "#/projects", "folder-kanban"], ["Go to Reviews", "#/reviews", "check-check"], ["Go to Workload", "#/workload", "layout-grid"], ["Go to Timesheets", "#/timesheets", "clock"], ["Go to Reports", "#/reports", "chart-column"], ["Go to Knowledge search", "#/knowledge", "book-open"], ["Go to Billing signals", "#/billing", "receipt-indian-rupee"], ["Go to Contacts", "#/contacts", "book-user"], ["Open the demo mailbox", "#/mailbox", "inbox"], ["Notification preferences", "#/settings/notifications", "bell"], ["Admin settings", "#/admin", "settings"]];
  function palette() {
    const u = DO.auth.current(); if (!u) return;
    let idx = 0; let results = [];
    const d = ui.dialog({ title: "Search", size: "", body: html`<div class="palette" style="margin:0;width:100%;border:0;box-shadow:none"><div class="pin">${icon("search", 18)}<input id="pal-q" placeholder="Search sheets (A-101), projects, transmittals, contacts, or type an action" autocomplete="off" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pal-res"></div><div class="pres" id="pal-res" role="listbox"></div></div>`, mount: (el, close) => {
      el.querySelector(".dialog").style.width = "680px"; el.querySelector(".dialog-head").style.display = "none"; el.querySelector(".dialog-body").style.padding = "0"; el.style.alignItems = "flex-start"; el.style.paddingTop = "10vh";
      const q = el.querySelector("#pal-q"); const res = el.querySelector("#pal-res");
      const draw = () => {
        const t = q.value.trim(); const t0 = performance.now();
        const found = t ? st.search(t, u) : [];
        const acts = ACTIONS.filter(([l]) => !t || l.toLowerCase().includes(t.toLowerCase())).map(([title, link, ic]) => ({ kind: "Actions", title, link, icon: ic }));
        results = [...found, ...acts.slice(0, t ? 4 : 8)]; idx = Math.min(idx, Math.max(0, results.length - 1));
        const groups = DO.groupBy(results, (r) => r.kind); let i = 0;
        res.innerHTML = String(results.length ? html`${Object.entries(groups).map(([k, list]) => html`<p class="pg">${k}</p>${list.map((r) => { const my = i++; return html`<a class="po ${my === idx ? "on" : ""}" href="${r.link}" role="option" aria-selected="${my === idx}" data-i="${my}">${icon(r.icon || "file-text", 16)}<span class="grow min-w-0"><span class="block trunc">${r.mono ? html`<span class="mono strong">${r.mono}</span> ${r.title.slice(r.mono.length)}` : r.title}</span>${r.sub ? html`<span class="sub trunc" style="display:block">${r.sub}</span>` : ""}</span></a>`; })}`)}<p class="pg" style="font-weight:400">${found.length} results in ${Math.max(1, Math.round(performance.now() - t0))} ms · only projects you can see</p>` : html`<p class="p-4 muted">No matches for “${t}”. Try a sheet number such as A-101, or words like “OT duct”.</p>`);
        res.querySelectorAll("a.po").forEach((a) => a.addEventListener("click", () => close()));
      };
      q.addEventListener("input", () => { idx = 0; draw(); });
      q.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(results.length - 1, idx + 1); draw(); } if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); } if (e.key === "Enter" && results[idx]) { e.preventDefault(); close(); go(results[idx].link); } });
      draw(); setTimeout(() => q.focus(), 40);
    } });
    return d;
  }
  ui.on("palette", palette);

  // ---------- Keyboard shortcuts (DESIGN.md §6) ----------
  function shortcuts() {
    const rows = [["⌘K / Ctrl+K", "Search and command palette"], ["?", "This list"], ["g then m", "Go to My work"], ["g then r", "Go to the register (inside a project)"], ["g then w", "Go to Workload"], ["g then v", "Go to Reviews"], ["j / k", "Next / previous row in the register"], ["Enter", "Open the focused row"], ["x", "Select the focused row"], ["s", "Submit for check (own sheet, on the sheet page)"], ["a", "Approve (review panel)"], ["Esc", "Close a dialog, drawer or panel"]];
    ui.dialog({ title: "Keyboard shortcuts", body: html`<table class="t"><tbody>${rows.map(([k, d]) => html`<tr><td><span class="kbd">${k}</span></td><td>${d}</td></tr>`)}</tbody></table>`, foot: html`<button class="btn primary" data-close>Done</button>` });
  }
  let gPressed = 0;
  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest?.("input,textarea,select,[contenteditable]");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (DO.auth.current()) palette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".overlay,.drawer-wrap")) return;
    if (e.key === "?") { e.preventDefault(); shortcuts(); return; }
    const now = Date.now();
    if (e.key === "g") { gPressed = now; return; }
    if (now - gPressed < 900) {
      const ctx = parseHash(); gPressed = 0;
      if (e.key === "m") go("/"); if (e.key === "w") go("/workload"); if (e.key === "v") go("/reviews");
      if (e.key === "r") { const pid = ctx.params.pid || st.visibleProjects(DO.auth.current())[0]?.id; if (pid) go(`/projects/${pid}/register`); }
      return;
    }
  });

  // ---------- Demo controls ----------
  ui.on("demo-menu", (el) => {
    const unreadMail = st.S.emails.filter((m) => !m.read).length;
    ui.menu(el, [
      { label: "Demo controls (not part of the product)" },
      { text: `Demo mailbox${unreadMail ? ` (${unreadMail} new)` : ""}`, icon: "inbox", href: "#/mailbox" },
      { text: "Run the 08:00 daily sweep now", icon: "refresh-cw", run: () => { const r = st.runSweep(); ui.toast({ title: "Daily sweep finished", description: `${r.counts.at_risk_raised} at risk and ${r.counts.late_raised} late flags notified, ${r.counts.reviews_overdue} overdue reviews, ${r.counts.timesheet_reminders} timesheet reminders. ${r.counts.duplicates_skipped ? `${r.counts.duplicates_skipped} duplicates skipped (idempotent).` : "Run it again: nothing is sent twice."}`, tone: "ok", timeout: 8000 }); } },
      { text: "Guided walkthrough", icon: "play", run: tour },
      { text: "Keyboard shortcuts", icon: "keyboard", run: shortcuts },
      "-",
      { text: "Switch demo account (sign out)", icon: "users", run: () => { DO.auth.signOut(); go("/sign-in"); } },
      { text: "Reset demo data", icon: "rotate-ccw", danger: true, run: resetDemo },
    ], { align: "start" });
  });
  async function resetDemo() {
    const ok = await ui.confirm({ title: "Reset the demo?", body: html`<p>Every change made in this browser (sheets moved, transmittals issued, hours logged, settings) is discarded and the original demo data is restored. You stay signed in.</p><p class="small muted mt-2">Only this demo's browser storage is affected.</p>`, confirm: "Reset demo data", danger: true });
    if (!ok) return;
    const u = DO.auth.current(); st.reset(); if (u) DO.auth._mem = null; seedInbox();
    ui.toast({ title: "Demo data restored", description: "Back to the starting state.", tone: "ok" });
    if (!DO.auth.current()) go("/sign-in"); else render();
  }
  DO.app = { render, go, parseHash, setQuery, palette, shortcuts, resetDemo, backgroundExport, applyTheme };

  function tour() {
    const steps = [
      ["Owner: portfolio health in 5 seconds", "Sign in as Nikhil (Owner). Portfolio shows late and at-risk sheets, the oldest review and who is over-allocated. Every number opens the list behind it.", "#/portfolio"],
      ["Designer: one click at the real event", "Sign in as Rahul (Designer). My work lists his sheets by due date with the next action on each row; M-204 came back with redlines.", "#/"],
      ["Checker: review queue", "Sign in as Anil (Discipline lead). Reviews shows sheets waiting oldest first. Open one, add a comment or redline file, then Approve or Return.", "#/reviews"],
      ["Document controller: issue a transmittal", "Sign in as Deepa (Document controller). In HSR Block B › Transmittals, choose Issue sheets: eight sheets are approved. One is blocked by the naming rule (A-104) and one has no PDF (E-102).", "#/projects/p1/issue"],
      ["Client: no login needed", "Open the demo mailbox and follow the transmittal link: download drawings, download all as ZIP and acknowledge receipt.", "#/mailbox"],
      ["Accounts: billing signal", "Sign in as Meera (Accounts). Two stages are ready to invoice. Export CSV or mark one invoiced.", "#/billing"],
      ["Admin: settings with a live tester", "Sign in as Asha (Admin, code 246810). Try the naming-rule tester, the working calendar and the audit trail.", "#/admin/naming-rules"],
    ];
    let i = 0;
    const show = () => { const [t, b, link] = steps[i]; ui.dialog({ title: `${i + 1} of ${steps.length} · ${t}`, body: html`<p>${b}</p>`, foot: html`${i > 0 ? html`<button class="btn" id="tp">Back</button>` : ""}<a class="btn" href="${link}" id="tg">Open this page</a><button class="btn primary" id="tn">${i < steps.length - 1 ? "Next" : "Finish"}</button>`, mount: (el, close) => { el.querySelector("#tn").onclick = () => { close(); if (i < steps.length - 1) { i++; show(); } }; el.querySelector("#tp")?.addEventListener("click", () => { close(); i--; show(); }); el.querySelector("#tg").addEventListener("click", () => close()); } }); };
    show();
  }

  // ---------- Background exports (> 5,000 rows run as a job and email a link) ----------
  function backgroundExport(spec, format) {
    const u = DO.auth.current();
    const job = { id: st.nextId("ex"), title: spec.title, rows: spec.rows.length, format, state: "running", progress: 0, at: new Date().toISOString(), by: u.id };
    st.S.exports.unshift(job); st.commit(); ui.state.exportSpecs = ui.state.exportSpecs || {}; ui.state.exportSpecs[job.id] = spec;
    ui.toast({ title: "Export started in the background", description: `${DO.fmtNum(spec.rows.length)} rows. We'll email you a link when it's ready.`, action: { label: "View job", run: () => go(`/exports/${job.id}`) } });
    const tick = () => { const j = st.S.exports.find((x) => x.id === job.id); if (!j) return; j.progress = Math.min(100, j.progress + 25); if (j.progress >= 100) { j.state = "done"; j.doneAt = new Date().toISOString(); st.sendEmail({ to: [u.email], toName: u.name, subject: `Your export is ready: ${spec.title}`, body: `${DO.fmtNum(spec.rows.length)} rows (${format.toUpperCase()}). The link is valid for 7 days.`, link: `#/exports/${job.id}`, kind: "export" }); st.commit(); ui.toast({ title: "Export ready", description: spec.title, tone: "ok", action: { label: "Download", run: () => C.exportTable({ ...spec, format }) } }); } else { st.commit(); setTimeout(tick, 700); } };
    setTimeout(tick, 700);
  }

  // ---------- First-run inbox: notifications and emails that a real week would have produced ----------
  function seedInbox() {
    const S = st.S; if (S.inboxSeeded) return; S.inboxSeeded = true;
    const T = DO.today(); const prev = st.actorId; st.setActor(null);
    const back = (mins) => new Date(Date.now() - mins * 60000).toISOString();
    const push = (uid, event, title, body, link, mins, read = false) => S.notifications.push({ id: st.nextId("n"), userId: uid, event, title, body, link, at: back(mins), read, digest: st.EVENTS[event]?.def === "digest" });
    const sh = (n) => S.sheets.find((s) => s.projectId === "p1" && s.number === n);
    const link = (s) => (s ? `#/projects/${s.projectId}/sheets/${s.id}` : "#/");
    // Designer
    push("u_des", "returned", "M-204 returned with redlines", "Karthik Iyer: “Return air path through the corridor ceiling is not allowed in the ICU zone…”", link(sh("M-204")), 60 * 17);
    push("u_des", "late", "M-205 late by 2 working days", "OT Ductwork Level 2 (2026-014) was due " + DO.fmtDate(sh("M-205")?.planned) + ".", link(sh("M-205")), 95);
    push("u_des", "at_risk", "M-206 at risk: due in 4 days", "OT Ductwork Level 3 is still in progress.", link(sh("M-206")), 96);
    push("u_des", "assigned", "M-102 assigned to you", "Karthik Iyer assigned M-102 HVAC Ductwork - First Floor (2026-014) to you.", link(sh("M-102")), 60 * 26, true);
    // Checker (Anil) and senior reviewer
    st.reviewQueue(st.user("u_dl")).slice(0, 4).forEach((x, i) => push("u_dl", "review_requested", `${x.sheet.number} is ready for your check`, `${st.userName(x.sheet.ownerId)} submitted ${x.sheet.number} ${x.sheet.title} for check.`, link(x.sheet), 60 * (3 + i * 20), i > 1));
    st.reviewQueue(st.user("u_sr")).slice(0, 3).forEach((x, i) => push("u_sr", "senior_qc", `Senior QC needed: ${x.sheet.number}`, `${x.sheet.number} ${x.sheet.title} passed the first check.`, link(x.sheet), 60 * (5 + i * 24)));
    // Document controller
    push("u_dc", "approved", "8 sheets are ready to issue on HSR Block B", "A-103, A-104, A-105, A-201, A-202, E-101, E-102, P-101 are approved for issue.", "#/projects/p1/issue", 60 * 20);
    const lastTr = S.transmittals.filter((t) => t.projectId === "p1").slice(-1)[0];
    if (lastTr) push("u_dc", "transmittal", `Email bounced on ${lastTr.number}`, `${st.contact(lastTr.recipients[1]?.contactId)?.name || "A recipient"} did not receive the link. Resend from the transmittal page.`, `#/projects/p1/transmittals/${lastTr.id}`, 60 * 50);
    // PL, owner, accounts
    push("u_pl", "late", "9 sheets late on HSR Block B (escalated)", "M-205 and others are past their planned date by more than 3 working days.", "#/projects/p1/register?flag=late", 120);
    push("u_pl", "comment", "Client comment overdue: 2026-014-CC-005", "Pressure cascade table for OT suites… has had no response for 9 days.", "#/projects/p1/comments", 60 * 3);
    push("u_pl", "allocation", "Rahul Kumar is at 132% this week", "Over-allocated (A-05 threshold 110%).", "#/workload", 60 * 9, true);
    ["u_acc", "u_owner", "u_pl"].forEach((uid) => push(uid, "ready_to_invoice", "Ready to invoice: 2026-014 stage 3 Approvals", "HSR Block B · Approvals · fee 15% = ₹48,00,000. Waiting 9 working days.", "#/billing", 60 * 24 * 13, uid !== "u_acc"));
    push("u_acc", "ready_to_invoice", "Ready to invoice: 2025-033 stage 7 Closure", "Electronic City Staff Housing · Closure · fee 5% = ₹6,00,000.", "#/billing", 60 * 24 * 4);
    push("u_owner", "owner_summary", "Weekly owner summary", "This morning's summary is in the demo mailbox.", "#/mailbox", 60 * 2);
    ["u_arj", "u_imr", "u_kav"].forEach((uid) => push(uid, "timesheet_missing", `Timesheet missing for week ${DO.isoWeek(DO.addDays(DO.mondayOf(T), -7))}`, "Please submit last week's hours. Due Tuesday 12:00.", "#/timesheets", 30));
    push("u_admin", "team", "1 invitation waiting to be accepted", "Rohit Bansal (rohit.bansal@firm.example) was invited yesterday.", "#/admin/users", 60 * 18);
    S.notifications.sort((a, b) => (a.at < b.at ? 1 : -1));
    // Mailbox: owner summary, a recent transmittal, the invitation.
    const p1 = st.project("p1"); const stats = st.projectStats(p1);
    const late = S.sheets.filter((s) => st.isLate(s)).length; const risk = S.sheets.filter((s) => st.isAtRisk(s)).length;
    st.sendEmail({ to: ["owner@firm.example"], toName: "Nikhil Prasad", subject: `Weekly summary · week ${DO.isoWeek(T)}: ${late} late, ${risk} at risk`, body: `Good morning Nikhil,\n\nAcross ${S.projects.filter((p) => p.state === "active").length} active projects: ${late} sheets are late and ${risk} at risk. HSR Block B has ${stats.late} late sheets; Rahul Kumar is at 132% this week. Two stages are ready to invoice (₹54,00,000), the oldest for 9 working days.\n\nOpen the portfolio for details.`, link: "#/portfolio", kind: "summary" });
    S.emails[0].at = back(60 * 2);
    if (lastTr) { const c = st.contact(lastTr.recipients[0].contactId); st.sendEmail({ to: [c.email], toName: c.name, subject: `${lastTr.number}: ${lastTr.items.length} drawings from ${S.org.name} (${st.purposeLabel(lastTr.purpose)})`, body: `Dear ${c.name},\n\nDeepa Chandra has issued ${lastTr.items.length} drawings for ${p1.code} ${p1.name}. Download them from the secure link below. The link is valid until ${DO.fmtDate(lastTr.expiresAt)}. Please acknowledge receipt on the page.`, link: `#/t/${lastTr.token}?r=${c.id}`, kind: "transmittal", transmittalId: lastTr.id }); S.emails[0].at = lastTr.sentAt; }
    const inv = S.invitations[0]; st.sendEmail({ to: [inv.email], toName: inv.name, subject: `You're invited to DrawingOps at ${S.org.name}`, body: `Hello ${inv.name.split(" ")[0]},\n\nAsha Menon invited you to DrawingOps. Accept the invitation to set up your account. You will see projects once a project lead adds you to a team.`, link: `#/invite/${inv.token}`, kind: "invite" }); S.emails[0].at = inv.sentAt;
    S.emails.sort((a, b) => (a.at < b.at ? 1 : -1));
    st.setActor(prev); st.commit();
  }

  // ---------- Start ----------
  function start() {
    applyTheme(readTheme());
    try { ui.state.comfortable = !!localStorage.getItem("drawingops-demo-density"); document.body.classList.toggle("comfortable", ui.state.comfortable); } catch (e) { /* */ }
    const t0 = performance.now(); st.load(); seedInbox();
    ui.state.loadMs = Math.round(performance.now() - t0);
    // Store changes re-render on the next tick, coalesced, so a render never runs inside a blur or change handler.
    let queued = false;
    st.subscribe(() => { ui.state.redrawPanel?.(); if (ui.state.batching || queued) return; queued = true; setTimeout(() => { queued = false; render(); }, 0); });
    window.addEventListener("hashchange", () => { ui.closeAll(); closePanel(); ui.state.navOpen = false; render(); });
    window.addEventListener("storage", (e) => { if (e.key === "drawingops-demo-state" && e.newValue === null) location.reload(); });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);

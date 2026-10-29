/* DrawingOps demo · public screens: sign-in (S-01) with demo credentials, simulated SSO, password reset,
   invitation acceptance, external transmittal page (S-15), site view (S-18) and the demo mailbox. */
(function (root) {
  "use strict";
  const DO = root.DO; const { html, raw, icon, C } = DO; const st = DO.store; const ui = DO.ui;
  const S = DO.screens = DO.screens || {};
  const logo = (size = 28) => html`<img src="assets/images/logo.svg" alt="" width="${size}" height="${size}">`;
  const f = () => (ui.state.signin = ui.state.signin || { email: "", password: "", remember: true, step: "password", error: "", reveal: false, busy: false, code: "" });

  S.signIn = (ctx) => {
    const s = f(); const u = DO.auth.current();
    if (u && s.step !== "totp") { setTimeout(() => DO.app.go(ctx.query.next || "/"), 0); return html``; }
    const accounts = DO.seed.DEMO_ACCOUNTS.map((a) => ({ ...a, user: st.user(a.id) })).filter((a) => a.user);
    const form = s.step === "totp"
      ? html`<form data-submit="signin-totp" class="stack" novalidate>
          <p class="flex items-center gap-2 muted">${icon("key-round", 16)}Enter the 6-digit code from your authenticator app.</p>
          ${C.field("Authentication code", html`<input id="si-code" name="code" class="input otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" autofocus value="${s.code}" aria-describedby="si-code-h">`, { for: "si-code" })}
          <p id="si-code-h" class="small muted">Demo code: <span class="mono strong">${DO.seed.ADMIN_TOTP}</span> (admins use TOTP; everyone else signs in with SSO).</p>
          <button class="btn primary block ${s.busy ? "busy" : ""}" ${s.busy ? raw("disabled") : ""}>${s.busy ? icon("loader-circle", 16, "spin") : ""}Verify</button>
          <button type="button" class="link small" data-act="signin-back">Back to sign in</button>
        </form>`
      : html`<a class="sso-btn" href="#/sso${ctx.query.next ? `?next=${encodeURIComponent(ctx.query.next)}` : ""}">${raw('<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>')}Sign in with Microsoft</a>
        <div class="divider">or use email and password</div>
        <form data-submit="signin" class="stack" novalidate>
          ${C.field("Email", html`<input id="si-email" name="email" type="email" class="input" autocomplete="username" required value="${s.email}" data-input="signin-field" ${s.error ? raw('aria-invalid="true"') : ""}>`, { for: "si-email" })}
          <div class="field"><div class="flex between items-baseline"><label for="si-pw">Password</label><a href="#/forgot" class="link small">Forgot password?</a></div>
            <div class="input-wrap"><input id="si-pw" name="password" type="${s.reveal ? "text" : "password"}" class="input" autocomplete="current-password" required value="${s.password}" data-input="signin-field" ${s.error ? raw('aria-invalid="true"') : ""}><button type="button" class="icon-btn reveal" data-act="signin-reveal" aria-label="${s.reveal ? "Hide password" : "Show password"}" aria-pressed="${s.reveal}">${icon(s.reveal ? "eye-off" : "eye", 16)}</button></div></div>
          <label class="check small"><input type="checkbox" name="remember" ${s.remember ? raw("checked") : ""} data-change="signin-remember"> Keep me signed in on this device</label>
          <button class="btn primary block ${s.busy ? "busy" : ""}" ${s.busy ? raw("disabled") : ""}>${s.busy ? icon("loader-circle", 16, "spin") : ""}${s.busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p class="small muted mt-4">No public sign-up: your admin creates accounts, or you sign in with the firm's Microsoft account. Have an invitation? <a class="link" href="#/mailbox">Open the demo mailbox</a>.</p>`;
    return html`<main id="main" class="auth-page grid-bg">
      <div class="auth-layout">
        <div class="auth-card">
          <div class="flex items-center gap-2 mb-1">${logo()}<h1 class="display">Sign in to DrawingOps</h1></div>
          <p class="muted mb-4">${st.S.org.name} · drawing and deliverable control</p>
          ${s.error ? html`<p role="alert" class="alert bad mb-4">${icon("circle-alert", 16)}<span>${s.error}</span></p>` : ""}
          ${ctx.query.msg ? html`<p role="status" class="alert ok mb-4">${icon("circle-check", 16)}<span>${ctx.query.msg}</span></p>` : ""}
          ${form}
        </div>
        <aside class="creds" aria-labelledby="creds-t">
          <div class="creds-head">${icon("key-round", 18, "primary-t")}<h2 id="creds-t" class="title">Demo Access — Use These Credentials</h2></div>
          <p class="small muted mb-3">Every account uses the password <span class="mono strong" style="color:var(--text)">${DO.seed.PASSWORD}</span>. Pick a role: the navigation, data and allowed actions change with it. Fictional people; nothing is sent anywhere.</p>
          <div class="cred-list">${accounts.map((a) => html`<div class="cred ${s.email === a.user.email ? "on" : ""}">
            <div class="min-w-0"><p class="who">${C.avatar(a.user.name)}${a.user.name}<span class="pill">${a.role}</span></p>
            <p class="cv mt-1">User ID: ${a.user.email}<br>Password: ${DO.seed.PASSWORD}${a.user.mfa ? html`<br>2FA code: ${DO.seed.ADMIN_TOTP}` : ""}</p><p class="small muted mt-1">${a.sees}</p></div>
            <div class="flex col gap-1"><button class="btn sm" data-act="cred-fill" data-email="${a.user.email}" aria-label="Fill the form with ${a.user.name}'s credentials">${icon("pencil", 14)}Fill</button><button class="btn sm primary" data-act="cred-go" data-email="${a.user.email}" aria-label="Sign in as ${a.user.name}">${icon("log-out", 14)}Sign in</button></div>
          </div>`)}</div>
          <div class="flex wrap gap-2 mt-3"><a class="btn sm ghost" href="#/mailbox">${icon("inbox", 14)}Demo mailbox</a><button class="btn sm ghost" data-act="demo-reset-public">${icon("rotate-ccw", 14)}Reset demo data</button></div>
        </aside>
      </div>
    </main>`;
  };
  ui.on("signin-field", (el) => { f()[el.name] = el.value; });
  ui.on("signin-remember", (el) => { f().remember = el.checked; });
  ui.on("signin-reveal", () => { const s = f(); s.email = document.getElementById("si-email")?.value ?? s.email; s.password = document.getElementById("si-pw")?.value ?? s.password; s.reveal = !s.reveal; DO.app.render(); document.getElementById("si-pw")?.focus(); });
  ui.on("signin-back", () => { Object.assign(f(), { step: "password", error: "", code: "" }); DO.app.render(); });
  ui.on("cred-fill", (el) => { Object.assign(f(), { email: el.dataset.email, password: DO.seed.PASSWORD, error: "" }); DO.app.render(); document.getElementById("si-pw")?.focus(); ui.toast({ title: "Credentials filled", description: "Press Sign in." }); });
  ui.on("cred-go", (el) => { Object.assign(f(), { email: el.dataset.email, password: DO.seed.PASSWORD, error: "" }); doSignIn(); });
  ui.on("signin", (form, data) => { Object.assign(f(), { email: data.email, password: data.password, remember: !!data.remember }); doSignIn(); });
  function doSignIn() {
    const s = f(); s.busy = true; s.error = ""; DO.app.render();
    setTimeout(() => {
      const r = DO.auth.signIn(s.email, s.password, s.remember); s.busy = false;
      if (!r.ok) { s.error = r.error; DO.app.render(); document.getElementById("si-email")?.focus(); return; }
      if (r.step === "totp") { s.step = "totp"; DO.app.render(); return; }
      finish();
    }, 550);
  }
  ui.on("signin-totp", (form, data) => {
    const s = f(); s.code = data.code; s.busy = true; DO.app.render();
    setTimeout(() => { const r = DO.auth.verifyTotp(data.code); s.busy = false; if (!r.ok) { s.error = r.error; DO.app.render(); return; } finish(); }, 450);
  });
  function finish() {
    const next = DO.app.parseHash().query.next; const u = DO.auth.current();
    ui.state.signin = null;
    ui.toast({ title: `Welcome, ${u.name.split(" ")[0]}`, description: `Signed in as ${u.title}.`, tone: "ok" });
    DO.app.go(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }
  ui.on("demo-reset-public", () => DO.app.resetDemo());

  // Simulated Microsoft account picker (F-40, I-11).
  S.sso = (ctx) => {
    const users = st.S.users.filter((u) => u.active && u.sso);
    return html`<main id="main" class="auth-page grid-bg"><div class="auth-card" style="width:440px;max-width:100%">
      <div class="flex items-center gap-2 mb-2">${raw('<svg width="22" height="22" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>')}<h1 class="title">Pick an account</h1></div>
      <p class="alert info mb-3">${icon("info", 16)}<span>Simulated single sign-on for the demo: no Microsoft service is contacted. In the product, people sign in with their firm account and no new password.</span></p>
      <p class="small muted mb-2">to continue to DrawingOps · tenant ${C.mono(st.S.org.sso.tenant)}</p>
      <div class="card scroll-y" style="max-height:420px">${users.map((u) => html`<button class="list-row w-full" style="text-align:left" data-act="sso-pick" data-id="${u.id}">${C.avatar(u.name)}<span class="grow min-w-0"><span class="strong">${u.name}</span><span class="small muted block trunc">${u.email}</span></span>${icon("chevron-right", 16)}</button>`)}</div>
      <p class="small muted mt-3">Admins use a local account with 2FA. <a class="link" href="#/sign-in">Back to sign in</a></p>
    </div></main>`;
  };
  ui.on("sso-pick", (el) => { const r = DO.auth.ssoSignIn(el.dataset.id); if (!r.ok) { ui.toast({ title: "Single sign-on did not complete", description: r.error, tone: "bad" }); return; } finish(); });

  S.forgot = (ctx) => {
    const sent = ui.state.forgotSent;
    return html`<main id="main" class="auth-page grid-bg"><div class="auth-card" style="width:440px;max-width:100%">
      <div class="flex items-center gap-2 mb-2">${logo(24)}<h1 class="title">Reset your password</h1></div>
      ${sent ? html`<p class="alert ok mb-4" role="status">${icon("mail-check", 16)}<span>If ${sent} has an account, a 6-digit code is on its way. In this demo it lands in the demo mailbox.</span></p><div class="flex gap-2 wrap"><a class="btn primary" href="#/mailbox">${icon("inbox", 16)}Open demo mailbox</a><a class="btn" href="#/reset?email=${encodeURIComponent(sent)}">I have a code</a></div>`
        : html`<p class="muted mb-4">Local accounts only. If you sign in with Microsoft, reset your password there.</p><form data-submit="forgot" class="stack" novalidate>${C.field("Email", html`<input id="fg-email" name="email" type="email" class="input" required autofocus autocomplete="username" value="${f().email}">`, { for: "fg-email" })}<button class="btn primary block">Send reset code</button></form>`}
      <p class="small mt-4"><a class="link" href="#/sign-in">Back to sign in</a></p></div></main>`;
  };
  ui.on("forgot", (form, data) => { if (!/^\S+@\S+\.\S+$/.test(data.email)) { ui.toast({ title: "Enter a valid email address", tone: "bad" }); return; } DO.auth.requestReset(data.email); ui.state.forgotSent = data.email; DO.app.render(); });

  S.reset = (ctx) => {
    const err = ui.state.resetError;
    return html`<main id="main" class="auth-page grid-bg"><div class="auth-card" style="width:440px;max-width:100%">
      <div class="flex items-center gap-2 mb-2">${logo(24)}<h1 class="title">Choose a new password</h1></div>
      ${err ? html`<p role="alert" class="alert bad mb-3">${icon("circle-alert", 16)}<span>${err}</span></p>` : ""}
      <form data-submit="reset" class="stack" novalidate>
        ${C.field("Email", html`<input id="rs-e" name="email" type="email" class="input" required value="${ctx.query.email || ""}">`, { for: "rs-e" })}
        ${C.field("6-digit code from the email", html`<input id="rs-c" name="code" class="input otp" inputmode="numeric" maxlength="6" required autofocus>`, { for: "rs-c", hint: "Find it in the demo mailbox." })}
        ${C.field("New password", html`<input id="rs-p" name="pw" type="password" class="input" required autocomplete="new-password">`, { for: "rs-p", hint: "At least 10 characters with letters and a number." })}
        ${C.field("Repeat new password", html`<input id="rs-p2" name="pw2" type="password" class="input" required autocomplete="new-password">`, { for: "rs-p2" })}
        <button class="btn primary block">Set new password</button>
      </form>
      <p class="small mt-4"><a class="link" href="#/mailbox">Open demo mailbox</a> · <a class="link" href="#/sign-in">Back to sign in</a></p></div></main>`;
  };
  ui.on("reset", (form, data) => {
    if (data.pw !== data.pw2) { ui.state.resetError = "The two passwords do not match."; DO.app.render(); return; }
    const r = DO.auth.resetPassword(data.email, data.code, data.pw);
    if (!r.ok) { ui.state.resetError = r.error; DO.app.render(); return; }
    ui.state.resetError = null; Object.assign(f(), { email: data.email, password: "" });
    DO.app.go(`/sign-in?msg=${encodeURIComponent("Password changed. Sign in with your new password.")}`);
  });

  S.invite = (ctx) => {
    const inv = st.S.invitations.find((i) => i.token === ctx.params.token);
    const err = ui.state.inviteError;
    if (!inv || inv.accepted) return html`<main id="main" class="auth-page grid-bg"><div class="auth-card" style="width:440px;max-width:100%"><h1 class="title mb-2">This invitation is no longer valid</h1><p class="muted">It was already accepted or withdrawn. Ask your admin (${st.userName("u_admin")}) to send a new one.</p><p class="mt-4"><a class="btn" href="#/sign-in">Go to sign in</a></p></div></main>`;
    return html`<main id="main" class="auth-page grid-bg"><div class="auth-card" style="width:460px;max-width:100%">
      <div class="flex items-center gap-2 mb-2">${logo(24)}<h1 class="title">Join ${st.S.org.name} on DrawingOps</h1></div>
      <p class="muted mb-3">${st.userName(inv.by)} invited <strong>${inv.email}</strong> as ${inv.orgRole === "staff" ? "staff" : inv.orgRole}${inv.discipline ? ` (${st.disc(inv.discipline)?.name})` : ""}. You will see projects once a project lead adds you to a team.</p>
      ${err ? html`<p role="alert" class="alert bad mb-3">${icon("circle-alert", 16)}<span>${err}</span></p>` : ""}
      <form data-submit="invite-accept" class="stack" novalidate><input type="hidden" name="token" value="${inv.token}">
        ${C.field("Full name", html`<input id="iv-n" name="name" class="input" required autofocus value="${inv.name}">`, { for: "iv-n" })}
        ${C.field("Password", html`<input id="iv-p" name="pw" type="password" class="input" required autocomplete="new-password">`, { for: "iv-p", hint: "At least 10 characters with letters and a number. With Microsoft SSO configured, you can skip this and sign in with your firm account." })}
        <button class="btn primary block">Create my account</button></form></div></main>`;
  };
  ui.on("invite-accept", (form, data) => {
    const r = DO.auth.acceptInvite(data.token, data.name, data.pw);
    if (!r.ok) { ui.state.inviteError = r.error; DO.app.render(); return; }
    ui.state.inviteError = null; Object.assign(f(), { email: r.email, password: data.pw });
    DO.app.go(`/sign-in?msg=${encodeURIComponent("Account created. Sign in to continue.")}`);
  });

  // ---------- S-15 External transmittal page (no login) ----------
  S.extTransmittal = (ctx) => {
    const tm = st.S.transmittals.find((t) => t.token === ctx.params.token);
    const org = st.S.org;
    const shell = (inner) => html`<main id="main" class="ext-page"><header class="flex between items-center wrap gap-3 mb-4"><div class="flex items-center gap-2">${logo(32)}<div><p class="strong">${org.name}</p><p class="small muted">${org.address}</p></div></div><span class="pill">${icon("lock", 12)}Secure link · no sign-in needed</span></header>${inner}<p class="small muted mt-6">Delivered by DrawingOps (demo, fictional data). <a class="link" href="#/mailbox">Back to the demo mailbox</a></p></main>`;
    if (!tm) return shell(C.card({ body: C.empty("This link does not exist. Check the address in your email.") }));
    const p = st.project(tm.projectId);
    if (tm.expiresAt < DO.today()) return shell(C.card({ title: "This link has expired", body: html`<div class="card-body"><p>The download link for ${C.mono(tm.number)} expired on ${DO.fmtDate(tm.expiresAt)}.</p><p class="mt-2">Contact ${st.userName(tm.sentBy)} at ${st.user(tm.sentBy)?.email} for a new link, or ask for the current set on the project's site view.</p></div>` }));
    const rc = tm.recipients.find((r) => r.contactId === ctx.query.r) || tm.recipients.find((r) => r.delivery === "email");
    const c = rc ? st.contact(rc.contactId) : null;
    const rows = tm.items.map((it) => ({ s: st.sheet(it.sheetId), v: st.revision(it.revisionId) })).filter((x) => x.s && x.v);
    return shell(html`
      <div class="card"><div class="card-body">
        <p class="small muted">Drawing transmittal</p>
        <h1 class="display mono" style="white-space:normal">${tm.number}</h1>
        <dl class="kv mt-3"><dt>Project</dt><dd>${p.code} ${p.name}</dd><dt>Purpose</dt><dd>${st.purposeLabel(tm.purpose)}</dd><dt>Sent by</dt><dd>${st.userName(tm.sentBy)} on ${DO.fmtDateTime(tm.sentAt)}</dd><dt>For</dt><dd>${c ? `${c.name}, ${c.org}` : "—"}</dd><dt>Link valid until</dt><dd>${DO.fmtDate(tm.expiresAt)}</dd>${tm.note ? html`<dt>Note</dt><dd>${tm.note}</dd>` : ""}</dl>
        <div class="flex wrap gap-2 mt-4">
          ${C.btn(`Download all (ZIP, ${rows.length} files)`, { variant: "primary", icon: "download", act: "ext-zip", data: { t: tm.id, r: rc?.contactId || "" } })}
          ${C.btn("Cover sheet (PDF)", { icon: "file-text", act: "ext-cover", data: { t: tm.id } })}
          ${rc ? (rc.ackAt ? html`<span class="pill ok">${icon("circle-check", 14)}Receipt acknowledged ${DO.fmtDateTime(rc.ackAt)}</span>` : C.btn("Acknowledge receipt", { icon: "badge-check", act: "ext-ack", data: { t: tm.id, r: rc.contactId } })) : ""}
        </div>
      </div></div>
      <div class="card mt-4"><div class="card-head"><h2>Drawings (${rows.length})</h2></div><div class="t-wrap"><table class="t"><thead><tr><th>Sheet</th><th>Title</th><th>Revision</th><th class="right">File</th></tr></thead><tbody>
        ${rows.map(({ s, v }) => html`<tr><td>${C.mono(s.number)}</td><td>${s.title}${v.state === "superseded" ? html`<p class="small" style="color:var(--flag-late-fg)">${icon("archive", 12)} Superseded on ${DO.fmtDate(v.supersededAt)}: a newer revision exists. Downloads are watermarked.</p>` : ""}</td><td>${v.state === "superseded" ? html`<span class="mono strike">${v.code}</span>` : C.mono(v.code)}</td><td class="right">${C.btn("Download", { size: "sm", icon: "download", act: "ext-dl", data: { v: v.id, t: tm.id, r: rc?.contactId || "" } })}</td></tr>`)}
      </tbody></table></div></div>`);
  };
  function logDownload(tm, rcId) { const rc = tm.recipients.find((r) => r.contactId === rcId); if (rc && !rc.downloadedAt) { rc.downloadedAt = new Date().toISOString(); st.audit("transmittal", tm.id, "download", null, { contact: rcId }, { projectId: tm.projectId, text: `${st.contact(rcId)?.name} downloaded drawings from ${tm.number}` }); st.commit(); } }
  ui.on("ext-dl", (el) => { const v = st.revision(el.dataset.v); C.downloadRevision(v); logDownload(st.transmittal(el.dataset.t), el.dataset.r); });
  ui.on("ext-zip", (el) => {
    const tm = st.transmittal(el.dataset.t);
    const filesList = tm.items.map((it) => { const v = st.revision(it.revisionId); const s = st.sheet(it.sheetId); return { name: v.state === "superseded" ? `${s.number}_${v.code}_SUPERSEDED.pdf` : `${s.number}_${v.code}.pdf`, data: C.revisionPdf(v, { watermark: true }) }; });
    filesList.push({ name: `${tm.number}_cover.pdf`, data: coverBytes(tm) });
    DO.download(new Blob([DO.zip.zip(filesList)], { type: "application/zip" }), `${tm.number}.zip`);
    logDownload(tm, el.dataset.r); ui.toast({ title: `${tm.number}.zip downloaded`, description: `${filesList.length} files including the cover sheet.`, tone: "ok" });
  });
  ui.on("ext-cover", (el) => { const tm = st.transmittal(el.dataset.t); DO.download(new Blob([coverBytes(tm)], { type: "application/pdf" }), `${tm.number}_cover.pdf`); });
  ui.on("ext-ack", (el) => { const tm = st.transmittal(el.dataset.t); const rc = tm.recipients.find((r) => r.contactId === el.dataset.r); rc.ackAt = new Date().toISOString(); const p = st.project(tm.projectId); st.audit("transmittal", tm.id, "acknowledged", null, { contact: rc.contactId }, { projectId: p.id, text: `${st.contact(rc.contactId).name} acknowledged ${tm.number}` }); st.notify([tm.sentBy, p.leadId], "acknowledged", `${st.contact(rc.contactId).name} acknowledged ${tm.number}`, `${p.code} · ${tm.items.length} drawings`, `#/projects/${p.id}/transmittals/${tm.id}`, { self: true }); st.commit(); ui.toast({ title: "Receipt acknowledged", description: "The sender can see the time on the transmittal.", tone: "ok" }); });
  function coverBytes(tm) {
    const p = st.project(tm.projectId);
    return DO.drawing.coverPdf({ firm: st.S.org, project: { code: p.code, name: p.name, client: p.client }, number: tm.number, sentAt: tm.sentAt, purposeLabel: st.purposeLabel(tm.purpose), sender: st.userName(tm.sentBy), note: tm.note, refersTo: tm.refersTo ? st.transmittal(tm.refersTo)?.number : null, expiresAt: tm.expiresAt, recipients: tm.recipients.map((r) => ({ name: st.contact(r.contactId)?.name, org: st.contact(r.contactId)?.org, delivery: r.delivery })), items: tm.items.map((it) => { const s = st.sheet(it.sheetId); const v = st.revision(it.revisionId); return { number: s.number, title: s.title, rev: v.code, purposeShort: tm.purpose }; }) });
  }
  DO.coverBytes = coverBytes;

  // ---------- S-18 Site view: current issued set, phone first ----------
  S.siteView = (ctx) => {
    const p = st.S.projects.find((x) => x.siteToken === ctx.params.token);
    if (!p) return html`<main id="main" class="site">${C.card({ body: C.empty("This site link is not valid. Ask the project lead for a new one.") })}</main>`;
    const q = (ui.state.siteQ || "").toLowerCase();
    const list = st.sheetsOf(p.id).filter((s) => s.currentRevId && st.revision(s.currentRevId)?.state === "issued").filter((s) => !q || s.number.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)).sort(DO.by("number"));
    return html`<main id="main" class="site">
      <header class="flex items-center gap-2 mb-3">${logo(28)}<div class="min-w-0"><p class="strong trunc">${p.code} ${p.name}</p><p class="small muted">Current issued set · ${DO.fmtDateTime(new Date())}</p></div></header>
      <p class="alert info mb-3">${icon("shield-check", 16)}<span>Only current revisions are listed. Superseded drawings are hidden so nobody builds from an old sheet.</span></p>
      <div class="search-box mb-3">${icon("search", 16)}<input id="site-q" class="input" style="height:44px" placeholder="Search sheet number or title" value="${ui.state.siteQ || ""}" data-input="site-q" aria-label="Search sheets"></div>
      <div class="card">${list.length ? list.map((s) => { const v = st.revision(s.currentRevId); return html`<div class="site-row"><div class="min-w-0"><p><span class="mono strong">${s.number}</span> · ${C.mono(v.code)}</p><p class="small muted trunc">${s.title}</p><p class="small muted">${st.purposeLabel(v.purpose)} · ${DO.fmtDate(v.issuedAt)}</p></div><button class="btn" data-act="site-open" data-v="${v.id}" aria-label="Open ${s.number}">${icon("eye", 18)}</button><button class="btn" data-act="site-dl" data-v="${v.id}" aria-label="Download ${s.number}">${icon("download", 18)}</button></div>`; }) : C.empty("No issued sheets match.")}</div>
      <p class="small muted mt-4">${list.length} sheets · DrawingOps demo (fictional data)</p></main>`;
  };
  ui.on("site-q", (el) => { ui.state.siteQ = el.value; DO.app.render(); });
  ui.on("site-dl", (el) => C.downloadRevision(st.revision(el.dataset.v)));
  ui.on("site-open", (el) => { const w = window.open(C.revisionUrl(st.revision(el.dataset.v)), "_blank"); if (!w) C.downloadRevision(st.revision(el.dataset.v)); });

  // ---------- Demo mailbox (stands in for Mailpit; no real email is ever sent) ----------
  S.mailbox = (ctx) => {
    const all = st.S.emails; const filter = ui.state.mailFilter || "";
    const list = all.filter((m) => !filter || (m.to || []).includes(filter));
    const sel = list.find((m) => m.id === ctx.query.m) || list[0];
    if (sel && !sel.read) { sel.read = true; st.save(); }
    const recips = [...new Set(all.flatMap((m) => m.to || []))].sort();
    const u = DO.auth.current();
    return html`<main id="main" class="main" style="max-width:1200px;margin:0 auto">
      ${C.pageHead({ title: "Demo mailbox", meta: html`Every email DrawingOps would send lands here instead: transmittals, notifications, password resets, invitations. ${all.length} messages.`, actions: html`${u ? C.linkBtn("Back to the app", "#/", { icon: "arrow-left" }) : C.linkBtn("Back to sign in", "#/sign-in", { icon: "arrow-left" })}${C.btn("Mark all read", { act: "mail-read-all" })}` })}
      <div class="card"><div class="mail-layout">
        <div style="border-right:1px solid var(--border)"><div class="p-3" style="border-bottom:1px solid var(--border)">${C.select({ options: [["", "All recipients"], ...recips.map((r) => [r, r])], value: filter, change: "mail-filter", aria: "Filter by recipient" })}</div>
          <div class="scroll-y" style="max-height:640px">${list.length ? list.map((m) => html`<a href="#/mailbox?m=${m.id}" class="mail-item ${sel && m.id === sel.id ? "on" : ""}"><span class="flex between gap-2"><span class="small muted trunc">${m.toName || m.to?.[0]}</span><span class="small muted nowrap">${DO.fmtRel(m.at)}</span></span><span class="block trunc ${m.read ? "" : "strong"}">${m.subject}</span><span class="small muted">${{ transmittal: "Transmittal", notification: "Notification", reset: "Password reset", invite: "Invitation", summary: "Weekly summary", new_revision: "New revision (A-03)", export: "Export ready", digest: "Daily digest" }[m.kind] || "Email"}</span></a>`) : C.empty("No email yet. Issue a transmittal or request a password reset to see one arrive.")}</div></div>
        <div class="p-4">${sel ? html`<div class="email-frame"><p class="small muted">From ${sel.from}</p><p class="small muted">To ${sel.toName ? `${sel.toName} <${sel.to.join(", ")}>` : (sel.to || []).join(", ")} · ${DO.fmtDateTime(sel.at)}</p><h2 class="title mt-2 mb-3">${sel.subject}</h2><div class="flex items-center gap-2 mb-4" style="padding-bottom:12px;border-bottom:1px solid var(--border)">${logo(24)}<span class="strong">${st.S.org.name}</span></div><p class="pre">${sel.body}</p>${sel.code ? html`<p class="mt-3 mono" style="font-size:24px;letter-spacing:.3em">${sel.code}</p>` : ""}${sel.link ? html`<p class="mt-4"><a class="btn primary" href="${sel.link}">${sel.kind === "transmittal" ? "Open drawings" : sel.kind === "invite" ? "Accept invitation" : sel.kind === "reset" ? "Enter the code" : sel.kind === "new_revision" ? "Open the current set" : "Open in DrawingOps"}</a></p>` : ""}<p class="small muted mt-6">Demo only: this message was not sent. In production it goes through the firm's SMTP relay (I-12).</p></div>` : C.empty("Select a message.")}</div>
      </div></div></main>`;
  };
  ui.on("mail-filter", (el) => { ui.state.mailFilter = el.value; DO.app.go("/mailbox"); DO.app.render(); });
  ui.on("mail-read-all", () => { st.S.emails.forEach((m) => { m.read = true; }); st.commit(); });
})(window);

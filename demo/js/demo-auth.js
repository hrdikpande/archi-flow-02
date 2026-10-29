/* DrawingOps demo · simulated sign-in (S-01, F-40). This is NOT security: it only lets a client try
   each role. The product uses SSO with Microsoft 365 or Google, local accounts with TOTP for admins,
   and admin-created accounts (no public sign-up). */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const SKEY = "drawingops-demo-session";
  const st = () => DO.store.S;

  function passwordOf(u) { return (st().passwords || {})[u.id] || DO.seed.PASSWORD; }
  function findByEmail(email) { return st().users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase()); }

  function readSession() {
    try { const raw = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); return raw ? JSON.parse(raw) : null; } catch (e) { return DO.auth._mem || null; }
  }
  function writeSession(s, remember) {
    DO.auth._mem = s;
    try { sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); if (s) (remember ? localStorage : sessionStorage).setItem(SKEY, JSON.stringify(s)); } catch (e) { /* memory only */ }
  }
  function current() {
    const s = readSession(); if (!s) return null;
    const u = DO.store.user(s.userId);
    if (!u || !u.active) { writeSession(null); return null; }
    return u;
  }

  /** Step 1: email + password. Returns { ok, step: "done" | "totp", error }. */
  function signIn(email, password, remember) {
    const u = findByEmail(email);
    if (!email || !password) return { ok: false, error: "Enter your email and password." };
    if (!u || password !== passwordOf(u)) return { ok: false, error: "Email or password is not correct. Use one of the demo accounts on the right." };
    if (!u.active) return { ok: false, error: "This account is deactivated. Ask your admin to reactivate it." };
    if (u.mfa) { DO.auth._pending = { userId: u.id, remember }; return { ok: true, step: "totp" }; }
    complete(u, remember, "password");
    return { ok: true, step: "done" };
  }
  function verifyTotp(code) {
    const p = DO.auth._pending; if (!p) return { ok: false, error: "Start again from the sign-in form." };
    if (String(code).replace(/\s/g, "") !== DO.seed.ADMIN_TOTP) return { ok: false, error: "That code did not work. Enter the current 6-digit code (demo code 246810)." };
    const u = DO.store.user(p.userId); DO.auth._pending = null; complete(u, p.remember, "password + TOTP"); return { ok: true };
  }
  function ssoSignIn(userId) {
    const u = DO.store.user(userId);
    if (!u || !u.active) return { ok: false, error: "Single sign-on did not complete. Use your firm account, or ask IT to add you." };
    if (!u.sso) return { ok: false, error: `${u.name} uses a local account with 2FA. Use email and password.` };
    complete(u, true, "Microsoft 365 SSO (simulated)"); return { ok: true };
  }
  function complete(u, remember, method) {
    writeSession({ userId: u.id, at: new Date().toISOString(), method }, remember);
    u.lastSeen = new Date().toISOString();
    DO.store.setActor(u.id);
    DO.store.audit("user", u.id, "sign_in", null, { method }, { text: `${u.name} signed in (${method})` });
    DO.store.commit();
  }
  function signOut() {
    const u = current();
    if (u) { DO.store.audit("user", u.id, "sign_out", null, null, { text: `${u.name} signed out` }); DO.store.commit(); }
    writeSession(null); DO.store.setActor(null);
  }

  /** Forgot password: a 6-digit code goes to the demo mailbox (no real email). */
  function requestReset(email) {
    const u = findByEmail(email);
    // Same message whether or not the account exists (no account enumeration).
    if (u) {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      st().resets = st().resets || {}; st().resets[u.id] = { code, until: Date.now() + 15 * 60000 };
      DO.store.sendEmail({ to: [u.email], toName: u.name, subject: "Reset your DrawingOps password", body: `Hello ${u.name.split(" ")[0]},\n\nUse this code to reset your password: ${code}\n\nIt expires in 15 minutes. If you did not ask for this, ignore this email.`, link: `#/reset?email=${encodeURIComponent(u.email)}`, kind: "reset", code });
      DO.store.commit();
    }
    return { ok: true };
  }
  function resetPassword(email, code, pw) {
    const u = findByEmail(email); const r = u && (st().resets || {})[u.id];
    if (!u || !r || r.code !== String(code).trim() || r.until < Date.now()) return { ok: false, error: "That code is not valid or has expired. Request a new one." };
    const err = passwordProblem(pw); if (err) return { ok: false, error: err };
    st().passwords = st().passwords || {}; st().passwords[u.id] = pw; delete st().resets[u.id];
    DO.store.audit("user", u.id, "password_reset", null, null, { text: `${u.name} reset their password` }); DO.store.commit();
    return { ok: true };
  }
  function passwordProblem(pw) {
    if (!pw || pw.length < 10) return "Use at least 10 characters.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
    return "";
  }
  /** Invitations (admin-created accounts): accepting creates the user with no project access. */
  function acceptInvite(token, name, pw) {
    const inv = st().invitations.find((i) => i.token === token);
    if (!inv || inv.accepted) return { ok: false, error: "This invitation link is no longer valid. Ask your admin to send a new one." };
    if (!name || name.trim().split(/\s+/).length < 2) return { ok: false, error: "Enter your first and last name." };
    const err = passwordProblem(pw); if (err) return { ok: false, error: err };
    const id = `u_${Math.random().toString(36).slice(2, 8)}`;
    st().users.push({ id, name: name.trim(), email: inv.email, orgRole: inv.orgRole, discipline: inv.discipline || "", title: inv.title || "Architect", capacity: st().org.defaultCapacity, active: true, canLead: false, sso: true, mfa: inv.orgRole === "admin", lastSeen: null, prefs: {}, delegate: null });
    st().passwords = st().passwords || {}; st().passwords[id] = pw; inv.accepted = true; inv.acceptedAt = new Date().toISOString();
    DO.store.audit("user", id, "created", null, { email: inv.email, orgRole: inv.orgRole }, { text: `${name.trim()} accepted the invitation (${inv.email}); no project access until a lead adds them` });
    DO.store.commit();
    return { ok: true, email: inv.email };
  }

  DO.auth = { current, signIn, verifyTotp, ssoSignIn, signOut, requestReset, resetPassword, acceptInvite, passwordProblem, findByEmail, passwordOf, _pending: null, _mem: null };
})(typeof window !== "undefined" ? window : globalThis);

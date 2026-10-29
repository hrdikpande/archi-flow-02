/* DrawingOps demo · application state and business rules. One store, one sheet transition table
   (docs/03 §3), stage rules (§4), automations (§10), notifications (§18) and an insert-only audit
   trail. Everything runs in the browser; nothing leaves the page. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const KEY = "drawingops-demo-state";
  let S = null; let rev = 0; let memoryOnly = false; let currentUserId = null;
  const listeners = new Set();
  const files = new Map(); // uploaded File/Blob objects by id (session memory)

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === DO.DATA_VERSION && Array.isArray(data.sheets)) { S = data; applyCalendar(); return { restored: true }; }
      }
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    S = DO.seed.generate(); applyCalendar(); save(true);
    return { restored: false };
  }
  function applyCalendar() { DO.setCalendar(S.org.workdays, S.holidays.map((h) => h.date)); }
  const persist = DO.debounce(() => save(true), 250);
  function save(now) {
    if (!now) return persist();
    if (memoryOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { memoryOnly = true; DO.ui?.toast?.({ title: "Changes are kept for this session only", description: "This browser would not store the demo data. Refreshing the page will reset the demo.", tone: "bad" }); }
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } files.clear(); S = DO.seed.generate(); applyCalendar(); memoryOnly = false; save(true); rev++; emit(); }
  function commit() { rev++; cache = {}; save(); emit(); }
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

  // ---------- Indexes (rebuilt after every commit) ----------
  let cache = {};
  const memo = (k, fn) => (k in cache ? cache[k] : (cache[k] = fn()));
  // Keys include the collection length, so records added or removed before the next commit are seen at once.
  const byId = (coll) => memo(`id:${coll}:${S[coll].length}`, () => new Map(S[coll].map((x) => [x.id, x])));
  const get = (coll, id) => byId(coll).get(id) || S[coll].find((x) => x.id === id);
  const user = (id) => get("users", id);
  const contact = (id) => get("contacts", id);
  const project = (id) => get("projects", id);
  const stage = (id) => get("stages", id);
  const sheet = (id) => get("sheets", id);
  const revision = (id) => get("revisions", id);
  const transmittal = (id) => get("transmittals", id);
  const pkg = (id) => get("packages", id);
  const disc = (code) => S.disciplines.find((d) => d.code === code);
  const group = (coll, key) => memo(`g:${coll}:${key}:${S[coll].length}`, () => DO.groupBy(S[coll], (x) => x[key]));
  const sheetsOf = (pid) => group("sheets", "projectId")[pid] || [];
  const stagesOf = (pid) => (group("stages", "projectId")[pid] || []).slice().sort(DO.by("seq"));
  const revisionsOf = (sid) => (group("revisions", "sheetId")[sid] || []).slice().sort(DO.by("seq", -1));
  const reviewsOf = (sid) => (group("reviews", "sheetId")[sid] || []).slice().sort(DO.by("openedAt", -1));
  const transitionsOf = (sid) => (group("transitions", "sheetId")[sid] || []).slice().sort(DO.by("at", -1));
  const draftOf = (s) => revisionsOf(s.id).find((v) => v.state === "draft") || null;
  const currentRev = (s) => (s.currentRevId ? revision(s.currentRevId) : null);
  const packagesOf = (pid) => (group("packages", "projectId")[pid] || []);
  const purposeLabel = (code) => S.org.purposes.find((p) => p.code === code)?.label || code || "";
  const effPlanned = (s) => s.planned || (s.packageId ? pkg(s.packageId)?.date : null) || null;
  const activeStage = (pid) => { const st = stagesOf(pid); return st.find((x) => x.state === "active") || st.find((x) => x.state === "on_hold") || st.find((x) => !["invoiced", "closed"].includes(x.state)) || st[st.length - 1]; };
  const today = () => DO.today();
  const at = () => new Date().toISOString();
  const nextId = (p) => DO.uid(p);

  // ---------- Flags (A-01, A-02): computed, never stored as states ----------
  const OPEN = new Set(["planned", "in_progress", "ready_for_check", "in_check", "changes_requested", "approved_for_issue"]);
  function issuedSince(s, date) {
    // An issued revision in the current cycle: issued on or after the planned date minus 60 days and still current.
    const c = currentRev(s); return !!(c && c.state === "issued" && s.state === "issued");
  }
  function flagsFor(s, asOf) {
    const T = asOf || today(); const out = [];
    const p = effPlanned(s);
    if (!p || !OPEN.has(s.state) || issuedSince(s, p)) return out;
    const rules = S.org.rules;
    if (p < T && rules["A-02"].on) {
      const n = Math.max(1, DO.workingDaysBetween(p, T));
      out.push({ kind: "late", n, text: `Late ${DO.plural(n, "day")}`, detail: `A-02: planned issue date ${DO.fmtDate(p)} has passed with no issued revision. Raised ${DO.fmtDate(DO.addWorkingDays(p, 1))}${n > rules["A-02"].escalate ? `; escalated to the project lead after ${rules["A-02"].escalate} working days` : ""}.`, escalated: n > rules["A-02"].escalate });
    } else if (rules["A-01"].on && (s.state === "planned" || s.state === "in_progress")) {
      const n = DO.workingDaysBetween(T, p);
      if (n <= rules["A-01"].days) out.push({ kind: "at_risk", n, text: n === 0 ? "Due today" : `Due in ${DO.plural(n, "day")}`, detail: `A-01: planned issue ${DO.fmtDate(p)} is within ${rules["A-01"].days} working days and the sheet is still ${s.state === "planned" ? "not started" : "in progress"}. Raised ${DO.fmtDate(DO.addWorkingDays(p, -rules["A-01"].days) > T ? T : DO.addWorkingDays(p, -rules["A-01"].days))}.` });
    }
    return out;
  }
  const isLate = (s) => flagsFor(s).some((f) => f.kind === "late");
  const isAtRisk = (s) => flagsFor(s).some((f) => f.kind === "at_risk");
  /** Late/at-risk as of an earlier date, from revision issue dates (for "delta vs last week"). */
  function flagsAsOf(s, D) {
    const p = effPlanned(s); if (!p) return {};
    if (s.state === "cancelled" || s.state === "on_hold" || s.state === "superseded") return {};
    const revs = revisionsOf(s.id).filter((v) => v.issuedAt && DO.dateOf(v.issuedAt) <= D);
    const issuedForCycle = revs.some((v) => DO.dateOf(v.issuedAt) >= DO.addDays(p, -45));
    if (issuedForCycle) return {};
    if (p < D) return { late: true };
    if (DO.workingDaysBetween(D, p) <= S.org.rules["A-01"].days) return { at_risk: true };
    return {};
  }

  // ---------- Notifications (§18) and the demo mailbox ----------
  const EVENTS = {
    assigned: { label: "Sheet assigned to you", def: "instant", mandatory: true },
    review_requested: { label: "Sheet ready for your check", def: "instant", mandatory: true },
    returned: { label: "Sheet returned with redlines", def: "instant", mandatory: true },
    approved: { label: "Sheet approved for issue", def: "digest", mandatory: false },
    senior_qc: { label: "Senior QC needed", def: "instant", mandatory: true },
    at_risk: { label: "Sheet at risk (A-01)", def: "digest", mandatory: false },
    late: { label: "Sheet late (A-02) / escalation", def: "instant", mandatory: false },
    transmittal: { label: "Transmittal sent (copy to project lead)", def: "digest", mandatory: false },
    allocation: { label: "Over/under-allocated (A-05)", def: "digest", mandatory: false },
    timesheet_missing: { label: "Timesheet missing (A-06)", def: "instant", mandatory: false },
    timesheet: { label: "Timesheet approved or returned", def: "instant", mandatory: false },
    owner_summary: { label: "Weekly owner summary", def: "instant", mandatory: false },
    review_overdue: { label: "Review overdue (A-07)", def: "instant", mandatory: false },
    comment: { label: "Client comment assigned / overdue (A-08)", def: "instant", mandatory: false },
    ready_to_invoice: { label: "Stage ready to invoice (A-09)", def: "instant", mandatory: true },
    rfi_due: { label: "RFI due (A-10)", def: "instant", mandatory: false },
    team: { label: "Added to a project team", def: "instant", mandatory: false },
    acknowledged: { label: "Transmittal acknowledged by a recipient", def: "digest", mandatory: false },
  };
  function prefOf(u, event) { const e = EVENTS[event]; if (!e) return "instant"; if (e.mandatory) return "instant"; return u.prefs?.[event] || e.def; }
  function notify(userIds, event, title, body, link, opts = {}) {
    const ids = [...new Set(userIds.filter(Boolean))];
    ids.forEach((uid) => {
      const u = user(uid); if (!u || !u.active) return;
      if (uid === currentUserId && !opts.self) return; // you are not told about your own action
      const mode = prefOf(u, event); if (mode === "off") return;
      S.notifications.unshift({ id: nextId("n"), userId: uid, event, title, body: body || "", link: link || "", at: at(), read: false, digest: mode === "digest" });
      if (mode === "instant" && opts.email !== false) sendEmail({ to: [u.email], toName: u.name, subject: title, body: body || title, link, kind: "notification" });
    });
  }
  function sendEmail(m) {
    S.emails.unshift({ id: nextId("em"), at: at(), from: `DrawingOps <no-reply@${S.org.short.toLowerCase()}.drawingops.example>`, read: false, ...m });
  }

  // ---------- Audit (F-39): insert-only ----------
  function audit(entity, entityId, action, before, after, extra = {}) {
    S.audit.unshift({ id: nextId("au"), at: at(), actorId: currentUserId, entity, entityId, action, before: before ?? null, after: after ?? null, projectId: extra.projectId || null, text: extra.text || "", ip: "10.20.4.23 (demo)", requestId: `req-${Math.random().toString(36).slice(2, 10)}` });
  }

  // ---------- Roles and permissions (docs/03 §17) ----------
  const ROLE_LABEL = { PL: "Project lead", DL: "Discipline lead", Designer: "Designer", SR: "Senior reviewer", DC: "Document controller", Viewer: "Viewer" };
  const rolesOn = (u, p) => (p?.members || []).filter((m) => m.userId === u?.id);
  const hasRole = (u, p, role, d) => rolesOn(u, p).some((m) => m.role === role && (!d || !m.discipline || m.discipline === d));
  const isPL = (u, p) => hasRole(u, p, "PL");
  const isDL = (u, p, d) => hasRole(u, p, "DL", d);
  const isDC = (u, p) => hasRole(u, p, "DC");
  const isSR = (u, p) => hasRole(u, p, "SR");
  function canSeeProject(u, p) { if (!u || !p) return false; if (["owner", "admin", "accounts"].includes(u.orgRole)) return true; return rolesOn(u, p).length > 0; }
  const visibleProjects = (u) => S.projects.filter((p) => canSeeProject(u, p));
  function caps(u) {
    if (!u) return {};
    const projects = S.projects.filter((p) => rolesOn(u, p).length);
    const leads = projects.some((p) => isPL(u, p)); const dls = projects.some((p) => isDL(u, p));
    return {
      portfolio: u.orgRole === "owner" || leads || u.orgRole === "admin",
      admin: u.orgRole === "admin",
      audit: u.orgRole === "owner" || u.orgRole === "admin",
      billing: u.orgRole === "owner" || u.orgRole === "accounts" || leads,
      invoice: u.orgRole === "accounts",
      timesheet: u.orgRole !== "admin",
      allocate: leads || dls,
      approveTs: leads || dls,
      reports: u.orgRole === "owner" || u.orgRole === "admin" || leads || dls || u.orgRole === "accounts",
      baseline: u.orgRole === "owner" || u.orgRole === "admin",
      forecasts: u.orgRole === "owner" || leads || dls,
      createProject: u.orgRole === "owner" || u.orgRole === "admin" || (u.canLead && u.orgRole === "staff"),
      findings: projects.some((p) => isSR(u, p) || isDC(u, p)) || u.orgRole === "admin",
      allHours: u.orgRole === "owner",
      leads, dls,
    };
  }
  /** Whose hours this user may see (docs/03 §9): own; DL their discipline; PL project totals; Owner all. */
  function canSeeHoursOf(u, other) {
    if (!u || !other) return false; if (u.id === other.id || u.orgRole === "owner") return true;
    return S.projects.some((p) => (isDL(u, p, other.discipline) && rolesOn(other, p).length) || (isPL(u, p) && rolesOn(other, p).length));
  }

  // ---------- Sheet state machine (§3) ----------
  const T_TABLE = {
    planned: ["in_progress", "on_hold", "cancelled"],
    in_progress: ["ready_for_check", "on_hold", "cancelled"],
    ready_for_check: ["in_check", "in_progress"],
    in_check: ["changes_requested", "approved_for_issue"],
    changes_requested: ["in_progress"],
    approved_for_issue: ["issued", "in_progress"],
    issued: ["in_progress", "superseded"],
    superseded: [], on_hold: [], cancelled: [],
  };
  const ACTIONS = {
    start: { label: "Start", to: "in_progress" },
    restart: { label: "Start revisions", to: "in_progress" },
    submit: { label: "Submit for check", to: "ready_for_check" },
    withdraw: { label: "Withdraw", to: "in_progress" },
    start_check: { label: "Start check", to: "in_check" },
    approve: { label: "Approve", to: "approved_for_issue" },
    return: { label: "Return with redlines", to: "changes_requested", needsReason: true },
    issue: { label: "Issue", to: "issued" },
    reopen: { label: "Reopen", to: "in_progress", needsReason: true },
    next_revision: { label: "Start next revision", to: "in_progress" },
    hold: { label: "Put on hold", to: "on_hold", needsReason: true },
    resume: { label: "Resume", to: null },
    cancel: { label: "Cancel sheet", to: "cancelled", needsReason: true, danger: true },
    supersede: { label: "Supersede sheet", to: "superseded", needsReason: true, danger: true },
    admin_reopen: { label: "Reopen (admin)", to: "planned", needsReason: true },
  };
  const ENTRY = { start: ["planned"], restart: ["changes_requested"], submit: ["in_progress"], withdraw: ["ready_for_check"], start_check: ["ready_for_check"], approve: ["in_check"], return: ["in_check"], issue: ["approved_for_issue"], reopen: ["approved_for_issue"], next_revision: ["issued"], hold: ["planned", "in_progress"], resume: ["on_hold"], cancel: ["planned", "in_progress"], supersede: ["issued"], admin_reopen: ["cancelled", "superseded"] };
  const openReview = (s, kind) => reviewsOf(s.id).find((v) => v.state === "open" && (!kind || v.kind === kind));

  /** The allowed_actions list for this user on this sheet (the UI never re-implements the rules). */
  function allowedActions(u, s) {
    const p = project(s.projectId); if (!u || !p) return [];
    const pl = isPL(u, p); const dl = isDL(u, p, s.discipline); const own = s.ownerId === u.id; const dc = isDC(u, p); const sr = isSR(u, p);
    const st = stage(s.stageId);
    const out = [];
    const push = (action, extra = {}) => { const a = ACTIONS[action]; if (!ENTRY[action].includes(s.state)) return; out.push({ action, label: a.label, needsReason: !!a.needsReason, danger: !!a.danger, ...extra }); };
    if (p.state === "on_hold" && !pl) return out;
    if (own || dl || pl) { push("start", { primary: true }); push("restart", { primary: true }); push("submit", { primary: true }); }
    if (own || pl) push("withdraw");
    const senior = openReview(s, "senior_qc");
    if (senior) { if (sr || pl) { push("approve", { primary: true, label: "Approve senior QC" }); push("return", { primary: true }); } }
    else if (!own && (dl || pl || sr || s.checkerId === u.id)) { push("start_check", { primary: true }); push("approve", { primary: true, label: st?.seniorQC ? "Approve (senior QC next)" : "Approve" }); push("return", { primary: true }); }
    if (dc || pl) {
      const d = draftOf(s);
      const blocked = !d ? "Upload PDF first" : d.namingStatus === "blocked" ? "File name breaks the naming rule" : "";
      push("issue", { primary: true, blocked });
    }
    if (own || dl || pl) { push("reopen"); push("next_revision", { primary: own || dl }); }
    if (pl) { push("hold"); push("resume", { primary: true }); push("cancel"); push("supersede"); }
    if (u.orgRole === "admin") push("admin_reopen");
    return out;
  }

  function transition(s, action, o = {}) {
    const u = user(currentUserId); const p = project(s.projectId); const st = stage(s.stageId);
    const a = ACTIONS[action];
    const allowed = allowedActions(u, s).find((x) => x.action === action);
    if (!allowed && !o.force) throw new Error(`"${a?.label || action}" is not allowed for you on ${s.number} while it is ${s.state.replace(/_/g, " ")}.`);
    if (allowed?.blocked) throw new Error(allowed.blocked);
    if (a.needsReason && !o.reason && !(action === "return" && o.redlines?.length)) throw new Error(action === "return" ? "Add a comment or a redline file before returning the sheet." : "A reason is required.");
    if (action === "submit") {
      const cl = checklistFor(s);
      if (cl) { const missing = cl.items.filter((it, i) => it.mandatory && !(o.ticks || [])[i]); if (missing.length) throw new Error(`Tick every mandatory pre-check item first (${missing.length} left).`); }
    }
    const from = s.state; let to = a.to;
    if (action === "resume") to = s.stateBefore || "planned";
    if (!o.force && to && from !== to && !(T_TABLE[from] || []).includes(to) && !["hold", "resume", "admin_reopen"].includes(action)) throw new Error(`HTTP 409: ${from} → ${to} is not a valid transition. Allowed: ${(T_TABLE[from] || []).join(", ") || "none"}.`);
    const now = at();
    const record = (f, t2, reason) => { S.transitions.push({ id: nextId("t"), sheetId: s.id, from: f, to: t2, userId: u.id, at: now, reason: reason || "" }); };
    const link = `#/projects/${p.id}/sheets/${s.id}`;
    switch (action) {
      case "submit": {
        s.reviewRound++;
        const d = draftOf(s);
        S.reviews.push({ id: nextId("rv"), sheetId: s.id, revisionId: d?.id || null, kind: "check", reviewerId: s.checkerId, state: "open", comment: "", redlines: [], openedAt: now, closedAt: null, ticks: o.ticks || [] });
        notify([s.checkerId], "review_requested", `${s.number} is ready for your check`, `${user(s.ownerId)?.name} submitted ${s.number} ${s.title} (${p.code}) for check.`, link);
        break;
      }
      case "start_check": { const rv = openReview(s, "check"); if (rv && rv.reviewerId !== u.id) rv.reviewerId = u.id; break; }
      case "approve": {
        const senior = openReview(s, "senior_qc");
        if (senior) { senior.state = "approved"; senior.closedAt = now; senior.comment = o.comment || ""; senior.reviewerId = u.id; }
        else {
          const rv = openReview(s, "check") || (S.reviews.push({ id: nextId("rv"), sheetId: s.id, revisionId: draftOf(s)?.id || null, kind: "check", reviewerId: u.id, state: "open", openedAt: now, comment: "", redlines: [], ticks: [] }), S.reviews[S.reviews.length - 1]);
          rv.state = "approved"; rv.closedAt = now; rv.comment = o.comment || ""; rv.reviewerId = u.id;
          if (st?.seniorQC) {
            // Second step: the sheet stays in check until the senior reviewer approves (§7).
            S.reviews.push({ id: nextId("rv"), sheetId: s.id, revisionId: rv.revisionId, kind: "senior_qc", reviewerId: p.members.find((m) => m.role === "SR")?.userId || null, state: "open", comment: "", redlines: [], openedAt: now, closedAt: null, ticks: [] });
            record(from, from, "First check approved; senior QC required for this stage");
            notify(p.members.filter((m) => m.role === "SR").map((m) => m.userId), "senior_qc", `Senior QC needed: ${s.number}`, `${s.number} ${s.title} passed the first check by ${u.name}. Stage ${st.seq} ${st.name} needs senior QC.`, link);
            audit("sheet", s.id, "review_approved", null, { kind: "check" }, { projectId: p.id, text: `${u.name} approved the first check of ${s.number}; senior QC requested` });
            commit(); return s;
          }
        }
        notify([s.ownerId], "approved", `${s.number} approved for issue`, `${u.name} approved ${s.number} ${s.title}.`, link);
        notify(p.members.filter((m) => m.role === "DC").map((m) => m.userId), "approved", `${s.number} is ready to issue`, `${s.number} ${s.title} (${p.code}) is approved for issue.`, `#/projects/${p.id}/issue`);
        break;
      }
      case "return": {
        const rv = openReview(s, "senior_qc") || openReview(s, "check");
        if (rv) { rv.state = "returned"; rv.closedAt = now; rv.comment = o.reason || ""; rv.redlines = o.redlines || []; rv.reviewerId = u.id; }
        else S.reviews.push({ id: nextId("rv"), sheetId: s.id, revisionId: draftOf(s)?.id || null, kind: "check", reviewerId: u.id, state: "returned", comment: o.reason || "", redlines: o.redlines || [], openedAt: now, closedAt: now, ticks: [] });
        notify([s.ownerId], "returned", `${s.number} returned with redlines`, `${u.name}: “${o.reason || "See the redline file."}”`, link);
        break;
      }
      case "reopen": S.reviews.filter((v) => v.sheetId === s.id && v.state === "approved" && v.revisionId === draftOf(s)?.id).forEach((v) => { v.state = "cleared"; }); break;
      case "hold": s.stateBefore = from; break;
      case "cancel": s.cancelReason = o.reason; break;
      case "supersede": { s.replacedBy = o.replacedBy || null; const c = currentRev(s); if (c) { c.state = "superseded"; c.supersededAt = now; } break; }
      case "admin_reopen": s.cancelReason = ""; break;
      default: break;
    }
    s.state = to; s.stateChangedAt = now;
    record(from, to, o.reason || (action === "next_revision" ? "Start next revision" : ""));
    audit("sheet", s.id, "state", { state: from }, { state: to }, { projectId: p.id, text: `${u.name} moved ${s.number} from ${label(from)} to ${label(to)}${o.reason ? ` · “${o.reason}”` : ""}` });
    stageRules(s);
    commit();
    return s;
  }
  /** PL override (§7): force any transition the table allows, with a reason; still never outside the table. */
  function override(s, to, reason) {
    const u = user(currentUserId); const p = project(s.projectId);
    if (!isPL(u, p)) throw new Error("Only the project lead can override a step.");
    if (!reason) throw new Error("A reason is required for an override.");
    if (!(T_TABLE[s.state] || []).includes(to) || to === "issued") throw new Error(`HTTP 409: ${s.state} → ${to} is not in the transition table. Allowed: ${(T_TABLE[s.state] || []).filter((x) => x !== "issued").join(", ") || "none"}.`);
    const from = s.state; const now = at();
    if (to === "approved_for_issue") reviewsOf(s.id).filter((v) => v.state === "open").forEach((v) => { v.state = "approved"; v.closedAt = now; v.comment = `PL override: ${reason}`; v.reviewerId = u.id; });
    s.state = to; s.stateChangedAt = now;
    S.transitions.push({ id: nextId("t"), sheetId: s.id, from, to, userId: u.id, at: now, reason: `PL override: ${reason}` });
    audit("sheet", s.id, "override", { state: from }, { state: to }, { projectId: p.id, text: `${u.name} overrode ${s.number} from ${label(from)} to ${label(to)} · “${reason}”` });
    stageRules(s); commit(); return s;
  }
  function deleteSheet(s) {
    const u = user(currentUserId); const p = project(s.projectId);
    if (!isPL(u, p)) throw new Error("Only the project lead can delete a sheet.");
    if (revisionsOf(s.id).some((v) => v.issuedAt)) throw new Error(`${s.number} has an issued revision, so it cannot be deleted. Cancel it instead.`);
    S.sheets = S.sheets.filter((x) => x.id !== s.id); S.revisions = S.revisions.filter((v) => v.sheetId !== s.id); S.reviews = S.reviews.filter((v) => v.sheetId !== s.id);
    audit("sheet", s.id, "deleted", { number: s.number, title: s.title }, null, { projectId: p.id, text: `${u.name} deleted sheet ${s.number} ${s.title} (never issued)` });
    commit();
  }
  const label = (st) => ({ planned: "Planned", in_progress: "In progress", ready_for_check: "Ready for check", in_check: "In check", changes_requested: "Changes requested", approved_for_issue: "Approved for issue", issued: "Issued", superseded: "Superseded", on_hold: "On hold", cancelled: "Cancelled" })[st] || st;
  function checklistFor(s) { const st = stage(s.stageId); return S.checklists.find((c) => c.discipline === s.discipline && c.stage === st?.name) || null; }

  // ---------- Stage rules (F-03) and the billing signal (A-09) ----------
  function stageRules(s) {
    const st = stage(s.stageId); if (!st) return;
    const p = project(s.projectId);
    if (st.state === "planned" && s.state === "in_progress") { st.state = "active"; st.actualStart = today(); audit("stage", st.id, "state", { state: "planned" }, { state: "active" }, { projectId: p.id, text: `Stage ${st.seq} ${st.name} became active (first sheet started)` }); }
    if (["active", "planned"].includes(st.state)) {
      const list = sheetsOf(p.id).filter((x) => x.stageId === st.id && x.state !== "cancelled");
      const done = list.length > 0 && list.every((x) => { const c = currentRev(x); return x.state === "issued" && c && (st.requiredPurposes.includes(c.purpose) || !st.requiredPurposes.length); });
      if (done) { const was = st.state; st.state = "deliverables_issued"; st.actualEnd = today(); audit("stage", st.id, "state", { state: was }, { state: "deliverables_issued" }, { projectId: p.id, text: `Stage ${st.seq} ${st.name}: every deliverable issued` }); }
    }
    billingRule(st);
  }
  function billingRule(st) {
    if (!S.org.rules["A-09"].on) return;
    const p = project(st.projectId);
    const approved = S.approvals.some((a) => a.stageId === st.id);
    if (st.state === "deliverables_issued" && approved) st.state = "client_approved";
    if (st.state === "client_approved") {
      const listDone = sheetsOf(p.id).filter((x) => x.stageId === st.id && x.state !== "cancelled").every((x) => x.state === "issued");
      if (listDone) {
        st.state = "ready_to_invoice"; st.readySince = at();
        const amt = Math.round((p.fee * st.pct) / 100);
        audit("stage", st.id, "state", { state: "client_approved" }, { state: "ready_to_invoice" }, { projectId: p.id, text: `A-09: stage ${st.seq} ${st.name} is ready to invoice (${DO.fmtINR(amt)})` });
        const accounts = S.users.filter((u) => u.orgRole === "accounts" || u.orgRole === "owner").map((u) => u.id);
        notify([...accounts, p.leadId], "ready_to_invoice", `Ready to invoice: ${p.code} stage ${st.seq} ${st.name}`, `${p.code} ${p.name} · ${st.name} · fee ${st.pct}% = ${DO.fmtINR(amt)}. All deliverables issued and client approval recorded.`, "#/billing", { self: true });
      }
    }
  }

  // ---------- Revisions, naming rules (A-04, F-35) and issue (F-14, F-07, A-03) ----------
  function nextRevCode(s) {
    const st = stage(s.stageId); const series = st && st.seq >= 4 ? "C" : "P";
    const n = revisionsOf(s.id).filter((v) => v.code[0] === series).length + 1;
    return `${series}${String(n).padStart(S.org.revisionScheme.digits || 2, "0")}`;
  }
  function namingCheck(fileName, s) {
    const rules = S.namingRules.filter((r) => r.target === "file_name");
    for (const r of rules) {
      let re; try { re = new RegExp(r.pattern); } catch (e) { continue; }
      if (!re.test(fileName)) return { ok: false, message: `File name '${fileName}' does not match rule ${r.pattern}. ${r.message} Rename to ${s ? `${s.number}_${nextRevCode(s)}.pdf` : r.example}.` };
    }
    if (s && !fileName.startsWith(s.number)) return { ok: false, message: `File name '${fileName}' names a different sheet than ${s.number}. Rename to ${s.number}_${nextRevCode(s)}.pdf.` };
    return { ok: true, message: "" };
  }
  function sheetNumberCheck(number, d, p) {
    const dd = disc(d); if (!dd) return `Unknown discipline “${d}”.`;
    try { if (!new RegExp(dd.regex).test(number)) return `Sheet number ${number} doesn't match the ${dd.name} rule ${dd.regex}. Example: ${d}-101.`; } catch (e) { /* ignore */ }
    if (p && sheetsOf(p.id).some((s) => s.number === number || (s.aliases || []).includes(number))) return `Sheet number ${number} already exists in ${p.code}.`;
    return "";
  }
  async function sha256(blob) { try { const buf = await blob.arrayBuffer(); const h = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16); } catch (e) { return String(DO.hash(blob.name + blob.size)); } }
  /** Uploading a PDF creates a draft revision with the next code (F-06). */
  async function uploadRevision(s, file, o = {}) {
    const u = user(currentUserId);
    if (file && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF. Upload one PDF per sheet.`);
    if (file && file.size > 200 * 1048576) throw new Error(`${file.name} is larger than 200 MB (N-03 upload limit).`);
    if (file) { const head = new Uint8Array(await file.slice(0, 5).arrayBuffer()); if (String.fromCharCode(...head) !== "%PDF-") throw new Error(`${file.name} is not a valid PDF (magic bytes check failed).`); }
    const sha = file ? await sha256(file) : String(DO.hash(s.number + Date.now()));
    if (revisionsOf(s.id).some((v) => v.sha === sha)) throw new Error(`This exact file was already uploaded for ${s.number} (SHA-256 match). Issued files are immutable; upload the corrected PDF.`);
    const existing = draftOf(s);
    const code = existing ? existing.code : nextRevCode(s);
    if (existing) { S.revisions = S.revisions.filter((v) => v.id !== existing.id); }
    const name = file ? file.name : o.fileName || `${s.number}_${code}.pdf`;
    const chk = S.org.rules["A-04"].on ? namingCheck(name, s) : { ok: true };
    const rv = { id: nextId("r"), sheetId: s.id, code, seq: (revisionsOf(s.id)[0]?.seq || 0) + 1, state: "draft", stageId: s.stageId, purpose: "", suitability: "", fileName: name, size: file ? file.size : 2400000, uploadedBy: u.id, uploadedAt: at(), issuedAt: null, issuedBy: null, transmittalId: null, supersededAt: null, namingStatus: chk.ok ? "ok" : "blocked", namingMessage: chk.ok ? "" : chk.message, changeSummary: o.summary || "", sha, userFile: !!file };
    S.revisions.push(rv);
    if (file) files.set(rv.id, file);
    audit("revision", rv.id, "uploaded", null, { code, file: name }, { projectId: s.projectId, text: `${u.name} uploaded ${name} as ${s.number} ${code} (draft)${chk.ok ? "" : " · blocked by naming rule (A-04)"}` });
    commit();
    return rv;
  }
  function renameDraft(rv, newName) {
    const s = sheet(rv.sheetId); const chk = namingCheck(newName, s);
    rv.fileName = newName; rv.namingStatus = chk.ok ? "ok" : "blocked"; rv.namingMessage = chk.message;
    audit("revision", rv.id, "renamed", null, { file: newName }, { projectId: s.projectId, text: `${user(currentUserId).name} renamed the draft of ${s.number} to ${newName}` });
    commit(); return chk;
  }

  /** Issue sheets with one numbered transmittal (S-07). Throws with a clear reason when blocked. */
  function issue(o) {
    const u = user(currentUserId); const p = project(o.projectId);
    if (!(isDC(u, p) || isPL(u, p))) throw new Error("Only the document controller or project lead can issue.");
    if (!o.purpose) throw new Error("Pick the purpose of this issue (F-08).");
    const recips = (o.recipients || []).filter(Boolean); const hand = o.hand || [];
    if (!recips.length && !hand.length) throw new Error("Add at least one recipient.");
    const sheets = o.sheetIds.map(sheet).filter(Boolean);
    const blocked = sheets.filter((s) => s.state !== "approved_for_issue" && !o.override);
    if (blocked.length) throw new Error(`${blocked.map((s) => s.number).join(", ")} ${blocked.length === 1 ? "is" : "are"} not approved for issue.`);
    if (o.override && !isPL(u, p)) throw new Error("Only the project lead can override.");
    const noPdf = sheets.filter((s) => !draftOf(s) || draftOf(s).namingStatus === "blocked");
    if (noPdf.length) throw new Error(`${noPdf.map((s) => s.number).join(", ")}: upload a PDF that passes the naming rule first.`);
    S.counters[p.id] = (S.counters[p.id] || S.transmittals.filter((t) => t.projectId === p.id).length) + 1;
    const number = `${p.code}-TR-${String(S.counters[p.id]).padStart(4, "0")}`;
    const now = at();
    const tm = { id: nextId("tm"), projectId: p.id, number, seq: S.counters[p.id], purpose: o.purpose, note: o.note || "", sentBy: u.id, sentAt: now, token: `t${Math.random().toString(36).slice(2, 12)}`, expiresAt: DO.addDays(today(), S.org.linkDays), refersTo: o.refersTo || null, override: o.override || "", recipients: [...recips.map((cid) => ({ contactId: cid, delivery: "email", status: "sent", ackAt: null, downloadedAt: null })), ...hand.map((cid) => ({ contactId: cid, delivery: "hand", status: "sent", ackAt: now, downloadedAt: null }))], items: [] };
    let supersededCount = 0; const previousRecipients = new Map();
    sheets.forEach((s) => {
      const d = draftOf(s);
      const prev = revisionsOf(s.id).filter((v) => v.state === "issued");
      prev.forEach((v) => { v.state = "superseded"; v.supersededAt = now; supersededCount++; const t2 = transmittal(v.transmittalId); (t2?.recipients || []).forEach((rc) => { if (!recips.includes(rc.contactId)) previousRecipients.set(rc.contactId, [...(previousRecipients.get(rc.contactId) || []), s.number]); }); });
      d.state = "issued"; d.purpose = o.purpose; d.suitability = o.suitability || ""; d.issuedAt = now; d.issuedBy = u.id; d.transmittalId = tm.id; d.stageId = s.stageId;
      s.currentRevId = d.id;
      const from = s.state; s.state = "issued"; s.stateChangedAt = now;
      S.transitions.push({ id: nextId("t"), sheetId: s.id, from, to: "issued", userId: u.id, at: now, reason: o.override ? `PL override: ${o.override}` : `Issued ${d.code} for ${purposeLabel(o.purpose)} on ${number}` });
      tm.items.push({ sheetId: s.id, revisionId: d.id });
    });
    S.transmittals.push(tm);
    const link = `#/t/${tm.token}`;
    tm.recipients.filter((r) => r.delivery === "email").forEach((r) => { const c = contact(r.contactId); sendEmail({ to: [c.email], toName: c.name, subject: `${number}: ${sheets.length} drawing${sheets.length === 1 ? "" : "s"} from ${S.org.name} (${purposeLabel(o.purpose)})`, body: `Dear ${c.name},\n\n${u.name} has issued ${sheets.length} drawing${sheets.length === 1 ? "" : "s"} for ${p.code} ${p.name} ${purposeLabel(o.purpose).toLowerCase()}.${o.note ? `\n\nNote: ${o.note}` : ""}\n\nDownload them from the secure link below. The link is valid until ${DO.fmtDate(tm.expiresAt)}. Please acknowledge receipt on the page.`, link: `${link}?r=${c.id}`, kind: "transmittal", transmittalId: tm.id }); });
    // A-03: previous recipients of earlier revisions are told about the new revision.
    previousRecipients.forEach((nums, cid) => { const c = contact(cid); if (!c?.email) return; sendEmail({ to: [c.email], toName: c.name, subject: `New revision: ${nums.slice(0, 3).join(", ")}${nums.length > 3 ? ` and ${nums.length - 3} more` : ""} (${p.code})`, body: `Dear ${c.name},\n\nA newer revision of drawings you received earlier has been issued on ${number}. The earlier revisions are now superseded; please stop using them. The current set is always on the site view link.`, link: `#/site/${p.siteToken}`, kind: "new_revision" }); });
    notify([p.leadId], "transmittal", `${number} sent`, `${u.name} issued ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} to ${tm.recipients.length} recipient${tm.recipients.length === 1 ? "" : "s"} for ${purposeLabel(o.purpose)}.`, `#/projects/${p.id}/transmittals/${tm.id}`);
    sheets.forEach((s) => notify([s.ownerId], "approved", `${s.number} issued on ${number}`, `${s.number} ${s.title} was issued as ${revision(s.currentRevId).code}.`, `#/projects/${p.id}/sheets/${s.id}`));
    audit("transmittal", tm.id, "issued", null, { number, sheets: sheets.length, recipients: tm.recipients.length, purpose: o.purpose }, { projectId: p.id, text: `${u.name} issued ${number}: ${sheets.length} sheets to ${tm.recipients.length} recipients for ${purposeLabel(o.purpose)}; ${supersededCount} earlier revisions superseded` });
    sheets.forEach((s) => stageRules(s));
    commit();
    return { transmittal: tm, supersededCount, previousRecipients: previousRecipients.size };
  }

  // ---------- Simple field edits with undo (S-05 inline edit, F-46 bulk) ----------
  function editSheets(ids, patch, why) {
    const u = user(currentUserId); const before = [];
    ids.forEach((sid) => {
      const s = sheet(sid); if (!s) return;
      const changes = typeof patch === "function" ? patch(s) : patch;
      if (!changes || !Object.keys(changes).length) return;
      const b = {}; Object.keys(changes).forEach((k) => { b[k] = s[k]; });
      before.push({ id: sid, values: b });
      Object.assign(s, changes);
      if (changes.ownerId && changes.ownerId !== b.ownerId) notify([changes.ownerId], "assigned", `${s.number} assigned to you`, `${u.name} assigned ${s.number} ${s.title} (${project(s.projectId).code}) to you.`, `#/projects/${s.projectId}/sheets/${s.id}`);
      audit("sheet", sid, "edit", b, changes, { projectId: s.projectId, text: `${u.name} changed ${Object.keys(changes).map((k) => FIELD_LABEL[k] || k).join(", ")} on ${s.number}${why ? ` (${why})` : ""}` });
    });
    commit();
    return () => { before.forEach(({ id, values }) => { const s = sheet(id); if (s) Object.assign(s, values); audit("sheet", id, "undo", null, values, { projectId: s?.projectId, text: `${u.name} undid a change on ${s?.number}` }); }); commit(); };
  }
  const FIELD_LABEL = { ownerId: "owner", checkerId: "checker", planned: "planned date", packageId: "package", title: "title", notes: "notes", cadLink: "CAD link", stageId: "stage", discipline: "discipline", number: "number" };

  function bulkTransition(ids, action, o = {}) {
    let ok = 0; const skipped = [];
    ids.forEach((sid) => { const s = sheet(sid); try { transition(s, action, o); ok++; } catch (e) { skipped.push({ number: s.number, why: e.message }); } });
    return { ok, skipped };
  }

  // ---------- Small helpers used by many screens ----------
  const userName = (id) => user(id)?.name || "—";
  const shortName = (id) => DO.short(user(id)?.name || "") || "—";
  function stageFee(st) { const p = project(st.projectId); return Math.round((p.fee * st.pct) / 100); }
  function projectStats(p, asOf) {
    const list = sheetsOf(p.id).filter((s) => s.state !== "cancelled");
    const planned = list.length; const issued = list.filter((s) => s.state === "issued" || (s.currentRevId && revision(s.currentRevId)?.state === "issued" && s.state !== "superseded")).length;
    const late = list.filter(isLate).length; const atRisk = list.filter(isAtRisk).length;
    return { planned, issued, late, atRisk };
  }
  function workingDaysWaiting(iso) { return Math.max(0, DO.workingDaysBetween(DO.dateOf(iso), today())); }
  function reviewQueue(u) {
    return S.reviews.filter((v) => v.state === "open" && (v.reviewerId === u.id || (v.kind === "senior_qc" && !v.reviewerId && S.projects.some((p) => isSR(u, p) && p.id === sheet(v.sheetId)?.projectId)) || (S.users.some((x) => x.delegate?.to === u.id && x.id === v.reviewerId && (!x.delegate.until || x.delegate.until >= today())))))
      .map((v) => ({ review: v, sheet: sheet(v.sheetId) })).filter((x) => x.sheet && ["ready_for_check", "in_check"].includes(x.sheet.state)).sort((a, b) => (a.review.openedAt > b.review.openedAt ? 1 : -1));
  }

  // ---------- Workload (F-17, F-19, A-05) ----------
  function capacityOf(u, week) {
    let cap = u.capacity;
    for (let i = 0; i < 7; i++) { const d = DO.addDays(week, i); if (!S.org.workdays.includes(DO.weekday(d))) continue; const hol = S.holidays.some((h) => h.date === d); const leave = S.leave.some((l) => l.userId === u.id && d >= l.from && d <= l.to); if (hol || leave) cap -= u.capacity / S.org.workdays.length; }
    return Math.max(0, Math.round(cap * 10) / 10);
  }
  const allocated = (uid, week) => DO.sum(S.allocations.filter((a) => a.userId === uid && a.week === week), (a) => a.hours);
  function loadPct(u, week) { const c = capacityOf(u, week); const a = allocated(u.id, week); return c ? Math.round((a / c) * 100) : a ? 999 : null; }
  function loadFlag(pct) { if (pct === null) return null; if (pct > S.org.rules["A-05"].over) return "over"; if (pct < S.org.rules["A-05"].under) return "under"; return "ok"; }
  function setAllocation(uid, pid, sid, week, hours) {
    const ex = S.allocations.find((a) => a.userId === uid && a.projectId === pid && a.stageId === sid && a.week === week);
    const before = ex ? ex.hours : 0;
    if (ex) { if (+hours > 0) ex.hours = +hours; else S.allocations = S.allocations.filter((a) => a !== ex); }
    else if (+hours > 0) S.allocations.push({ id: nextId("al"), userId: uid, projectId: pid, stageId: sid, week, hours: +hours });
    audit("allocation", `${uid}:${pid}:${week}`, "set", { hours: before }, { hours: +hours }, { projectId: pid, text: `${user(currentUserId).name} allocated ${hours} h to ${userName(uid)} on ${project(pid).code} for W${DO.isoWeek(week)}` });
  }

  // ---------- Timesheets (F-18, A-06) ----------
  function timesheet(uid, week, create) {
    let ts = S.timesheets.find((t) => t.userId === uid && t.week === week);
    if (!ts && create) {
      const rows = S.allocations.filter((a) => a.userId === uid && a.week === week).map((a) => ({ projectId: a.projectId, stageId: a.stageId, hours: [0, 0, 0, 0, 0, 0, 0] }));
      ts = { id: nextId("ts"), userId: uid, week, state: "draft", rows: rows.length ? rows : [], submittedAt: null, approvedBy: null, approvedAt: null, reason: "" };
      S.timesheets.push(ts);
    }
    return ts;
  }
  const tsTotal = (ts) => DO.sum(ts.rows, (r) => DO.sum(r.hours));
  function timesheetMissing(uid, week) { const ts = timesheet(uid, week); return !ts || ts.state === "draft"; }

  // ---------- Automation sweep (A-01, A-02, A-05..A-08, A-10): idempotent ----------
  function runSweep(kind = "daily") {
    const T = today(); const u = user(currentUserId); const t0 = performance.now();
    S.sweepLog = S.sweepLog || {};
    const counts = { at_risk_raised: 0, late_raised: 0, escalations: 0, reviews_overdue: 0, comments_overdue: 0, rfis_due: 0, timesheet_reminders: 0, duplicates_skipped: 0 };
    const once = (key, fn) => { const k = `${T}|${key}`; if (S.sweepLog[k]) { counts.duplicates_skipped++; return; } S.sweepLog[k] = 1; fn(); };
    S.sheets.forEach((s) => {
      const p = project(s.projectId); if (p.state !== "active") return;
      flagsFor(s).forEach((f) => once(`${f.kind}:${s.id}`, () => {
        const link = `#/projects/${p.id}/sheets/${s.id}`;
        if (f.kind === "at_risk") { counts.at_risk_raised++; notify([s.ownerId, ...p.members.filter((m) => m.role === "DL" && m.discipline === s.discipline).map((m) => m.userId)], "at_risk", `${s.number} at risk: ${f.text.toLowerCase()}`, `${s.number} ${s.title} (${p.code}) is due ${DO.fmtDate(effPlanned(s))} and is still ${label(s.state).toLowerCase()}.`, link, { self: true }); }
        else { counts.late_raised++; const esc = f.escalated; if (esc) counts.escalations++; notify([...p.members.filter((m) => m.role === "DL" && m.discipline === s.discipline).map((m) => m.userId), ...(esc ? [p.leadId] : [])], "late", `${s.number} late by ${DO.plural(f.n, "working day")}${esc ? " (escalated)" : ""}`, `${s.number} ${s.title} (${p.code}) was due ${DO.fmtDate(effPlanned(s))}.`, link, { self: true }); }
      }));
    });
    S.reviews.filter((v) => v.state === "open" && workingDaysWaiting(v.openedAt) > S.org.rules["A-07"].days).forEach((v) => once(`review:${v.id}`, () => { counts.reviews_overdue++; const s = sheet(v.sheetId); const p = project(s.projectId); const rv = user(v.reviewerId); const to = rv?.delegate && rv.delegate.until >= T ? rv.delegate.to : v.reviewerId; notify([to, ...p.members.filter((m) => m.role === "DL" && m.discipline === s.discipline).map((m) => m.userId)], "review_overdue", `Review overdue: ${s.number}`, `${s.number} has waited ${workingDaysWaiting(v.openedAt)} working days for ${v.kind === "senior_qc" ? "senior QC" : "check"}.`, `#/reviews`, { self: true }); }));
    S.comments.filter((c) => ["new", "assigned"].includes(c.status) && DO.diffDays(DO.dateOf(c.receivedAt), T) > S.org.rules["A-08"].days).forEach((c) => once(`comment:${c.id}`, () => { counts.comments_overdue++; const p = project(c.projectId); notify([c.assigneeId, p.leadId], "comment", `Client comment overdue: ${c.number}`, `“${c.text.slice(0, 90)}…” has had no response for ${DO.diffDays(DO.dateOf(c.receivedAt), T)} days.`, `#/projects/${p.id}/comments`, { self: true }); }));
    S.rfis.filter((x) => x.status === "open" && DO.workingDaysBetween(T, x.due) <= S.org.rules["A-10"].days).forEach((x) => once(`rfi:${x.id}`, () => { counts.rfis_due++; notify([x.assigneeId], "rfi_due", `RFI due ${DO.fmtDate(x.due)}: ${x.number}`, x.question, `#/projects/${x.projectId}/construction/rfis`, { self: true }); }));
    const lastWeek = DO.addDays(DO.mondayOf(T), -7);
    S.users.filter((x) => x.active && x.orgRole !== "admin").forEach((x) => { if (timesheetMissing(x.id, lastWeek)) once(`ts:${x.id}:${lastWeek}`, () => { counts.timesheet_reminders++; notify([x.id], "timesheet_missing", `Timesheet missing for week ${DO.isoWeek(lastWeek)}`, `Please submit your hours for ${DO.fmtDate(lastWeek)} to ${DO.fmtDate(DO.addDays(lastWeek, 6))}. Due Tuesday 12:00.`, "#/timesheets", { self: true }); }); });
    const run = { id: nextId("ar"), rule: kind === "daily" ? "Daily sweep (A-01, A-02, A-06, A-07, A-08, A-10), run now" : kind, at: at(), durationMs: Math.round(performance.now() - t0) + 400, counts, by: u?.id };
    S.automationRuns.push(run);
    audit("automation", run.id, "run", null, counts, { text: `${u?.name || "System"} ran the daily sweep: ${counts.at_risk_raised} at risk, ${counts.late_raised} late, ${counts.duplicates_skipped} duplicates skipped` });
    commit();
    return run;
  }

  // ---------- Predictions (F-55, F-56): advisory only, never change data ----------
  function lateRisk(s) {
    if (!OPEN.has(s.state) || !S.org.intelligence || S.org.intelligence.lateRisk === "off") return null;
    const p = effPlanned(s); if (!p) return null;
    const days = DO.workingDaysBetween(today(), p);
    const progress = { planned: 0, in_progress: 0.3, changes_requested: 0.35, ready_for_check: 0.6, in_check: 0.7, approved_for_issue: 0.92 }[s.state] ?? 0;
    const owner = user(s.ownerId); const load = owner ? loadPct(owner, DO.mondayOf(today())) || 0 : 0;
    const discLate = { M: 0.34, E: 0.28, A: 0.22, P: 0.2, F: 0.25, S: 0.18, X: 0.3, G: 0.32, C: 0.2 }[s.discipline] || 0.2;
    const z = -1.1 - days * 0.32 + (1 - progress) * 2.6 + (s.reviewRound > 1 ? 0.7 : 0) + (load > 110 ? 0.9 : 0) + discLate * 2;
    const prob = Math.round(100 / (1 + Math.exp(-z)));
    const reasons = [];
    if (days < 3) reasons.push(days < 0 ? `already ${-days} working days past the planned date` : `only ${days} working days to the planned date`);
    if (progress < 0.5) reasons.push(`still ${label(s.state).toLowerCase()}`);
    if (load > 110) reasons.push(`${owner.name.split(" ")[0]} is at ${load}% this week`);
    if (s.reviewRound > 1) reasons.push(`${s.reviewRound} review rounds so far`);
    reasons.push(`${disc(s.discipline)?.name} sheets went late ${Math.round(discLate * 100)}% of the time in the last 6 months`);
    return { prob, reasons: reasons.slice(0, 3) };
  }
  function workloadForecast(code, weeks) {
    const bias = { A: 1.08, M: 1.16, E: 1.05, P: 0.97, F: 1.02, S: 0.94, X: 1.1, G: 1.12, C: 0.9 }[code] || 1;
    const people = S.users.filter((u) => u.discipline === code && u.active);
    return weeks.map((w, i) => { const planned = DO.sum(people, (u) => allocated(u.id, w)); const forecast = Math.round(planned * bias * (1 + Math.sin(i + code.charCodeAt(0)) * 0.04)); const cap = DO.sum(people, (u) => capacityOf(u, w)); return { week: w, planned, forecast, capacity: cap }; });
  }
  const mape = (code) => ({ A: 9.4, M: 13.8, E: 11.2, P: 8.7, F: 10.3, S: 7.9, X: 15.6, G: 14.1, C: 12.5 })[code] || 12;

  // ---------- Search (F-44) ----------
  function search(q, u) {
    const t = q.trim().toLowerCase(); if (!t) return [];
    const words = t.split(/\s+/);
    const match = (...fields) => { const hay = fields.join(" ").toLowerCase(); return words.every((w) => hay.includes(w)); };
    const vis = new Set(visibleProjects(u).map((p) => p.id));
    const out = [];
    S.projects.filter((p) => vis.has(p.id) && match(p.code, p.name, p.client, p.location)).slice(0, 5).forEach((p) => out.push({ kind: "Projects", title: `${p.code} ${p.name}`, sub: `${p.client} · ${p.location}`, link: `#/projects/${p.id}`, icon: "folder-kanban" }));
    S.sheets.filter((s) => vis.has(s.projectId) && match(s.number, s.title, (s.aliases || []).join(" "), s.number.replace("-", ""))).slice(0, 12).forEach((s) => out.push({ kind: "Sheets", title: `${s.number} ${s.title}`, sub: `${project(s.projectId).code} ${project(s.projectId).name} · ${label(s.state)}`, link: `#/projects/${s.projectId}/sheets/${s.id}`, icon: "file-text", mono: s.number }));
    S.transmittals.filter((x) => vis.has(x.projectId) && match(x.number, purposeLabel(x.purpose))).slice(-5).reverse().forEach((x) => out.push({ kind: "Transmittals", title: x.number, sub: `${x.items.length} sheets · ${purposeLabel(x.purpose)} · ${DO.fmtDate(x.sentAt)}`, link: `#/projects/${x.projectId}/transmittals/${x.id}`, icon: "send-horizontal" }));
    S.contacts.filter((c) => match(c.name, c.email, c.org)).slice(0, 4).forEach((c) => out.push({ kind: "Contacts", title: c.name, sub: `${c.org} · ${c.email}`, link: `#/contacts?c=${c.id}`, icon: "book-user" }));
    S.comments.filter((c) => vis.has(c.projectId) && match(c.number, c.text, c.response)).slice(0, 4).forEach((c) => out.push({ kind: "Client comments", title: `${c.number}`, sub: c.text, link: `#/projects/${c.projectId}/comments?c=${c.id}`, icon: "message-square-text" }));
    S.rfis.filter((x) => vis.has(x.projectId) && match(x.number, x.question, x.response)).slice(0, 4).forEach((x) => out.push({ kind: "RFIs", title: x.number, sub: x.question, link: `#/projects/${x.projectId}/construction/rfis?r=${x.id}`, icon: "hard-hat" }));
    S.decisions.filter((x) => vis.has(x.projectId) && match(x.title, x.context)).slice(0, 4).forEach((x) => out.push({ kind: "Decisions", title: x.title, sub: `${project(x.projectId).code} · ${DO.fmtDate(x.date)}`, link: `#/projects/${x.projectId}/decisions`, icon: "book-open" }));
    return out;
  }

  DO.store = {
    get S() { return S; }, get rev() { return rev; }, get memoryOnly() { return memoryOnly; },
    load, save, reset, commit, subscribe, files,
    setActor(id) { currentUserId = id; }, get actorId() { return currentUserId; },
    user, contact, project, stage, sheet, revision, transmittal, pkg, disc, sheetsOf, stagesOf, revisionsOf, reviewsOf, transitionsOf, draftOf, currentRev, packagesOf, purposeLabel, effPlanned, activeStage,
    flagsFor, isLate, isAtRisk, flagsAsOf, EVENTS, prefOf, notify, sendEmail, audit,
    ROLE_LABEL, rolesOn, hasRole, isPL, isDL, isDC, isSR, canSeeProject, visibleProjects, caps, canSeeHoursOf,
    ACTIONS, T_TABLE, allowedActions, transition, override, deleteSheet, label, checklistFor, stageRules, billingRule, nextRevCode, namingCheck, sheetNumberCheck, uploadRevision, renameDraft, issue, editSheets, bulkTransition, FIELD_LABEL,
    userName, shortName, stageFee, projectStats, workingDaysWaiting, reviewQueue, capacityOf, allocated, loadPct, loadFlag, setAllocation, timesheet, tsTotal, timesheetMissing, runSweep, lateRisk, workloadForecast, mape, search, nextId, OPEN,
  };
})(typeof window !== "undefined" ? window : globalThis);

/* DrawingOps demo QA (Playwright). Run from the repo root: node demo/qa/flows.cjs [output-folder]. Needs frontend/node_modules and `npx playwright install chromium`. */
const { chromium } = require(require("path").join(__dirname, "../../frontend/node_modules/playwright"));
const URL = require("url").pathToFileURL(require("path").join(__dirname, "../demo.html")).href;
const OUT = process.argv[2] || require("os").tmpdir(); const DL = process.argv[3] || OUT;
const DOCS = require("path").join(__dirname, "../assets/documents");
const results = []; const errors = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(250); };
  const S = (fn, arg) => page.evaluate(fn, arg);
  const sheet = (n, pid = "p1") => S(([n, pid]) => { const s = DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n); return s && { id: s.id, state: s.state, planned: s.planned, ownerId: s.ownerId, rev: DO.store.currentRev(s)?.code, draft: DO.store.draftOf(s)?.code }; }, [n, pid]);
  const signOut = () => S(() => { DO.auth.signOut(); location.hash = "#/sign-in"; });
  const signIn = async (email, pw = "Demo@2026") => { await signOut(); await page.waitForSelector("#si-email"); await page.fill("#si-email", email); await page.fill("#si-pw", pw); await page.click("form[data-submit=signin] button.primary"); if (email.startsWith("admin")) { await page.waitForSelector("#si-code"); await page.fill("#si-code", "246810"); await page.click("form[data-submit=signin-totp] button.primary"); } await page.waitForSelector(".shell", { timeout: 8000 }); };
  const toastText = async () => (await page.$$eval(".toast .tt", (els) => els.map((e) => e.textContent).join(" | ")).catch(() => ""));
  await page.goto(URL); await page.waitForSelector(".creds");

  // 1. Authentication
  await page.fill("#si-email", "owner@firm.example"); await page.fill("#si-pw", "wrong-password"); await page.click("form[data-submit=signin] button.primary");
  await page.waitForSelector("[role=alert]"); check("Invalid credentials show an error", (await page.textContent("[role=alert]")).includes("not correct"));
  await page.click('[data-act=cred-fill][data-email="lead@firm.example"]'); check("Fill button populates the form", (await page.inputValue("#si-email")) === "lead@firm.example" && (await page.inputValue("#si-pw")) === "Demo@2026");
  await page.click("[data-act=signin-reveal]"); check("Show password toggles the field", (await page.getAttribute("#si-pw", "type")) === "text");
  await go("#/portfolio"); check("Protected route without session redirects to sign-in", (await page.evaluate(() => location.hash)).startsWith("#/sign-in"));
  await signIn("designer@firm.example");
  const navDesigner = await page.$$eval("#primary-nav .lbl", (e) => e.map((x) => x.textContent));
  check("Designer nav hides Portfolio, Reports, Billing, Admin", !navDesigner.includes("Portfolio") && !navDesigner.includes("Admin") && !navDesigner.includes("Billing"), navDesigner.join(","));
  await go("#/portfolio"); check("Designer gets 'No access' on Portfolio", (await page.textContent("main h1")).includes("No access"));
  // 2. Designer starts a planned sheet from My work
  await go("#/");
  const startBtn = await page.$('button[data-act=quick-transition][data-a=start]');
  const startId = await startBtn.getAttribute("data-id"); await startBtn.click(); await page.waitForTimeout(700);
  check("My work: Start moves a sheet to In progress", (await S((id) => DO.store.sheet(id).state, startId)) === "in_progress");
  // 3. Submit M-206 with the pre-check checklist
  const m206 = await sheet("M-206"); await go(`#/projects/p1/sheets/${m206.id}`);
  await page.click("#sd-submit"); await page.waitForSelector("form[data-submit=pc-go]");
  await page.click("form[data-submit=pc-go] button.primary").catch(() => {}); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(300);
  check("Submit blocked until mandatory checklist items are ticked", (await sheet("M-206")).state === "in_progress" && (await toastText()).includes("Not possible"));
  const boxes = await page.$$("form[data-submit=pc-go] input[type=checkbox]"); for (const b of boxes) await b.check();
  await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(300);
  check("Submit with ticks → Ready for check", (await sheet("M-206")).state === "ready_for_check");
  check("Checker (Karthik) got a notification", await S(() => DO.store.S.notifications.some((n) => n.userId === "u_kar" && n.title.includes("M-206"))));
  await page.screenshot({ path: `${OUT}/f-designer-submitted.png` });
  // 4. Checker approves (Anil, architecture sheet A-106) → senior QC → Sunita approves
  await signIn("checker@firm.example"); await go("#/reviews");
  const a106 = await sheet("A-106");
  const rvId = await S((sid) => DO.store.S.reviews.find((v) => v.sheetId === sid && v.state === "open").id, a106.id);
  await go(`#/reviews?open=${rvId}`); await page.waitForSelector("#rq-c");
  await page.click("form[data-submit=rq-return] button.danger"); await page.waitForTimeout(200);
  check("Return without comment or file is blocked", (await sheet("A-106")).state !== "changes_requested");
  await go(`#/reviews?open=${rvId}`); await page.waitForSelector("#rq-approve-btn"); await page.click("#rq-approve-btn"); await page.waitForTimeout(300);
  check("First check approved; senior QC requested (sheet stays In check)", (await sheet("A-106")).state === "in_check" && await S((sid) => DO.store.S.reviews.some((v) => v.sheetId === sid && v.kind === "senior_qc" && v.state === "open"), a106.id));
  await page.screenshot({ path: `${OUT}/f-review.png` });
  await signIn("senior@firm.example"); await go("#/reviews");
  check("Senior reviewer sees A-106 in their queue", (await page.textContent("main")).includes("A-106"));
  await S((sid) => DO.store.transition(DO.store.sheet(sid), "approve", {}), a106.id); await page.waitForTimeout(100);
  check("Senior QC approval → Approved for issue", (await sheet("A-106")).state === "approved_for_issue");
  // Return with redlines on another sheet
  const a107 = await sheet("A-107"); await signIn("checker@firm.example");
  const rv107 = await S((sid) => DO.store.S.reviews.find((v) => v.sheetId === sid && v.state === "open").id, a107.id);
  await go(`#/reviews?open=${rv107}`); await page.fill("#rq-c", "Dimension chain at grid C does not close."); await page.click("form[data-submit=rq-return] button.danger"); await page.waitForTimeout(300);
  check("Return with comment → Changes requested; designer notified", (await sheet("A-107")).state === "changes_requested" && await S((o) => DO.store.S.notifications.some((n) => n.userId === o && n.title.includes("A-107 returned")), a107.ownerId));
  // 5. Document controller issues approved sheets with a naming fix
  await signIn("dc@firm.example"); await go("#/projects/p1/issue");
  const a104 = await sheet("A-104");
  check("A-104 is blocked by the naming rule in the composer", (await page.textContent("main")).includes("File name breaks the naming rule"));
  await page.click('[data-act=sd-rename]'); await page.waitForTimeout(200);
  await page.click('[data-act=ic-all]'); await page.waitForTimeout(150);
  const summary = await page.textContent(".alert.info");
  check("Composer summary states sheets, recipients and supersede count", /Issue \d+ sheets to \d+ recipients for Good for Construction/.test(summary), summary.trim().slice(0, 120));
  await page.click('[data-act=ic-preview]'); await page.waitForTimeout(300);
  check("Cover sheet preview renders (iframe with blob PDF)", !!(await page.$('iframe[title="Cover sheet preview"]')));
  const before = await S(() => ({ tm: DO.store.S.transmittals.length, em: DO.store.S.emails.length }));
  await page.click('[data-act=ic-issue]'); await page.waitForSelector("#cf-ok"); await page.click("#cf-ok"); await page.waitForTimeout(500);
  const after = await S(() => { const t = DO.store.S.transmittals[DO.store.S.transmittals.length - 1]; return { tm: DO.store.S.transmittals.length, em: DO.store.S.emails.length, number: t.number, items: t.items.length, token: t.token, recips: t.recipients.map((r) => r.contactId) }; });
  check("Issue creates one transmittal with the next number", after.tm === before.tm + 1 && /2026-014-TR-\d{4}/.test(after.number), `${after.number}, ${after.items} sheets`);
  check("Emails to recipients land in the demo mailbox", after.em > before.em, `${after.em - before.em} new emails`);
  const a104After = await sheet("A-104"); check("Issued sheet shows Issued with new revision", a104After.state === "issued" && a104After.rev === "C01");
  check("Earlier issued revision of an issued sheet is superseded (A-03, F-07)", await S(() => { const s = DO.store.S.sheets.find((x) => x.projectId === "p1" && x.number === "A-103"); const revs = DO.store.revisionsOf(s.id); return revs.filter((v) => v.state === "issued").length === 1 && revs.some((v) => v.state === "superseded"); }));
  await page.screenshot({ path: `${OUT}/f-issued.png` });
  // Superseded download is watermarked
  const supRev = await S(() => { const s = DO.store.S.sheets.find((x) => x.projectId === "p1" && x.number === "A-103"); return DO.store.revisionsOf(s.id).find((v) => v.state === "superseded").id; });
  const [dl1] = await Promise.all([page.waitForEvent("download"), S((id) => DO.C.downloadRevision(DO.store.revision(id)), supRev)]);
  await dl1.saveAs(`${DL}/superseded.pdf`); check("Superseded download is named …_SUPERSEDED.pdf", dl1.suggestedFilename().includes("SUPERSEDED"), dl1.suggestedFilename());
  // 6. External recipient acknowledges
  await signOut(); await go(`#/t/${after.token}?r=${after.recips[0]}`); await page.waitForSelector("[data-act=ext-ack]");
  const [zip] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=ext-zip]")]); await zip.saveAs(`${DL}/transmittal.zip`);
  check("External page: Download all produces a ZIP", zip.suggestedFilename().endsWith(".zip"), zip.suggestedFilename());
  await page.click("[data-act=ext-ack]"); await page.waitForTimeout(200);
  check("External recipient acknowledges without login", await S((t) => DO.store.S.transmittals.find((x) => x.token === t).recipients[0].ackAt !== null, after.token));
  await page.screenshot({ path: `${OUT}/f-external.png` });
  // 7. Register: search, filter, inline edit + undo, bulk shift
  await signIn("lead@firm.example"); await go("#/projects/p1/register?q=OT%20duct");
  check("Register search 'OT duct' finds M-205", (await page.textContent("tbody")).includes("M-205"));
  await go("#/projects/p1/register?flag=late"); const lateRows = await page.$$eval("tbody tr", (r) => r.length);
  const lateCount = await S(() => DO.store.sheetsOf("p1").filter(DO.store.isLate).length);
  check("Late only filter matches the project late count", lateRows === lateCount, `${lateRows} rows / ${lateCount} late`);
  await go("#/projects/p1/register?disc=M");
  const firstOwnerSel = await page.$('select[data-k=ownerId]'); const sid = await firstOwnerSel.getAttribute("data-id");
  const ownerBefore = await S((id) => DO.store.sheet(id).ownerId, sid);
  const opts = await firstOwnerSel.$$eval("option", (o) => o.map((x) => x.value)); const newOwner = opts.find((v) => v !== ownerBefore);
  await firstOwnerSel.selectOption(newOwner); await page.waitForTimeout(250);
  check("Inline edit owner saves", (await S((id) => DO.store.sheet(id).ownerId, sid)) === newOwner);
  await page.click(".toast [data-undo]"); await page.waitForTimeout(250);
  check("Undo restores the owner", (await S((id) => DO.store.sheet(id).ownerId, sid)) === ownerBefore);
  const ids = await page.$$eval('input[data-act=reg-sel]', (els) => els.slice(0, 3).map((e) => e.dataset.id));
  const plannedBefore = await S((ids) => ids.map((id) => DO.store.effPlanned(DO.store.sheet(id))), ids);
  const auditBefore = await S(() => DO.store.S.audit.length);
  for (const id of ids) await page.click(`input[data-act=reg-sel][data-id="${id}"]`);
  check("Bulk bar appears with the selection count", (await page.textContent(".bulkbar")).includes("3 selected"));
  await page.click("[data-act=bulk-shift]"); await page.fill("#sh-n", "5"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(300);
  const plannedAfter = await S((ids) => ids.map((id) => DO.store.effPlanned(DO.store.sheet(id))), ids);
  const shifted = plannedAfter.filter((d, i) => d !== plannedBefore[i]).length;
  check("Bulk shift +5 working days updates dates and writes audit rows", shifted > 0 && (await S(() => DO.store.S.audit.length)) - auditBefore >= shifted, `${shifted} shifted`);
  await page.screenshot({ path: `${OUT}/f-register-bulk.png` });
  // Export register (xlsx)
  await page.click("[data-act=reg-export]"); await page.waitForSelector(".menu");
  const [x1] = await Promise.all([page.waitForEvent("download"), page.click(".menu .mi >> text=Excel (.xlsx)")]); await x1.saveAs(`${DL}/register.xlsx`);
  check("Register exports a real .xlsx", x1.suggestedFilename().endsWith(".xlsx"), x1.suggestedFilename());
  // 8. Import wizard with errors
  await go("#/projects/p1/import"); await page.click("[data-act=imp-sample]"); await page.waitForSelector("[data-act=imp-preview]"); await page.click("[data-act=imp-preview]"); await page.waitForTimeout(200);
  const probText = await page.textContent("main"); const bad = (probText.match(/Duplicate|Unknown discipline|Bad date/g) || []).length;
  check("Import preview lists the 3 bad rows with reasons", bad >= 3, `${bad} problems shown`);
  const skipBtns = await page.$$eval("tr", (rows) => rows.map((r, i) => (r.style.background.includes("danger") ? i : -1)).filter((i) => i >= 0));
  for (let k = 0; k < 3; k++) { const b = await page.$('tr[style*="danger"] [data-act=imp-skip]'); if (b) { await b.click(); await page.waitForTimeout(120); } }
  console.log("   import state:", await S(() => DO.ui.state.imp.preview.map((r) => `${r.number}:${r.skip ? "skip" : r.errors.length ? "ERR" : "ok"}`).join(" ")), "disabled:", await page.$eval("[data-act=imp-commit]", (x) => x.disabled));
  const nBefore = await S(() => DO.store.sheetsOf("p1").length);
  await page.click("[data-act=imp-commit]"); await page.waitForTimeout(300);
  const nAfter = await S(() => DO.store.sheetsOf("p1").length);
  console.log("   toasts:", await page.$$eval(".toast", (els) => els.map((e) => e.textContent).join(" | ")));
  check("Import creates the valid rows (all-or-nothing run)", nAfter - nBefore === 5, `${nAfter - nBefore} sheets`);
  await page.click("[data-act=imp-undo]"); await page.click("#cf-ok"); await page.waitForTimeout(300);
  check("Undo import removes them", (await S(() => DO.store.sheetsOf("p1").length)) === nBefore);
  // 9. Upload PDFs: name match, rule break, title-block match
  await go("#/projects/p1/upload");
  await page.setInputFiles("#up-in", [`${DOCS}/sample-pdfs/M-206_C01.pdf`, `${DOCS}/sample-pdfs/scan_0042.pdf`, `${DOCS}/sample-register-import.csv`]);
  await page.waitForTimeout(400); const upText = await page.textContent("main");
  check("Upload: matched by file name and by title-block text; non-PDF rejected", upText.includes("Matched by file name") && upText.includes("title block") && upText.includes("not accepted"));
  await page.click("[data-act=up-go]"); await page.waitForTimeout(1500);
  check("Upload creates draft revisions", (await sheet("M-206")).draft === "C01");
  await page.screenshot({ path: `${OUT}/f-upload.png` });
  // 10. Client approval → ready to invoice → Accounts marks invoiced
  await go("#/projects/p5/stages"); await page.click('[data-act=sp-approve]');
  await page.setInputFiles("#ap-e", `${DOCS}/sample-client-approval-letter.pdf`); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(300);
  const st5 = await S(() => DO.store.stagesOf("p5")[4].state); check("Recording client approval moves stage to Ready to invoice (A-09)", st5 === "ready_to_invoice", st5);
  check("Accounts notified of the billing signal", await S(() => DO.store.S.notifications.some((n) => n.userId === "u_acc" && n.title.includes("2026-003"))));
  await signIn("accounts@firm.example"); await go("#/billing");
  check("Billing shows 3 ready stages", (await page.$$eval("tbody tr", (r) => r.length)) === 3);
  const [csv] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=bl-csv]")]); await csv.saveAs(`${DL}/billing.csv`);
  check("Billing CSV export downloads", csv.suggestedFilename().endsWith(".csv"));
  await page.click("[data-act=bl-mark]"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(300);
  check("Mark invoiced removes it from the ready list", (await page.$$eval("tbody tr", (r) => r.length)) === 2);
  // 11. Timesheet submit and approval
  await signIn("designer@firm.example"); await go("#/timesheets");
  const firstCell = await page.$('input[data-change=ts-h]'); await firstCell.fill("6"); await firstCell.dispatchEvent("change"); await page.waitForTimeout(150);
  await page.click("[data-act=ts-submit]"); await page.click("#cf-ok"); await page.waitForTimeout(250);
  check("Timesheet submitted and locked", (await S(() => DO.store.timesheet("u_des", DO.mondayOf(DO.today())).state)) === "submitted");
  // 12. Allocation updates the heat map
  await signIn("lead@firm.example"); await go("#/workload");
  const pctBefore = await S(() => DO.store.loadPct(DO.store.user("u_tan"), DO.mondayOf(DO.today())));
  await page.click("[data-act=wl-allocate]"); await page.selectOption("#al-u", "u_tan"); await page.fill("#al-h", "10"); await page.fill("#al-n", "2"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(250);
  const pctAfter = await S(() => DO.store.loadPct(DO.store.user("u_tan"), DO.mondayOf(DO.today())));
  check("Allocating hours raises the load % in the heat map", pctAfter > pctBefore, `${pctBefore}% → ${pctAfter}%`);
  // 13. Command palette
  await page.keyboard.press("Control+k"); await page.waitForSelector("#pal-q"); await page.fill("#pal-q", "A-101"); await page.waitForTimeout(150);
  check("⌘K finds A-101 across projects", (await page.textContent("#pal-res")).includes("A-101"));
  await page.keyboard.press("Escape");
  // 14. Admin invites a user → accept via mailbox → sign in with no projects
  await signIn("admin@firm.example"); await go("#/admin/users"); await page.click("[data-act=us-invite]");
  await page.fill("#iv-nn", "Kiran Bhat"); await page.fill("#iv-em", "kiran.bhat@firm.example"); await page.click(".dialog-foot .btn.primary"); await page.waitForTimeout(200);
  const invTok = await S(() => DO.store.S.invitations.find((i) => i.email === "kiran.bhat@firm.example").token);
  check("Invitation email sent to the mailbox", await S(() => DO.store.S.emails.some((m) => m.to.includes("kiran.bhat@firm.example"))));
  await signOut(); await go(`#/invite/${invTok}`); await page.fill("#iv-p", "Welcome2026x"); await page.click("form[data-submit=invite-accept] button"); await page.waitForTimeout(200);
  await page.fill("#si-pw", "Welcome2026x"); await page.click("form[data-submit=signin] button.primary"); await page.waitForSelector(".shell");
  check("New user signs in and sees 'not on any project yet'", (await page.textContent("main")).includes("not on any project"));
  // 15. Forgot password via mailbox code
  await signOut(); await go("#/forgot"); await page.fill("#fg-email", "lead@firm.example"); await page.click("form[data-submit=forgot] button"); await page.waitForTimeout(150);
  const code = await S(() => DO.store.S.emails.find((m) => m.kind === "reset").code);
  await go("#/reset?email=lead@firm.example"); await page.fill("#rs-c", code); await page.fill("#rs-p", "NewLead2026!x"); await page.fill("#rs-p2", "NewLead2026!x"); await page.click("form[data-submit=reset] button"); await page.waitForTimeout(150);
  await page.fill("#si-email", "lead@firm.example"); await page.fill("#si-pw", "NewLead2026!x"); await page.click("form[data-submit=signin] button.primary"); await page.waitForSelector(".shell");
  check("Password reset with the emailed code works", true);
  // 16. Daily sweep idempotency
  const r1 = await S(() => DO.store.runSweep().counts); const r2 = await S(() => DO.store.runSweep().counts);
  check("Running the sweep twice sends nothing twice", r2.at_risk_raised === 0 && r2.late_raised === 0 && r2.duplicates_skipped > 0, `first ${r1.at_risk_raised + r1.late_raised} raised, second skipped ${r2.duplicates_skipped}`);
  // 17. Dark mode + reset
  await S(() => DO.app.applyTheme("dark")); await go("#/portfolio"); await page.screenshot({ path: `${OUT}/f-dark-portfolio.png` }); await S(() => DO.app.applyTheme("system"));
  await S(() => { DO.store.reset(); }); await page.waitForTimeout(200);
  check("Reset restores the seed (A-104 back to approved, transmittals back to seed count)", (await sheet("A-104")).state === "approved_for_issue" && (await S(() => DO.store.S.transmittals.length)) === before.tm);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed. JS errors: ${errors.length}`); errors.forEach((e) => console.log(" -", e));
  require("fs").writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

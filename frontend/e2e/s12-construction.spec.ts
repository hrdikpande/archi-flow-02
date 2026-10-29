/** Phase 3 (S12–S16): an RFI answered with a new revision; a submittal stamped; a site report
 * filed from a phone; a change order approved; a clash report imported; knowledge search. */
import { expect, test } from "@playwright/test";

import { apiCall, approveSheet, as, freshProject, onePagePdf, STATE } from "./support";

const NAVIS = `<?xml version="1.0" encoding="UTF-8"?>
<exchange><batchtest name="Coordination"><clashtests><clashtest name="Mech v Struct"><clashresults>
<clashresult name="Clash1" guid="e2e-${Date.now()}" status="new"><description>Duct hits beam</description></clashresult>
</clashresults></clashtest></clashtests></batchtest></exchange>`;

test("construction logs end to end", async ({ browser }) => {
  test.setTimeout(240_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets } = await freshProject(lead, { sheets: ["A-301"] });
  const designer = await as(browser, STATE.designer);
  const checker = await as(browser, STATE.checker);
  const dc = await as(browser, STATE.dc);
  for (const p of [designer, checker, dc]) await p.goto("/");
  await approveSheet(designer, checker, sheets[0]!.id, "A-301");
  const contact = await apiCall<{ id: string }>(lead, "POST", "/api/v1/contacts", { full_name: `Site ${Date.now()}`, email: `s${Date.now()}@x.example` });
  await apiCall(dc, "POST", `/api/v1/projects/${project.id}/transmittals`, { sheet_ids: [sheets[0]!.id], purpose: "GFC", contact_ids: [contact.id] });
  const stamp = Date.now().toString(36);
  const base = `/projects/${project.id}/construction`;

  await test.step("DC logs an RFI; the DL answers it and starts the next revision", async () => {
    await dc.goto(`${base}/rfis`);
    await dc.getByRole("button", { name: "Log RFI" }).click();
    const drawer = dc.getByRole("dialog", { name: "Log RFI" });
    await drawer.getByLabel("Subject").fill(`Lintel over D-04 ${stamp}`);
    await drawer.getByLabel("Question").fill("Size of the lintel over door D-04 and the OT ceiling HEPA housing?");
    await drawer.getByLabel("Response due").fill(new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
    await drawer.getByLabel("Assignee").selectOption({ label: "Anil Kapoor" });
    await drawer.getByRole("button", { name: "Log RFI" }).click();
    await expect(dc.getByRole("row", { name: new RegExp(stamp) })).toContainText("Open");
    await checker.goto(`${base}/rfis`);
    await checker.getByRole("button", { name: new RegExp(stamp) }).click();
    await checker.getByLabel("Answer").fill("230 deep RCC lintel; HEPA housing 610 x 610.");
    await checker.getByRole("button", { name: /^Start next revision of/ }).click();
    await checker.getByRole("checkbox", { name: /A-301/ }).check();
    await checker.keyboard.press("Escape");
    await checker.getByRole("button", { name: "Send answer" }).click();
    await expect(checker.getByText(/Next revision started: A-301/).first()).toBeVisible();
    const sheet = await apiCall<{ state: string }>(lead, "GET", `/api/v1/sheets/${sheets[0]!.id}/detail`);
    expect(sheet.state).toBe("in_progress");
  });

  await test.step("a submittal is reviewed and the PDF stamped", async () => {
    await dc.goto(`${base}/submittals`);
    await dc.getByRole("button", { name: "Log submittal" }).click();
    const drawer = dc.getByRole("dialog", { name: "Log submittal" });
    await drawer.getByLabel("Title").fill(`Fire damper shop drawings ${stamp}`);
    await drawer.getByLabel("Reviewer").selectOption({ label: "Anil Kapoor" });
    await drawer.getByLabel("Submittal PDF").setInputFiles({ name: "damper.pdf", mimeType: "application/pdf", buffer: onePagePdf("Damper") });
    await drawer.getByRole("button", { name: "Log submittal" }).click();
    await checker.goto(`${base}/submittals`);
    await checker.getByRole("button", { name: new RegExp(`Fire damper shop drawings ${stamp}`) }).click();
    await checker.getByLabel("Review status").selectOption({ label: "Approved as noted" });
    await checker.getByLabel("Comment").fill("Add access panels at 6 m centres.");
    await checker.getByRole("button", { name: "Stamp and return" }).click();
    await expect(checker.getByRole("link", { name: "Stamped PDF" })).toBeVisible();
    await checker.keyboard.press("Escape");
    await expect(checker.getByRole("row", { name: new RegExp(stamp) })).toContainText("Approved as noted");
  });

  await test.step("the designer files a site report from a phone", async () => {
    const phone = await (await browser.newContext({ storageState: STATE.designer, viewport: { width: 360, height: 780 }, isMobile: true })).newPage();
    await phone.goto(`${base}/site`);
    await phone.getByRole("button", { name: "New report" }).click();
    await phone.getByLabel("What did you see?").fill(`Crack in slab at grid C/4 ${stamp}`);
    await phone.getByLabel("Action", { exact: true }).fill("Contractor to inject epoxy");
    await phone.getByRole("button", { name: "Add observation" }).click();
    await expect(phone.getByText(`Crack in slab at grid C/4 ${stamp}`)).toBeVisible();
    await phone.getByRole("button", { name: "File report" }).click();
    await phone.getByRole("dialog").getByRole("button", { name: "File report" }).click();
    await expect(phone.getByRole("link", { name: "Download PDF" })).toBeVisible();
    expect(await phone.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(360);
  });

  await test.step("a change order is approved by the PL", async () => {
    await dc.goto(`${base}/changes`);
    await dc.getByRole("button", { name: "Log change" }).click();
    const drawer = dc.getByRole("dialog", { name: "Log change order" });
    await drawer.getByLabel("Title").fill(`Add scrub sink ${stamp}`);
    await drawer.getByLabel("Description").fill("Client asked for a scrub sink outside OT-2.");
    await drawer.getByLabel("Cost impact (₹)").fill("85000");
    await drawer.getByRole("button", { name: "Log change" }).click();
    await lead.goto(`${base}/changes`);
    await lead.getByRole("button", { name: new RegExp(`Add scrub sink ${stamp}`) }).click();
    await lead.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(lead.getByRole("dialog").getByText(/^Decided by/)).toBeVisible();
    await lead.keyboard.press("Escape");
    await expect(lead.getByRole("row", { name: new RegExp(stamp) })).toContainText("Approved");
    await expect(lead.getByRole("row", { name: new RegExp(stamp) })).toContainText("₹85,000");
  });

  await test.step("the lead imports a Navisworks clash report", async () => {
    await lead.goto(`${base}/clashes`);
    await lead.locator('input[type="file"]').setInputFiles({ name: "clashes.xml", mimeType: "application/xml", buffer: Buffer.from(NAVIS) });
    await expect(lead.getByText(/clashes.xml imported/).first()).toBeVisible();
    await expect(lead.getByRole("row", { name: /Mech v Struct · Clash1/ })).toContainText("Open");
  });

  await test.step("knowledge search finds the RFI across projects", async () => {
    await lead.goto("/knowledge");
    await lead.getByLabel("Search knowledge").fill("OT ceiling HEPA");
    await expect(lead.getByRole("link", { name: new RegExp(`Lintel over D-04 ${stamp}`) })).toBeVisible();
  });
});

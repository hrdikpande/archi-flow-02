/** S9 (P2): client approval on an issued stage makes it ready to invoice (A-09); Accounts see
 * it, export the CSV and mark it invoiced; a site user opens the current set on a phone. */
import { expect, test } from "@playwright/test";

import { apiCall, approveSheet, as, freshProject, MAILPIT, onePagePdf, STATE } from "./support";

test("ready to invoice, mark invoiced, and the site view", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets, stages } = await freshProject(lead, { sheets: ["A-901"] });
  const stage = stages[0]!;
  const designer = await as(browser, STATE.designer);
  const checker = await as(browser, STATE.checker);
  await designer.goto("/");
  await checker.goto("/");
  await approveSheet(designer, checker, sheets[0]!.id, "A-901");
  const stamp = Date.now().toString(36);
  const contact = await apiCall<{ id: string; email: string }>(lead, "POST", "/api/v1/contacts", { full_name: `Site ${stamp}`, email: `site.${stamp}@contractor.example` });
  const dc = await as(browser, STATE.dc);
  await dc.goto("/");
  await apiCall(dc, "POST", `/api/v1/projects/${project.id}/transmittals`, { sheet_ids: [sheets[0]!.id], purpose: "GFC", contact_ids: [contact.id] });

  await test.step("the stage's deliverables are issued; the PL records approval", async () => {
    await expect.poll(async () => (await apiCall<{ id: string; state: string }[]>(lead, "GET", `/api/v1/projects/${project.id}/stages`)).find((s) => s.id === stage.id)?.state, { timeout: 30_000 }).toBe("deliverables_issued");
    await lead.goto(`/projects/${project.id}/stages`);
    await lead.getByRole("row", { name: new RegExp(stage.name) }).getByRole("button", { name: "Record client approval" }).click();
    const drawer = lead.getByRole("dialog", { name: /Client approval/ });
    await drawer.getByLabel("Approved by").fill("Dr Rao");
    await drawer.getByLabel("Evidence").setInputFiles({ name: "approval.pdf", mimeType: "application/pdf", buffer: onePagePdf("Approved") });
    await drawer.getByRole("button", { name: "Record approval" }).click();
    await expect.poll(async () => (await apiCall<{ id: string; state: string }[]>(lead, "GET", `/api/v1/projects/${project.id}/stages`)).find((s) => s.id === stage.id)?.state, { timeout: 30_000 }).toBe("ready_to_invoice");
  });

  await test.step("Accounts see it, export the CSV and mark it invoiced", async () => {
    const accounts = await as(browser, STATE.accounts);
    await accounts.goto("/billing");
    const row = accounts.getByRole("row", { name: new RegExp(project.code) });
    await expect(row).toContainText(stage.name);
    const download = accounts.waitForEvent("download");
    await accounts.getByRole("link", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toBe("ready-to-invoice.csv");
    await row.getByRole("button", { name: "Mark invoiced" }).click();
    await accounts.getByLabel("Invoice number (optional)").fill(`INV-${stamp}`);
    await accounts.getByRole("dialog").getByRole("button", { name: "Mark invoiced" }).click();
    await expect(accounts.getByText(/marked invoiced/).first()).toBeVisible();
    await accounts.getByRole("link", { name: "Invoiced" }).click();
    await expect(accounts.getByRole("row", { name: new RegExp(project.code) })).toContainText(`INV-${stamp}`);
  });

  await test.step("a site engineer opens the current set on a phone", async () => {
    await lead.goto(`/projects/${project.id}/transmittals`);
    await lead.getByLabel("Contact").selectOption({ label: `Site ${stamp} · ${contact.email}` });
    await lead.getByRole("button", { name: "Email site link" }).click();
    await expect(lead.getByText(/Site link emailed/).first()).toBeVisible();
    let url = "";
    await expect.poll(async () => {
      const list = (await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${contact.email} subject:"current drawings"`)}`)).json()) as { messages: { ID: string }[] };
      if (!list.messages[0]) return "";
      const body = (await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string };
      url = /https?:\/\/\S+\/site\/[\w-]+\//.exec(body.Text)?.[0].replace(/^https?:\/\/[^/]+/, "") ?? "";
      return url;
    }, { timeout: 30_000 }).not.toBe("");
    const phone = await (await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true })).newPage();
    await phone.goto(url);
    await expect(phone.getByRole("heading", { name: "Current drawings" })).toBeVisible();
    const item = phone.getByRole("link", { name: /A-901/ });
    await expect(item).toBeVisible();
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44); // S-18 tap targets
    expect(await phone.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(360);
  });
});

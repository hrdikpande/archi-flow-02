/** S7 (P2): pre-check list blocks submit until ticked (F-13); the checker's delegate gets the
 * review while they are away (F-12); a recipient acknowledges receipt (F-15). */
import { expect, test } from "@playwright/test";

import { apiCall, as, CHECKER, freshProject, LEAD, MAILPIT, STATE, uploadDraft } from "./support";

test("pre-check, delegation and acknowledgement", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const admin = await as(browser, STATE.admin);
  await admin.goto("/");
  const stamp = Date.now().toString(36);
  const checklist = await apiCall<{ id: string }>(admin, "POST", "/api/v1/checklists", {
    name: `Pre-check ${stamp}`, stage_names: [], items: [{ text: `North point ${stamp}`, mandatory: true }, { text: "Room data", mandatory: false }],
  });
  const checker = await as(browser, STATE.checker);
  await checker.goto("/");
  let delegationId: string | undefined;
  try {
    const lead = await as(browser, STATE.lead);
    await lead.goto("/");
    const { project, sheets, byEmail } = await freshProject(lead, { sheets: ["A-701"] });
    const sheet = sheets[0]!;
    const designer = await as(browser, STATE.designer);
    await designer.goto("/");
    await apiCall(designer, "POST", `/api/v1/sheets/${sheet.id}/transitions`, { action: "start" });
    await uploadDraft(designer, sheet.id, "A-701");

    await test.step("designer must tick the required item to submit", async () => {
      await designer.goto(`/projects/${project.id}/sheets/${sheet.id}`);
      await designer.getByRole("toolbar", { name: "Sheet actions" }).getByRole("button", { name: "Submit for check" }).click();
      const dialog = designer.getByRole("dialog", { name: /Submit A-701 for check/ });
      const submit = dialog.getByRole("button", { name: "Submit for check" });
      await expect(submit).toBeDisabled();
      await dialog.getByLabel(new RegExp(`North point ${stamp}`)).check();
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(designer.getByText("A-701: submitted for check").first()).toBeVisible();
    });

    await test.step("checker sets the PL as delegate; the PL sees the review", async () => {
      await checker.goto("/reviews");
      await checker.getByRole("button", { name: "Away? Set a delegate" }).click();
      const drawer = checker.getByRole("dialog", { name: "Review delegation" });
      await drawer.getByLabel("Delegate").fill("Priya");
      await checker.getByRole("option", { name: new RegExp(LEAD) }).click();
      await drawer.getByRole("button", { name: "Set delegate" }).click();
      await expect(checker.getByText(/Reviews go to Priya S/).first()).toBeVisible();
      delegationId = (await apiCall<{ id: string; user: string }[]>(checker, "GET", "/api/v1/delegations")).find((d) => d.user === byEmail(CHECKER))?.id;
      await lead.goto("/reviews");
      const row = lead.getByRole("row", { name: /A-701/ });
      await expect(row).toContainText(/for Anil K/);
      await row.getByRole("button", { name: "Open" }).click();
      await expect(lead.getByText(/Covering for Anil Kapoor/)).toBeVisible();
      await expect(lead.getByRole("region", { name: "Designer's pre-check" })).toContainText(`North point ${stamp}`);
    });

    await test.step("a recipient acknowledges receipt; the transmittal shows it", async () => {
      await apiCall(lead, "POST", `/api/v1/sheets/${sheet.id}/transitions`, { action: "start_check" });
      await apiCall(lead, "POST", `/api/v1/sheets/${sheet.id}/transitions`, { action: "approve" });
      const contact = await apiCall<{ id: string; email: string }>(lead, "POST", "/api/v1/contacts", { full_name: `Ack ${stamp}`, email: `ack.${stamp}@client.example` });
      const dc = await as(browser, STATE.dc);
      await dc.goto("/");
      const t = await apiCall<{ id: string; number: string }>(dc, "POST", `/api/v1/projects/${project.id}/transmittals`, {
        sheet_ids: [sheet.id], purpose: "GFC", contact_ids: [contact.id],
      });
      let token = "";
      await expect.poll(async () => {
        const list = (await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${contact.email}`)}`)).json()) as { messages: { ID: string }[] };
        if (!list.messages[0]) return "";
        const body = (await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string };
        token = /\/t\/([\w-]+)\?ack=1/.exec(body.Text)?.[1] ?? "";
        return token;
      }, { timeout: 30_000 }).not.toBe("");
      const outsider = await (await browser.newContext()).newPage();
      await outsider.goto(`/t/${token}/?ack=1`);
      await expect(outsider.getByText("Please confirm you received these drawings.")).toBeVisible();
      await outsider.getByRole("button", { name: "Acknowledge receipt" }).click();
      await expect(outsider.getByRole("status")).toContainText("Receipt acknowledged");
      await lead.goto(`/projects/${project.id}/transmittals/${t.id}`);
      await expect(lead.getByRole("row", { name: new RegExp(`Ack ${stamp}`) })).toContainText("✓");
    });
  } finally {
    await apiCall(admin, "DELETE", `/api/v1/checklists/${checklist.id}`);
    if (delegationId) await apiCall(checker, "DELETE", `/api/v1/delegations/${delegationId}`);
  }
});

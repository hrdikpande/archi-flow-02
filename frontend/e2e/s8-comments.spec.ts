/** S8 (P2): the PL logs a client comment in seconds and assigns it; an email to the project
 * address from an unknown sender waits for review and becomes a comment; the PL records the
 * client's stage approval with evidence. */
import { expect, test } from "@playwright/test";

import { apiCall, as, freshProject, onePagePdf, STATE } from "./support";

const SECRET = process.env.E2E_INBOUND_SECRET ?? "dev-inbound-secret";

test("comment log, email capture and stage approval", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets, stages } = await freshProject(lead, { sheets: ["A-801"] });
  const stamp = Date.now().toString(36);

  await test.step("PL logs a comment and assigns the designer", async () => {
    await lead.goto(`/projects/${project.id}/comments`);
    const started = Date.now();
    await lead.getByRole("button", { name: "Log comment" }).click();
    const drawer = lead.getByRole("dialog", { name: "Log a client comment" });
    await drawer.getByLabel("Source").selectOption({ label: "Meeting" });
    await drawer.getByLabel("From").fill("Dr Rao, client");
    await drawer.getByLabel("Comment").fill(`Move the OT door 600 mm ${stamp}`);
    await drawer.getByRole("button", { name: /^Sheets:/ }).click();
    await lead.getByRole("checkbox", { name: /A-801/ }).check();
    await lead.keyboard.press("Escape");
    await drawer.getByLabel("Assign to").selectOption({ label: "Rahul Kumar" });
    await drawer.getByRole("button", { name: "Log comment" }).click();
    await expect(lead.getByText(/CC-0001 logged/).first()).toBeVisible();
    expect(Date.now() - started).toBeLessThan(30_000); // F-24: logged in under 30 s
    const row = lead.getByRole("row", { name: new RegExp(stamp) });
    await expect(row).toContainText("A-801");
    await expect(row).toContainText("Assigned");
  });

  await test.step("an email from an unknown sender is reviewed and logged", async () => {
    const raw = [
      `From: New Consultant <consultant.${stamp}@example.org>`,
      `To: ${project.inbound_address}`,
      `Subject: Lift lobby width ${stamp}`,
      `Message-ID: <${stamp}@example.org>`,
      "Date: Wed, 21 Oct 2026 10:15:00 +0530",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Please widen the lift lobby to 2.4 m.",
    ].join("\r\n");
    const res = await request.post("/integrations/inbound-email", { data: raw, headers: { "Content-Type": "message/rfc822", "X-Inbound-Secret": SECRET } });
    expect(res.status()).toBe(201);
    await lead.reload();
    const queue = lead.getByRole("heading", { name: /Emails from unknown senders/ });
    await expect(queue).toBeVisible();
    await lead.getByRole("listitem").filter({ hasText: `Lift lobby width ${stamp}` }).getByRole("button", { name: "Log as comment" }).click();
    await expect(lead.getByText(/Logged as .*CC-0002/).first()).toBeVisible();
    await expect(lead.getByRole("row", { name: new RegExp(`Lift lobby width ${stamp}`) })).toContainText("Email");
  });

  await test.step("PL records client approval of the active stage with evidence", async () => {
    const designer = await as(browser, STATE.designer);
    await designer.goto("/");
    await apiCall(designer, "POST", `/api/v1/sheets/${sheets[0]!.id}/transitions`, { action: "start" }); // stage → active
    await lead.goto(`/projects/${project.id}/stages`);
    const stageRow = lead.getByRole("row", { name: new RegExp(stages[0]!.name) });
    await stageRow.getByRole("button", { name: "Record client approval" }).click();
    const drawer = lead.getByRole("dialog", { name: /Client approval/ });
    await drawer.getByLabel("Approved by").fill("Dr Rao (Medical Superintendent)");
    await drawer.getByLabel("Evidence").setInputFiles({ name: "approval.pdf", mimeType: "application/pdf", buffer: onePagePdf("Approved") });
    await drawer.getByRole("button", { name: "Record approval" }).click();
    await expect(lead.getByText(/Client approval recorded/).first()).toBeVisible();
    await expect(lead.getByRole("heading", { name: "Client approvals" })).toBeVisible();
    await expect(lead.getByRole("link", { name: "approval.pdf" })).toBeVisible();
  });
});

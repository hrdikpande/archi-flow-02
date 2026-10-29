/** S10/S11 (P2): the Revit add-in's "Sync sheets" proposes a new sheet and a title change; the
 * DL accepts them; nothing changes in the register before that (F-09). */
import { expect, test } from "@playwright/test";

import { apiCall, as, freshProject, LEAD, STATE } from "./support";

test("plugin sync proposes, the lead accepts", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, byEmail } = await freshProject(lead, { sheets: ["A-111"] });
  const admin = await as(browser, STATE.admin);
  await admin.goto("/");
  const token = await apiCall<{ id: string; token: string }>(admin, "POST", "/api/v1/api-tokens", {
    name: `revit-e2e-${Date.now()}`, user: byEmail(LEAD), scopes: ["cad_sync:write"], expires_in_days: 1,
  });
  try {
    const body = {
      project_code: project.code, source: "revit", app_version: "Revit 2025",
      sheets: [{ number: "A-111", title: "Sheet A-111 (revised)", revision: "" }, { number: "A-112", title: "Roof Plan", revision: "P01" }],
    };
    const headers = { Authorization: `Bearer ${token.token}`, "Idempotency-Key": `e2e-${Date.now()}` };
    const sync = await request.post("/api/v1/integrations/cad-sync", { data: body, headers });
    expect(sync.status()).toBe(201);
    expect((await (await request.post("/api/v1/integrations/cad-sync", { data: body, headers })).headers())["idempotent-replayed"]).toBe("true");

    await lead.goto(`/projects/${project.id}/register`);
    await expect(lead.getByText("1 of 1 sheets")).toBeVisible(); // nothing created yet
    await lead.getByRole("link", { name: /CAD sync: 2 to review/ }).click();
    const newRow = lead.getByRole("row", { name: /A-112/ });
    await newRow.getByLabel("Stage for A-112").selectOption({ index: 1 });
    await newRow.getByRole("button", { name: "Add sheet" }).click();
    await expect(lead.getByText("A-112: accepted").first()).toBeVisible();
    await lead.getByRole("row", { name: /A-111/ }).getByRole("button", { name: "Use model title" }).click();
    await expect(lead.getByText("No proposals waiting")).toBeVisible();
    await lead.getByRole("link", { name: "Back to the register" }).click();
    await expect(lead.getByText("2 of 2 sheets")).toBeVisible();
    await expect(lead.getByRole("row", { name: /A-111/ })).toContainText("Sheet A-111 (revised)");
  } finally {
    await apiCall(admin, "POST", `/api/v1/api-tokens/${token.id}/revoke`).catch(() => undefined);
  }
});

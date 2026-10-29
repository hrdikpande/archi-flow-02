/** S6 demo (docs/05): the owner opens the portfolio, clicks "Late N" and lands on the filtered
 * list; search "OT duct" finds M-205; every list can be exported. */
import { expect, test } from "@playwright/test";

import { apiCall, as, freshProject, STATE } from "./support";

test("portfolio late count links to the list, search finds OT duct, export downloads", async ({ browser }) => {
  test.setTimeout(180_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, stages, byEmail } = await freshProject(lead, { sheets: ["A-101"] });
  const disciplines = await apiCall<{ id: string; code: string }[]>(lead, "GET", "/api/v1/disciplines");
  const m = disciplines.find((d) => d.code === "M")!.id;
  const longAgo = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
  const sheet = await apiCall<{ id: string }>(lead, "POST", `/api/v1/projects/${project.id}/sheets`, {
    number: "M-205", title: "OT Ductwork L2", discipline: m, stage: stages[0]!.id,
    owner: byEmail("designer@firm.example"), planned_issue_date: longAgo,
  });

  await test.step("the late sweep runs and the read model refreshes", async () => {
    const admin = await as(browser, STATE.admin);
    await admin.goto("/");
    const rules = await apiCall<{ id: string; key: string }[]>(admin, "GET", "/api/v1/automation-rules");
    await apiCall(admin, "POST", `/api/v1/automation-rules/${rules.find((r) => r.key === "A-02")!.id}/run`);
    await expect
      .poll(async () => {
        const list = await apiCall<{ id: string }[]>(admin, "GET", `/api/v1/sheets?flag=late&project=${project.id}`);
        return list.some((s) => s.id === sheet.id);
      }, { timeout: 30_000 })
      .toBe(true);
  });

  const owner = await as(browser, STATE.owner);
  await test.step("owner: portfolio → Late → filtered list containing M-205", async () => {
    await owner.goto("/portfolio");
    await expect(owner.getByRole("heading", { name: "Portfolio", level: 1 })).toBeVisible();
    await expect(owner.getByText(/Updated \d{2}:\d{2}/)).toBeVisible();
    const lateCard = owner.getByRole("link", { name: /^Late sheets \d+/ });
    await expect
      .poll(async () => {
        await owner.reload();
        return Number(/^Late sheets\s*(\d+)/.exec((await lateCard.textContent()) ?? "")?.[1] ?? 0);
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await lateCard.click();
    await expect(owner).toHaveURL(/\/sheets\?flag=late/);
    await expect(owner.getByRole("heading", { name: "Late sheets" })).toBeVisible();
    await expect(owner.getByRole("link", { name: new RegExp(`${project.code} · M-205 OT Ductwork L2`) })).toBeVisible();
  });

  await test.step("search 'OT duct' finds M-205 and opens it", async () => {
    await owner.keyboard.press("ControlOrMeta+k");
    const box = owner.getByRole("combobox", { name: /Search sheets/ });
    await box.fill("OT duct");
    // Earlier runs left other M-205s on the shared stack: pick this project's.
    const option = owner.getByRole("option", { name: new RegExp(`M-205 OT Ductwork L2.*${project.code}`) });
    await expect(option).toBeVisible();
    await option.click();
    await expect(owner).toHaveURL(new RegExp(`/projects/${project.id}/sheets/`));
    await expect(owner.getByRole("heading", { name: /M-205/ })).toBeVisible();
  });

  await test.step("export the late list to Excel", async () => {
    await owner.goto("/sheets?flag=late");
    await owner.getByRole("button", { name: "Export" }).click();
    const download = owner.waitForEvent("download");
    await owner.getByRole("menuitem", { name: "Excel (.xlsx)" }).click();
    expect((await download).suggestedFilename()).toMatch(/^Late_and_at-risk_sheets_.*\.xlsx$/);
  });

  await test.step("the project activity feed shows the sheet being added, linked", async () => {
    await lead.goto(`/projects/${project.id}/activity`);
    const entry = lead.getByRole("link", { name: /added sheet M-205/ });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(lead).toHaveURL(new RegExp(`/sheets/${sheet.id}`));
  });

  await test.step("the project overview shows the dashboard cards", async () => {
    await lead.goto(`/projects/${project.id}`);
    await expect(lead.getByRole("heading", { name: "Sheets planned vs issued" })).toBeVisible();
    await expect(lead.getByRole("heading", { name: "Late sheets" })).toBeVisible();
  });
});

test("my work lists the designer's sheets with the next action", async ({ browser }) => {
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, stages, byEmail } = await freshProject(lead);
  const disciplines = await apiCall<{ id: string; code: string }[]>(lead, "GET", "/api/v1/disciplines");
  // The earliest due date puts it first on My work, whatever earlier runs left on the stack.
  await apiCall(lead, "POST", `/api/v1/projects/${project.id}/sheets`, {
    number: "A-301", title: "Sheet A-301", discipline: disciplines.find((d) => d.code === "A")!.id,
    stage: stages[0]!.id, owner: byEmail("designer@firm.example"), planned_issue_date: "2000-01-03",
  });
  const designer = await as(browser, STATE.designer);
  await designer.goto("/");
  const row = designer.getByRole("row", { name: new RegExp(`${project.code} · A-301`) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Start/ }).click();
  await expect(designer.getByText(/A-301: Start/).first()).toBeVisible();
});

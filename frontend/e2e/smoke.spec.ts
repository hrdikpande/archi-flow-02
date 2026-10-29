/** N-07 browser matrix smoke: the main screens render and work in Firefox, WebKit (Safari) and
 * at phone width (360 px: My work and the sheet viewer). Chromium runs the full suite. */
import { expect, test } from "@playwright/test";

import { approveSheet, as, freshProject, STATE } from "./support";

test("designer: my work, a sheet with its PDF, timesheet, search", async ({ browser, isMobile }) => {
  test.setTimeout(120_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets } = await freshProject(lead, { sheets: ["A-501"] });
  const designer = await as(browser, STATE.designer);
  const checker = await as(browser, STATE.checker);
  await designer.goto("/");
  await checker.goto("/");
  await approveSheet(designer, checker, sheets[0]!.id, "A-501");

  await designer.goto("/");
  await expect(designer.getByRole("heading", { name: "My work", level: 1 })).toBeVisible();
  await designer.goto(`/projects/${project.id}/sheets/${sheets[0]!.id}`);
  await expect(designer.getByRole("heading", { name: /A-501/ })).toBeVisible();
  await expect(designer.locator("canvas").first()).toBeVisible({ timeout: 20_000 }); // PDF.js rendered
  if (!isMobile) {
    await designer.goto("/timesheets");
    await expect(designer.getByRole("heading", { name: "Timesheet", level: 1 })).toBeVisible();
    await designer.keyboard.press("ControlOrMeta+k");
    await designer.getByRole("combobox", { name: /Search sheets/ }).fill("A-501");
    await expect(designer.getByRole("option", { name: /A-501/ }).first()).toBeVisible();
  }
});

test("owner: portfolio and register render", async ({ browser, isMobile }) => {
  test.skip(isMobile, "desktop screens (N-07: desktop first ≥ 1280 px)");
  const owner = await as(browser, STATE.owner);
  await owner.goto("/portfolio");
  await expect(owner.getByRole("heading", { name: "Portfolio", level: 1 })).toBeVisible();
  await owner.getByRole("link", { name: /^\d{4}-\d{3} / }).first().click();
  await expect(owner.getByRole("navigation", { name: "Project sections" })).toBeVisible();
  await owner.getByRole("link", { name: "Register" }).click();
  await expect(owner.getByText(/\d+ of \d+ sheets/)).toBeVisible();
});

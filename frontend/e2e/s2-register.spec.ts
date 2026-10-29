/** S2 demo (docs/05): create a project, apply the stage template, import a 400-row register,
 * fix 3 bad rows, filter by discipline. */
import { expect, test } from "@playwright/test";

import { CHECKER, DESIGNER, STATE } from "./support";

test.use({ storageState: STATE.lead });

test("PL sets up a project and imports its register", async ({ page }) => {
  test.setTimeout(120_000);
  const code = `${2030 + Math.floor(Math.random() * 69)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const name = `HSR Block B ${code}`;

  await test.step("create the project (F-01)", async () => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).first().click();
    const drawer = page.getByRole("dialog", { name: "New project" });
    await drawer.getByLabel("Project code").fill(code);
    await drawer.getByLabel("Name").fill(name);
    await drawer.getByLabel("Type").selectOption("hospital");
    await drawer.getByLabel("CAD versions in use").fill("Revit 2024, AutoCAD 2023");
    await drawer.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(code) })).toBeVisible();
    await expect(page.getByText("CAD: Revit 2024, AutoCAD 2023")).toBeVisible();
  });

  await test.step("apply the stage template and save a final plan (F-02)", async () => {
    await page.getByRole("button", { name: "Apply template" }).click();
    await expect(page.getByLabel("Stage 1 name")).toHaveValue("Concept");
    await page.getByLabel("Working drawings / GFC fee %").fill("80");
    await expect(page.getByText("100.00%")).toBeVisible();
    await page.getByRole("button", { name: "Save as final" }).click();
    await expect(page.getByText("Current plan is final.")).toBeVisible();
  });

  await test.step("add the team", async () => {
    await page.getByRole("link", { name: "Team & hours" }).click();
    for (const [email, role] of [[DESIGNER, "Designer"], [CHECKER, "Discipline lead"]]) {
      await page.getByRole("button", { name: "Add person" }).click();
      const drawer = page.getByRole("dialog", { name: "Add person to the team" });
      await drawer.getByLabel("Person").fill(email!.split("@")[0]!);
      await page.getByRole("option", { name: new RegExp(email!) }).click();
      await drawer.getByLabel("Role").selectOption({ label: role! });
      await drawer.getByRole("button", { name: "Add to team" }).click();
      await expect(drawer).toBeHidden();
    }
    await expect(page.getByRole("cell", { name: /Rahul Kumar/ })).toBeVisible();
  });

  await test.step("import 400 rows, fix 3 bad ones, commit (F-05)", async () => {
    const rows = ["Sheet number,Title,Discipline,Stage,Owner,Planned issue date"];
    for (let i = 1; i <= 300; i++) rows.push(`A-${String(i).padStart(3, "0")},Arch sheet ${i},A,Working drawings / GFC,${DESIGNER},31-Dec-2026`);
    for (let i = 1; i <= 97; i++) rows.push(`M-${String(i).padStart(3, "0")},HVAC sheet ${i},M,Working drawings / GFC,,15-Jan-2027`);
    rows.push("A-001,Duplicate number,A,Working drawings / GFC,,");
    rows.push("M-098,Bad discipline,Q,Working drawings / GFC,,");
    rows.push("M-099,Bad date,M,Working drawings / GFC,,31-Feb-2027");
    await page.getByRole("link", { name: "Register" }).click();
    await page.getByRole("link", { name: "Import Excel" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "register.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")) });
    // Both copies of a duplicated number are flagged; fixing one clears both (rows are CSV lines).
    await expect(page.getByText(/396 ready · 4 with errors/)).toBeVisible();
    await page.getByLabel("Errors only").check();
    await page.getByLabel("Row 399 Sheet number").fill("A-301");
    await page.getByLabel("Row 399 Sheet number").blur();
    await expect(page.getByText(/398 ready · 2 with errors/)).toBeVisible();
    await page.getByLabel("Row 400 Discipline").fill("M");
    await page.getByLabel("Row 400 Discipline").blur();
    await expect(page.getByText(/399 ready · 1 with errors/)).toBeVisible();
    await page.getByLabel("Row 401 Planned issue date").fill("28-Feb-2027");
    await page.getByLabel("Row 401 Planned issue date").blur();
    await expect(page.getByText(/400 ready · 0 with errors/)).toBeVisible();
    await page.getByRole("button", { name: "Import 400 sheets" }).click();
    await expect(page.getByText(/400 sheets imported from register.csv/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Undo import/ })).toBeVisible();
  });

  await test.step("filter the register by discipline", async () => {
    await page.getByRole("link", { name: "Open register" }).click();
    await expect(page.getByText("400 of 400 sheets")).toBeVisible();
    await page.getByRole("button", { name: /^Discipline:/ }).click();
    await page.getByRole("checkbox", { name: /HVAC/ }).check();
    await page.keyboard.press("Escape");
    await expect(page.getByText("99 of 400 sheets")).toBeVisible(); // 97 + the two fixed M rows
    await expect(page).toHaveURL(/discipline=/);
  });
});

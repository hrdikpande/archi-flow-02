/**
 * S1 demo (docs/05): admin signs in, sets disciplines, holidays and the work week, adds a
 * contact; the audit trail shows each change. Also checks outbound email reaches the catcher.
 */
import { expect, test } from "@playwright/test";

import { MAILPIT, STATE, uid } from "./support";

test.use({ storageState: STATE.admin });

test("admin sets up the firm and every change is audited", async ({ page }) => {
  const code = uid().replace(/[^A-Z]/g, "").padEnd(3, "Q").slice(0, 3);
  const holidayName = `Founders Day ${uid()}`;
  const person = `Ravi Rao ${uid()}`;

  await test.step("add a discipline with a sheet-number rule", async () => {
    await page.goto("/admin/disciplines");
    await page.getByRole("button", { name: "Add discipline" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Add discipline" });
    await drawer.getByLabel("Code").fill(code);
    await drawer.getByLabel("Name").fill("Landscape");
    await drawer.getByLabel("Sheet-number rule (regular expression)").fill(`^${code}-\\d{3}$`);
    await drawer.getByLabel("Try a sheet number").fill(`${code}-101`);
    await expect(drawer.getByText(`✓ ${code}-101 matches the rule.`)).toBeVisible();
    await drawer.getByRole("button", { name: "Save discipline" }).click();
    await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible();
  });

  await test.step("switch to a six-day week and add a holiday", async () => {
    await page.goto("/admin/calendar");
    const monSat = page.getByRole("radio", { name: "Monday to Saturday" });
    const monFri = page.getByRole("radio", { name: "Monday to Friday" });
    await expect(monSat).toBeEnabled();
    if (await monSat.isChecked()) {
      await monFri.check();
      await expect(monFri).toBeChecked();
    }
    await monSat.check();
    await expect(page.getByText("Working week set to Monday to Saturday").first()).toBeVisible();
    const nextYear = new Date().getFullYear() + 1;
    await page.getByLabel("Year").selectOption(String(nextYear));
    const day = new Date(Date.UTC(nextYear, 0, 1 + Math.floor(Math.random() * 365)));
    await page.getByLabel("Date").fill(day.toISOString().slice(0, 10));
    await page.getByLabel("Holiday name").fill(holidayName);
    await page.getByRole("button", { name: "Add holiday" }).click();
    await expect(page.getByRole("cell", { name: holidayName, exact: true })).toBeVisible();
    // Leave the calendar as we found it so the demo can be re-run against the same stack.
    await page.getByRole("button", { name: `Remove ${holidayName}` }).click();
    await expect(page.getByRole("cell", { name: holidayName, exact: true })).toHaveCount(0);
    await monFri.check();
    await expect(monFri).toBeChecked();
  });

  await test.step("add a contact; a duplicate email warns first", async () => {
    await page.goto("/contacts");
    const email = `ravi.${uid().toLowerCase()}@client.example`;
    for (const [i, name] of [person, `${person} (site)`].entries()) {
      await page.getByRole("button", { name: "Add contact" }).click();
      const drawer = page.getByRole("dialog", { name: "Add contact" });
      await drawer.getByLabel("Full name").fill(name);
      await drawer.getByLabel("Email").fill(email);
      await drawer.getByRole("button", { name: "Save contact" }).click();
      if (i === 1) {
        await expect(drawer.getByRole("alert")).toContainText("already uses");
        await drawer.getByRole("button", { name: "Save anyway" }).click();
      }
      await expect(drawer).toBeHidden();
    }
    await page.getByLabel("Search contacts").fill(person);
    await expect(page.getByRole("button", { name: person, exact: true })).toBeVisible();
  });

  await test.step("the audit trail shows each change", async () => {
    await page.goto("/admin/audit");
    const table = page.getByRole("table");
    await expect(table.getByText("discipline.created").first()).toBeVisible();
    await expect(table.getByText("holiday.created").first()).toBeVisible();
    await expect(table.getByText("org.updated").first()).toBeVisible();
    await expect(table.getByText(person).first()).toBeVisible(); // label is "name <email>"
    await expect(table.getByText("auth.login").first()).toBeVisible();
  });
});

test("outbound email goes to the local catcher only", async ({ page, request }) => {
  const before = await (await request.get(`${MAILPIT}/api/v1/messages`)).json();
  await page.goto("/admin/integrations");
  await page.getByRole("button", { name: "Send test email" }).click();
  await expect(page.getByText("Test email queued").first()).toBeVisible();
  await expect
    .poll(async () => (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()).total, { timeout: 15_000 })
    .toBeGreaterThan(before.total);
  const latest = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()).messages[0];
  expect(latest.Subject).toBe("DrawingOps test email");
  expect(latest.To[0].Address).toBe("admin@firm.example");
});

test("API token is shown once and can be revoked", async ({ page }) => {
  const name = `Revit add-in ${uid()}`;
  await page.goto("/admin/integrations");
  await page.getByRole("button", { name: "Create token" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Create API token" });
  await drawer.getByLabel("Name").fill(name);
  await drawer.getByRole("button", { name: "Create token" }).click();
  await expect(drawer.getByText(/^dop_[0-9a-f]{12}_/)).toBeVisible();
  await drawer.getByRole("button", { name: "Done" }).click();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await expect(row.getByText(/^Revoked/)).toBeVisible();
});

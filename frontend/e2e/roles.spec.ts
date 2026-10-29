/** F-38 in the UI: the server decides; the UI only shows what the role allows. */
import { expect, test } from "@playwright/test";

import { STATE, uid } from "./support";

test.describe("designer", () => {
  test.use({ storageState: STATE.designer });

  test("has no Admin, reads contacts but cannot edit them", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Contacts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);
  });

  test("lands on My work with their sheets and hours, without lead-only screens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "My work", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Due soon/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hours this week" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Timesheets" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Portfolio" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});

test.describe("project lead", () => {
  test.use({ storageState: STATE.lead });

  test("can add an organisation without being an admin (DD-007)", async ({ page }) => {
    const name = `Structural Consultants ${uid()}`;
    await page.goto("/contacts");
    await page.getByRole("tab", { name: "Organisations" }).click();
    await page.getByRole("button", { name: "Add organisation" }).click();
    const drawer = page.getByRole("dialog", { name: "Add organisation" });
    await drawer.getByLabel("Name").fill(name);
    await drawer.getByLabel("Type").selectOption("consultant");
    await drawer.getByRole("button", { name: "Save organisation" }).click();
    await expect(page.getByRole("button", { name })).toBeVisible();
  });
});

test("signed-out visitors are sent to sign-in with a return path", async ({ page }) => {
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Faudit/);
  await expect(page.getByRole("heading", { name: "Sign in to DrawingOps" })).toBeVisible();
});

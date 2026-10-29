/** N-04: WCAG 2.2 AA on every P1 screen, in light and dark themes (axe-core). Each screen is
 * opened by the role that uses it and asserts its own heading, so a redirect never passes. */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { apiCall, STATE } from "./support";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type Screen = [path: string, heading: RegExp];

const BY_ROLE: Record<keyof typeof STATE, Screen[]> = {
  admin: [
    ["/", /^My work$/],
    ["/contacts", /^Contacts$/],
    ["/admin/organisation", /^Organisation$/],
    ["/admin/disciplines", /^Disciplines$/],
    ["/admin/stage-templates", /^Stage templates$/],
    ["/admin/naming-rules", /^Naming rules$/],
    ["/admin/automation", /^Automation$/],
    ["/admin/calendar", /^Working calendar$/],
    ["/admin/users", /^Users and roles$/],
    ["/admin/integrations", /^Integrations$/],
    ["/admin/onboarding", /^Onboarding$/],
    ["/admin/checklists", /^Checklists$/],
    ["/admin/intelligence", /^Intelligence$/],
    ["/admin/audit", /^Audit trail$/],
    ["/reports", /^Reports$/],
  ],
  owner: [
    ["/portfolio", /^Portfolio$/],
    ["/sheets?flag=late", /^Late sheets$/],
    ["/reports", /^Reports$/],
  ],
  lead: [
    ["/projects", /^Projects$/],
    ["/projects/{p}", /2026-014/],
    ["/projects/{p}/register", /2026-014/],
    ["/projects/{p}/stages", /2026-014/],
    ["/projects/{p}/team", /2026-014/],
    ["/projects/{p}/transmittals", /2026-014/],
    ["/projects/{p}/activity", /2026-014/],
    ["/projects/{p}/comments", /2026-014/],
    ["/projects/{p}/construction/rfis", /2026-014/],
    ["/projects/{p}/construction/submittals", /2026-014/],
    ["/projects/{p}/construction/site", /2026-014/],
    ["/projects/{p}/construction/changes", /2026-014/],
    ["/projects/{p}/construction/clashes", /2026-014/],
    ["/projects/{p}/decisions", /2026-014/],
    ["/knowledge", /^Knowledge$/],
    ["/workload", /^Workload/],
    ["/workload/staff", /^Workload$/],
    ["/timesheets/approvals", /^Timesheet approvals$/],
  ],
  designer: [
    ["/", /^My work$/],
    ["/timesheets", /^Timesheet$/],
    ["/settings/notifications", /^Notification/],
  ],
  checker: [
    ["/reviews", /^Reviews$/],
    ["/disciplines/A", /^A · /],
  ],
  dc: [["/projects/{p}/issue", /2026-014/]],
  accounts: [["/billing", /^Billing$/], ["/billing/invoiced", /^Billing$/]],
};

async function seedProjectId(page: Page): Promise<string> {
  await page.goto("/");
  const list = await apiCall<{ results: { id: string; code: string }[] }>(page, "GET", "/api/v1/projects?q=2026-014");
  return list.results.find((p) => p.code === "2026-014")!.id;
}

for (const scheme of ["light", "dark"] as const) {
  for (const [role, screens] of Object.entries(BY_ROLE) as [keyof typeof STATE, Screen[]][]) {
    test.describe(`${scheme} theme · ${role}`, () => {
      test.use({ storageState: STATE[role], colorScheme: scheme });

      for (const [path, heading] of screens) {
        test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
          const url = path.includes("{p}") ? path.replace("{p}", await seedProjectId(page)) : path;
          await page.goto(url);
          await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
          await page.waitForLoadState("networkidle");
          const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
        });
      }
    });
  }

  test(`sign-in page (${scheme}) has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/sign-in");
    await page.getByRole("heading", { name: "Sign in to DrawingOps" }).waitFor();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test(`command palette (${scheme}) has no WCAG 2.2 AA violations`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: STATE.lead, colorScheme: scheme });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("heading", { name: "My work" }).waitFor();
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox", { name: /Search sheets/ }).fill("2026");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(TAGS).include('[role="dialog"]').analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await context.close();
  });
}

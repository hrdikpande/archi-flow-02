import { test as setup } from "@playwright/test";

import { ACCOUNTS, ADMIN, CHECKER, DC, DESIGNER, LEAD, OWNER, signIn, STATE } from "./support";

for (const [name, email] of [
  ["admin", ADMIN],
  ["designer", DESIGNER],
  ["lead", LEAD],
  ["checker", CHECKER],
  ["dc", DC],
  ["owner", OWNER],
  ["accounts", ACCOUNTS],
] as const) {
  setup(`sign in as ${name}`, async ({ page }) => {
    setup.setTimeout(75_000); // may wait for the next TOTP window
    await signIn(page, email);
    await page.context().storageState({ path: STATE[name] });
  });
}

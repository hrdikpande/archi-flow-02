import { defineConfig, devices } from "@playwright/test";

// Runs against the compose stack (`make e2e`). 127.0.0.1 avoids clashes with other local
// servers bound to IPv6 localhost.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
      testIgnore: /smoke\.spec\.ts/,
    },
    // N-07 browser matrix: Chrome and Edge share Chromium (above); Firefox and Safari's
    // WebKit run the smoke suite, and so does a 360 px phone viewport.
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
      testMatch: /smoke\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
      testMatch: /smoke\.spec\.ts/,
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
      dependencies: ["setup"],
      testMatch: /smoke\.spec\.ts/,
    },
  ],
});

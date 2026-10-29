import assert from "node:assert/strict";
import { test } from "node:test";

import { buildConfig } from "./vercel-config.mjs";

test("proxies backend paths to the https origin and falls back to the SPA", () => {
  const c = buildConfig({ BACKEND_ORIGIN: "https://api.example.up.railway.app/ignored/path", S3_ORIGIN: "https://b.s3.ap-south-1.amazonaws.com" });
  const proxy = c.routes[0];
  assert.equal(proxy.dest, "https://api.example.up.railway.app/$1$2");
  for (const p of ["/api/v1/me", "/t/abc/", "/site/x/", "/_allauth/browser/v1/auth/login", "/accounts/google/login/callback/", "/integrations/cron/tick"]) {
    assert.ok(new RegExp(proxy.src).test(p), p);
  }
  assert.ok(!new RegExp(proxy.src).test("/projects/1"));
  assert.ok(!new RegExp(proxy.src).test("/assets/index.js"));
  const csp = c.routes.find((r) => r.headers?.["content-security-policy"]).headers["content-security-policy"];
  assert.match(csp, /connect-src 'self' https:\/\/b\.s3\.ap-south-1\.amazonaws\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.deepEqual(c.routes.at(-1), { src: "^/(.*)$", dest: "/index.html" });
  assert.equal(c.crons, undefined);
});

test("refuses a missing or plain-http backend", () => {
  assert.throws(() => buildConfig({}), /BACKEND_ORIGIN is required/);
  assert.throws(() => buildConfig({ BACKEND_ORIGIN: "http://api.example.com" }), /https/);
});

test("adds the cron when asked", () => {
  const c = buildConfig({ BACKEND_ORIGIN: "https://api.example.com", VERCEL_CRON_SCHEDULE: "*/5 * * * *" });
  assert.deepEqual(c.crons, [{ path: "/integrations/cron/tick", schedule: "*/5 * * * *" }]);
});

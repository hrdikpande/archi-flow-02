/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev the SPA runs on :5173 and proxies to the compose stack's Caddy on :8080,
// which keeps one origin for cookies, CSRF and presigned storage URLs (docs/02 §11).
const backend = process.env.VITE_BACKEND_URL ?? "http://localhost:8080";
const proxied = ["/api", "/_allauth", "/accounts", "/django-admin", "/django-static", "/drawingops", "/healthz"];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: false }])),
  },
  build: { sourcemap: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});

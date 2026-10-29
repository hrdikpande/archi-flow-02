// Vercel build: `npm run build`, then emit .vercel/output (static files + config.json).
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import { buildConfig } from "./vercel-config.mjs";

const config = buildConfig(process.env); // fails fast on a missing or non-https BACKEND_ORIGIN
execSync("npm run build", { stdio: "inherit" });
rmSync(".vercel/output", { recursive: true, force: true });
mkdirSync(".vercel/output/static", { recursive: true });
cpSync("dist", ".vercel/output/static", { recursive: true });
writeFileSync(".vercel/output/config.json", JSON.stringify(config, null, 2));
console.log(`Vercel output ready: API → ${new URL(process.env.BACKEND_ORIGIN).origin}`);

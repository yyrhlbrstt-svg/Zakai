// Runs `prisma migrate deploy` during the build **only when DATABASE_URL is
// set**. This lets Vercel apply migrations automatically before every build
// (no manual terminal step), while still allowing the site to build before a
// database has been configured (e.g. a marketing-only preview).
//
// If DATABASE_URL is present but the migration fails, the build fails on
// purpose — better a red build than a deploy that 500s at runtime.

import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[prebuild] DATABASE_URL not set — skipping prisma migrate deploy.");
  process.exit(0);
}

console.log("[prebuild] DATABASE_URL detected — running prisma migrate deploy…");
const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (res.status !== 0) {
  console.error("[prebuild] prisma migrate deploy failed — failing the build.");
  process.exit(res.status ?? 1);
}
console.log("[prebuild] migrations applied.");

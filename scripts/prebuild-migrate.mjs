// Runs `prisma migrate deploy` during the build **only when the database is
// configured**. This lets Vercel apply migrations automatically before every
// build (no manual terminal step), while still allowing the site to build
// before a database exists (e.g. a marketing-only preview).
//
// The connection comes from the Neon integration's NEON_DATABASE_URL. Migrations
// additionally need NEON_DATABASE_URL_UNPOOLED (schema.prisma `directUrl`),
// because a pooled connection can't hold the advisory lock Prisma takes.
//
// If the database IS configured but the migration fails, the build fails on
// purpose — better a red build than a deploy that 500s at runtime.

import { spawnSync } from "node:child_process";

if (!process.env.NEON_DATABASE_URL) {
  console.log("[prebuild] NEON_DATABASE_URL not set — skipping prisma migrate deploy.");
  process.exit(0);
}

console.log("[prebuild] Neon database detected — running prisma migrate deploy…");
const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (res.status !== 0) {
  console.error("[prebuild] prisma migrate deploy failed — failing the build.");
  process.exit(res.status ?? 1);
}
console.log("[prebuild] migrations applied.");

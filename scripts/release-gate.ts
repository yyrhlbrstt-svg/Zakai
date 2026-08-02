#!/usr/bin/env tsx
/**
 * Consumer release gate — exit 0 only when releaseScore is 100.
 * Stricter than deploy preflight: SMTP, PayPlus, AI, admin inbox, etc.
 *
 *   npm run release-gate
 */
import { evaluateConsumerReleaseGate } from "../src/lib/deploy/releaseGate";

const { checks, releaseScore, canReleaseConsumerApp, failingIds } = evaluateConsumerReleaseGate();

const scored = checks.filter((c) => c.level !== "optional");

console.log("\nZakai consumer release gate\n");
for (const c of checks) {
  const mark = c.level === "optional" ? (c.ok ? "~" : "·") : c.ok ? "✓" : "✗";
  console.log(`  ${mark} ${c.id.padEnd(22)} ${c.ok ? "" : c.cost}`);
  if (!c.ok && c.level !== "optional") {
    console.log(`      → set: ${c.envKeys.join(", ")}`);
  }
}

console.log(`\nRelease score: ${releaseScore}/100`);
if (!canReleaseConsumerApp) {
  console.log(`BLOCKED — fix: ${failingIds.join(", ")}`);
  console.log("Generate mandate keys: node scripts/generate-mandate-key.mjs");
  console.log("Bootstrap secrets:    node scripts/bootstrap-release-env.mjs\n");
  process.exit(1);
}
console.log("READY — all consumer release checks pass. You may ship.\n");

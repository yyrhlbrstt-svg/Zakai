#!/usr/bin/env node
/**
 * Verify a Zakai deployment implements the interop standard (live probes).
 * Usage: node scripts/verify-interop.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

const url = `${base}/api/interop?probe=1`;
const res = await fetch(url, { redirect: "follow" });
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`FAIL interop probe HTTP ${res.status}`);
  if (body.live?.profiles) {
    for (const p of body.live.profiles) {
      if (p.status === "fail") {
        console.error(`  profile ${p.id}: ${p.failed_checks.join(", ")}`);
      }
    }
  }
  process.exit(1);
}

console.log(`OK reference node — ${body.live?.profiles?.length ?? 0} profiles pass`);
console.log(`   interop: ${base}/.well-known/zakai-interop.json`);

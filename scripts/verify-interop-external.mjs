#!/usr/bin/env node
/**
 * Run interop probe against any deployment (CI / third-party reference node).
 * Usage: INTEROP_PROBE_BASE=https://... node scripts/verify-interop-external.mjs
 */
const base = (process.argv[2] || process.env.INTEROP_PROBE_BASE || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

const url = `${base}/api/interop?probe=1`;
const res = await fetch(url, { redirect: "follow", cache: "no-store" });
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`FAIL interop external probe HTTP ${res.status} — ${base}`);
  if (body.live?.checks) {
    for (const c of body.live.checks.filter((x) => !x.ok)) {
      console.error(`  ${c.id}: status ${c.status ?? "?"} ${c.error ?? ""}`);
    }
  }
  process.exit(1);
}

console.log(`OK external reference node — ${body.live?.checks?.length ?? 0} checks on ${base}`);

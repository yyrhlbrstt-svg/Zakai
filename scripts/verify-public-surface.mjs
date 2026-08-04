#!/usr/bin/env node
/**
 * Assert anonymous probes do not fingerprint infra (post-deploy).
 * Usage: node scripts/verify-public-surface.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

const forbiddenKeys = ["aiProvider", "mandateKeys", "mandateRevocationTable", "envKeys"];

let failed = 0;

async function checkJson(path, assert) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url);
    const body = await res.json();
    const err = assert(body, res.status);
    if (err) {
      console.log(`FAIL ${path}: ${err}`);
      failed++;
    } else {
      console.log(`OK ${path}`);
    }
  } catch (e) {
    console.log(`FAIL ${path} ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

await checkJson("/api/health", (body) => {
  for (const k of forbiddenKeys) {
    if (k in body) return `unexpected key ${k}`;
  }
  if (typeof body.ok !== "boolean") return "missing ok";
  return null;
});

await checkJson("/api/version", (body) => {
  if ("ai" in body || "markets" in body || "operations" in body) {
    return "public version too verbose";
  }
  return null;
});

await checkJson("/api/release-gate", (body) => {
  for (const row of body.failing || []) {
    if ("envKeys" in row) return "failing exposes envKeys";
  }
  return null;
});

if (failed > 0) {
  console.error(`\n${failed} public-surface check(s) failed.`);
  process.exit(1);
}
console.log("\nPublic surface probes OK (no infra fingerprinting).");

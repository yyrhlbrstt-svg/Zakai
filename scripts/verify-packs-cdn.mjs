#!/usr/bin/env node
/**
 * Verify ZML packs CDN (or configured ZML_PACKS_CDN) serves market index.
 * Usage: node scripts/verify-packs-cdn.mjs [cdnBase]
 */
const cdn = (
  process.argv[2] ||
  process.env.ZML_PACKS_CDN ||
  "https://packs.zakai.io"
).replace(/\/+$/, "");

const urls = [`${cdn}/packs/il/index.json`, `${cdn}/manifest.json`];

let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status >= 200 && res.status < 400;
    console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${url}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL ${url} ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} CDN check(s) failed. Bundled packs still work via ZML_PACKS_LOCAL / monorepo.`,
  );
  process.exit(1);
}
console.log("\nPacks CDN responded for IL index + manifest.");

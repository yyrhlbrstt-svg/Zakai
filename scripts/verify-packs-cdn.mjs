#!/usr/bin/env node
/**
 * Verify ZML packs CDN layout (external or origin mirror).
 * Usage:
 *   node scripts/verify-packs-cdn.mjs
 *   node scripts/verify-packs-cdn.mjs https://packs.zakai.io
 *   node scripts/verify-packs-cdn.mjs https://zakai-3uxj.vercel.app/api/cdn/packs
 */
const arg = process.argv[2];
const external = (process.env.ZML_PACKS_CDN || "https://packs.zakai.io").replace(/\/+$/, "");
const originMirror = (
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://zakai-3uxj.vercel.app"
).replace(/\/+$/, "") + "/api/cdn/packs";

const bases = arg
  ? [arg.replace(/\/+$/, "")]
  : [external, originMirror];

async function checkBase(base) {
  const urls = [`${base}/il/index.json`, `${base}/manifest.json`];
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
  return failed;
}

let anyOk = false;
let totalFail = 0;
for (const base of bases) {
  console.log(`\n— ${base}`);
  const failed = await checkBase(base);
  if (failed === 0) anyOk = true;
  totalFail += failed;
}

if (!anyOk) {
  console.error(
    `\nNo packs CDN base responded. Bundled packs still work via ZML_PACKS_LOCAL / monorepo.`,
  );
  process.exit(1);
}

if (totalFail > 0) {
  console.log(`\nAt least one base is live; ${totalFail} check(s) failed on other bases (ok for pre-CDN).`);
} else {
  console.log(`\nAll packs CDN checks passed (${bases.length} base(s)).`);
}

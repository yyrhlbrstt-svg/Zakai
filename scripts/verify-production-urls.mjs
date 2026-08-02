#!/usr/bin/env node
/**
 * Post-deploy smoke — exit 1 if critical URLs are not 200.
 * Usage: node scripts/verify-production-urls.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

const paths = [
  { path: "/api/version", expect: 200 },
  { path: "/he", expect: 200 },
  { path: "/he/terms", expect: 200 },
  { path: "/he/about", expect: 200 },
  { path: "/he/protocol", expect: 200 },
  { path: "/he/partners", expect: 200 },
  { path: "/he/leaks", expect: 200 },
  { path: "/he/cancel", expect: 200 },
  { path: "/he/start", expect: 200 },
  { path: "/.well-known/zakai-jwks.json", expect: 200 },
  { path: "/.well-known/zakai-protocol.json", expect: 200 },
  { path: "/.well-known/zakai-rights-schema.json", expect: 200 },
  { path: "/.well-known/zakai-openapi.json", expect: 200 },
  { path: "/api/rights/catalog?market=IL", expect: 200 },
  { path: "/api/rights/catalog?market=EU", expect: 200 },
  { path: "/api/markets", expect: 200 },
  { path: "/en/global", expect: 200 },
  { path: "/widget/zakai-widget.js", expect: 200 },
  { path: "/api/fairness/scores?market=IL", expect: 200 },
  { path: "/he/rights/tax-refund", expect: 200 },
  { path: "/he/cancel/universal", expect: 200 },
  { path: "/api/widget/validate", expect: 403, note: "no key" },
];

let failed = 0;

for (const { path, expect, note } of paths) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status === expect;
    const tag = ok ? "OK" : "FAIL";
    console.log(`${tag} ${res.status} ${path}${note ? ` (${note})` : ""}`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`FAIL ${path} ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed — production may be stale or deploy incomplete.`);
  process.exit(1);
}
console.log("\nAll production smoke checks passed.");

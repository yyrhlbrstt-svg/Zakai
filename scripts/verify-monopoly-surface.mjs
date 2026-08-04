#!/usr/bin/env node
/**
 * Smoke every endpoint listed in zakai-domains.json (live monopoly surface).
 * Usage: node scripts/verify-monopoly-surface.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

const res = await fetch(`${base}/.well-known/zakai-domains.json`);
if (!res.ok) {
  console.error(`FAIL domains manifest ${res.status}`);
  process.exit(1);
}
const doc = await res.json();
const urls = new Set();
for (const d of doc.domains || []) {
  for (const url of Object.values(d.endpoints || {})) {
    if (typeof url === "string" && url.startsWith("http")) urls.add(url);
  }
}
if (doc.interop) urls.add(doc.interop);
if (doc.laws_url) urls.add(doc.laws_url);

let failed = 0;
for (const url of [...urls].sort()) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    const ok = r.status >= 200 && r.status < 400;
    console.log(`${ok ? "OK" : "FAIL"} ${r.status} ${url.replace(base, "")}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL ${url} ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} monopoly surface check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${urls.size} domain endpoints responded.`);

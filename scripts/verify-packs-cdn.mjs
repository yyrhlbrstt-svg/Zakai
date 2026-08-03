#!/usr/bin/env node
/**
 * Verify ZML packs CDN layout (external, origin mirror, or local artifact).
 * Usage:
 *   node scripts/verify-packs-cdn.mjs
 *   node scripts/verify-packs-cdn.mjs https://packs.zakai.io
 *   node scripts/verify-packs-cdn.mjs https://zakai-3uxj.vercel.app/api/cdn/packs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const arg = process.argv[2];
const external = (process.env.ZML_PACKS_CDN || "https://packs.zakai.io").replace(/\/+$/, "");
const originMirror =
  (process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(/\/+$/, "") +
  "/api/cdn/packs";

const bases = arg ? [arg.replace(/\/+$/, "")] : [external, originMirror];

function checkLocalArtifact() {
  const root = process.env.ZML_PACKS_LOCAL || join(process.cwd(), "zakai-packs");
  const markets = ["il", "us", "gb", "de"];
  let ok = 0;
  for (const m of markets) {
    const p = join(root, "packs", m, "index.json");
    if (!existsSync(p)) {
      console.log(`FAIL local missing ${p}`);
      continue;
    }
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      const n = j.rights_count ?? j.rights?.length ?? 0;
      console.log(`OK local ${m} rights_count=${n}`);
      if (n > 0) ok++;
    } catch (e) {
      console.log(`FAIL local ${p} ${e instanceof Error ? e.message : e}`);
    }
  }
  return ok >= 2;
}

async function checkBase(base) {
  const urls = [`${base}/il/index.json`, `${base}/us/index.json`, `${base}/manifest.json`];
  let failed = 0;
  let passed = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const ok = res.status >= 200 && res.status < 400;
      console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${url}`);
      if (!ok) failed++;
      else passed++;
    } catch (e) {
      console.log(`FAIL ${url} ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }
  return { failed, green: passed >= 2 };
}

let anyOk = false;
let totalFail = 0;
console.log("\n— local zakai-packs artifact");
if (checkLocalArtifact()) anyOk = true;

for (const base of bases) {
  console.log(`\n— ${base}`);
  const { failed, green } = await checkBase(base);
  if (green) anyOk = true;
  totalFail += failed;
}

if (!anyOk) {
  console.error(`\nNo packs CDN base or local multi-market artifact responded.`);
  process.exit(1);
}

console.log(
  `\nPacks surface green (local and/or remote). Remote failures=${totalFail} (ok until packs.zakai.io is live).`,
);

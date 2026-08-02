#!/usr/bin/env npx tsx
/**
 * Export built-in jurisdiction packs to ZML JSON files (inspection / zakai-packs seed).
 *
 *   npx tsx scripts/migrate-legacy-to-zml.ts IL
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MARKETS } from "../src/lib/global/registry";
import { packToZmlRights } from "../src/lib/protocol/zml/legacy-adapter";
import { validateZML } from "../src/lib/protocol/zml/validate";

const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://zakai-3uxj.vercel.app";
const market = (process.argv[2] ?? "IL").toUpperCase();
const m = MARKETS[market];
if (!m) {
  console.error(`Unknown market ${market}`);
  process.exit(1);
}

const outDir = join(process.cwd(), "data", "zml-export", market.toLowerCase(), "rights");
mkdirSync(outDir, { recursive: true });

const rights = packToZmlRights(m.pack, { origin });
let ok = 0;
for (const z of rights) {
  const v = validateZML(z);
  if (!v.ok) {
    console.error(`FAIL ${z.id}: ${v.error}`);
    process.exit(1);
  }
  writeFileSync(join(outDir, `${z.id}.json`), JSON.stringify(z, null, 2) + "\n");
  ok++;
}

const manifest = {
  pack_version: m.pack.version,
  market: m.pack.market,
  language: m.pack.docLocale,
  maintainer: process.env.ZML_MAINTAINER_EMAIL ?? "maintainer@zakai.io",
  rights: rights.map((r) => r.id),
  engine_requirements: { zml_version: ">=1.0.0 <2.0.0", extensions: [] },
};

mkdirSync(join(process.cwd(), "data", "zml-export", market.toLowerCase()), { recursive: true });
writeFileSync(
  join(process.cwd(), "data", "zml-export", market.toLowerCase(), "index.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`Wrote ${ok} ZML rights for ${market} → data/zml-export/${market.toLowerCase()}/`);

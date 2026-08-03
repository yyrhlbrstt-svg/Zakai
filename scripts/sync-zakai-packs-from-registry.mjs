#!/usr/bin/env node
/**
 * Sync registered jurisdiction packs → zakai-packs/ artifact (multi-market).
 *
 * Usage:
 *   node --import tsx scripts/sync-zakai-packs-from-registry.mjs
 *   node --import tsx scripts/sync-zakai-packs-from-registry.mjs US GB DE
 *
 * Default: all MARKETS in the registry (not EU stub — EU stays curated sample).
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Dynamic import of TS modules via tsx
const { MARKETS } = await import("../src/lib/global/registry.ts");
const { packToZmlRights } = await import("../src/lib/protocol/zml/legacy-adapter.ts");
const { validateZML } = await import("../src/lib/protocol/zml/validate.ts");

const root = process.cwd();
const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://zakai-3uxj.vercel.app";
const requested = process.argv.slice(2).map((m) => m.toUpperCase());
const markets = requested.length
  ? requested
  : Object.keys(MARKETS).filter((m) => m !== "EU");

let total = 0;
for (const market of markets) {
  const m = MARKETS[market];
  if (!m) {
    console.error(`Unknown market ${market}`);
    process.exit(1);
  }
  const folder = market.toLowerCase();
  const packDir = join(root, "zakai-packs", "packs", folder);
  const rightsDir = join(packDir, "rights");
  if (existsSync(rightsDir)) rmSync(rightsDir, { recursive: true, force: true });
  mkdirSync(rightsDir, { recursive: true });

  const rights = packToZmlRights(m.pack, { origin });
  for (const z of rights) {
    const v = validateZML(z);
    if (!v.ok) {
      console.error(`FAIL ${z.id}: ${v.error}`);
      process.exit(1);
    }
    writeFileSync(join(rightsDir, `${z.id}.json`), JSON.stringify(z, null, 2) + "\n");
  }

  const manifest = {
    pack_version: m.pack.version,
    market: m.pack.market,
    language: m.pack.docLocale,
    maintainer: process.env.ZML_MAINTAINER_EMAIL ?? `${folder}-maintainer@zakai.io`,
    rights_count: rights.length,
    rights: rights.map((r) => r.id),
    engine_requirements: { zml_version: ">=1.0.0 <2.0.0", extensions: [] },
    _meta: {
      schema_url: "https://packs.zakai.io/schema/zakai-rights-schema.json",
      last_updated: new Date().toISOString(),
      source: "src/lib/global/registry",
    },
  };
  writeFileSync(join(packDir, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${market}: ${rights.length} rights → zakai-packs/packs/${folder}/`);
  total += rights.length;
}

console.log(`\nSynced ${markets.length} markets, ${total} rights into zakai-packs/`);
console.log("Origin CDN mirror: /api/cdn/packs/<market>/index.json");
console.log("Verify: npm run verify:packs-cdn");

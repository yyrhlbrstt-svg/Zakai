import "server-only";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Root of bundled `zakai-packs` (or ZML_PACKS_LOCAL). */
export function packsRoot(): string | null {
  const env = process.env.ZML_PACKS_LOCAL?.trim();
  if (env && existsSync(join(env, "packs"))) return env;
  const bundled = join(process.cwd(), "zakai-packs");
  if (existsSync(join(bundled, "packs", "il", "index.json"))) return bundled;
  return null;
}

/**
 * Serve a relative path under the packs tree (S3 layout after publish strips `packs/`).
 * Allowed: `manifest.json`, `{market}/index.json`, `{market}/rights/{id}.json`, `schema/...`
 */
export function readPackArtifact(relativePath: string): { body: string; contentType: string } | null {
  const root = packsRoot();
  if (!root) return null;

  const cleaned = relativePath.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!cleaned || cleaned.includes("..")) return null;

  // Public CDN layout mirrors publish.js: files under packs/ uploaded without the packs/ prefix.
  let abs: string;
  if (cleaned === "manifest.json") {
    abs = join(root, "manifest.json");
    if (!existsSync(abs)) {
      return { body: JSON.stringify(buildOriginPacksManifest(root), null, 2), contentType: "application/json" };
    }
  } else if (cleaned.startsWith("schema/")) {
    abs = join(root, cleaned);
  } else if (cleaned.startsWith("maintainers/")) {
    abs = join(root, cleaned);
  } else {
    abs = join(root, "packs", cleaned);
  }

  if (!existsSync(abs)) return null;
  const body = readFileSync(abs, "utf8");
  const contentType = abs.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
  return { body, contentType };
}

export function buildOriginPacksManifest(root: string) {
  const packsDir = join(root, "packs");
  const markets: string[] = [];
  if (existsSync(packsDir)) {
    for (const name of readdirSync(packsDir)) {
      if (name.startsWith("_")) continue;
      if (existsSync(join(packsDir, name, "index.json"))) markets.push(name);
    }
  }
  return {
    spec: "zakai-packs-cdn-manifest",
    version: "2026-08-03",
    markets: markets.sort(),
    layout: {
      market_index: "{market}/index.json",
      right: "{market}/rights/{id}.json",
      schema: "schema/zakai-rights-schema.json",
    },
    note: "Origin mirror of bundled packs until packs.zakai.io is live. Same key layout as S3 publish.",
  };
}

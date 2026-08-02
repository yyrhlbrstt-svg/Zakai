import "server-only";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MARKETS } from "@/lib/global/registry";
import type { JurisdictionPack } from "@/lib/global/types";
import { packToZmlRights } from "@/lib/protocol/zml/legacy-adapter";
import type { ZmlRight } from "@/lib/protocol/zml/types";
import { canEvaluateZml, satisfiesZmlRange } from "@/lib/protocol/zml/compatibility";
import { ENGINE_ZML_VERSION, ZML_VERSION } from "@/lib/protocol/zml/constants";
import { dedupeZmlRights } from "@/lib/protocol/zml/sunset";
import { validateZML } from "@/lib/protocol/zml/validate";

const PACKS_CDN = (process.env.ZML_PACKS_CDN || "https://packs.zakai.io").replace(/\/+$/, "");

function packsLocalRoot(): string | undefined {
  const env = process.env.ZML_PACKS_LOCAL?.trim();
  if (env) return env;
  const bundled = join(process.cwd(), "zakai-packs");
  if (existsSync(join(bundled, "packs", "il", "index.json"))) return bundled;
  return undefined;
}
const CACHE_TTL_MS = (Number(process.env.ZML_PACK_CACHE_TTL_SEC) || 300) * 1000;
const FALLBACK_TO_BUILTIN = process.env.ZML_PACKS_FALLBACK !== "false";

interface PackManifest {
  pack_version: string;
  market: string;
  maintainer: string;
  rights: string[];
  engine_requirements?: { zml_version?: string; extensions?: string[] };
}

const zmlCache = new Map<string, { rights: ZmlRight[]; ts: number; source: "cdn" | "builtin" }>();

export interface LoadZmlOptions {
  forceRefresh?: boolean;
  origin?: string;
}

/** Built-in engine pack (unchanged) — used by `evaluatePack` in-app. */
export async function loadPack(market: string): Promise<JurisdictionPack> {
  const code = market.toUpperCase();
  if (PACKS_CDN) {
    try {
      const manifest = await fetch(`${PACKS_CDN}/${cdnFolder(code)}/index.json`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null));
      const range = manifest?.engine_requirements?.zml_version as string | undefined;
      if (range && !satisfiesZmlRange(ZML_VERSION, range)) {
        throw new Error(`Pack ${code} requires ${range}`);
      }
    } catch {
      /* probe only */
    }
  }
  const builtin = MARKETS[code];
  if (!builtin) throw new Error(`Unknown market ${code}`);
  if (!canEvaluateZml(ZML_VERSION, ENGINE_ZML_VERSION)) {
    throw new Error("Engine ZML version mismatch");
  }
  return builtin.pack;
}

function cdnFolder(market: string): string {
  return market.toUpperCase() === "EU" ? "eu" : market.toLowerCase();
}

async function fetchZmlFromCdn(market: string): Promise<ZmlRight[]> {
  const folder = cdnFolder(market);
  const manifestUrl = `${PACKS_CDN}/${folder}/index.json`;
  const manifestRes = await fetch(manifestUrl, { headers: { Accept: "application/json" } });
  if (!manifestRes.ok) {
    throw new Error(`CDN ${manifestRes.status} for ${manifestUrl}`);
  }
  const manifest = (await manifestRes.json()) as PackManifest;
  const range = manifest.engine_requirements?.zml_version ?? ">=1.0.0 <2.0.0";
  if (!satisfiesZmlRange(ZML_VERSION, range)) {
    throw new Error(`Pack ${market} requires ZML ${range}`);
  }

  const rights = await Promise.all(
    manifest.rights.map(async (id) => {
      const url = `${PACKS_CDN}/${folder}/rights/${id}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed right ${id}: ${res.status}`);
      return res.json() as Promise<ZmlRight>;
    }),
  );

  for (const r of rights) {
    const v = validateZML(r);
    if (!v.ok) throw new Error(`Invalid ZML ${r.id}: ${v.error}`);
  }

  return dedupeZmlRights(rights);
}

function loadZmlFromLocal(market: string, root: string): ZmlRight[] {
  const folder = cdnFolder(market);
  const indexPath = join(root, "packs", folder, "index.json");
  if (!existsSync(indexPath)) {
    throw new Error(`Local pack missing ${indexPath}`);
  }
  const manifest = JSON.parse(readFileSync(indexPath, "utf8")) as PackManifest;
  const range = manifest.engine_requirements?.zml_version ?? ">=1.0.0 <2.0.0";
  if (!satisfiesZmlRange(ZML_VERSION, range)) {
    throw new Error(`Pack ${market} requires ZML ${range}`);
  }
  const rights = manifest.rights.map((id) => {
    const p = join(root, "packs", folder, "rights", `${id}.json`);
    return JSON.parse(readFileSync(p, "utf8")) as ZmlRight;
  });
  for (const r of rights) {
    const v = validateZML(r);
    if (!v.ok) throw new Error(`Invalid ZML ${r.id}: ${v.error}`);
  }
  return dedupeZmlRights(rights);
}

/** @internal tests + scripts */
export function loadZmlFromLocalPack(market: string, root: string): ZmlRight[] {
  return loadZmlFromLocal(market, root);
}

function loadBuiltinZml(market: string, origin: string): ZmlRight[] {
  const code = market.toUpperCase();
  if (code === "EU") {
    const root = packsLocalRoot();
    if (root) {
      try {
        return loadZmlFromLocal("EU", root);
      } catch {
        return [];
      }
    }
    return [];
  }
  const builtin = MARKETS[code];
  if (!builtin) {
    return [];
  }
  return dedupeZmlRights(packToZmlRights(builtin.pack, { origin }));
}

/** ZML rights for catalog / evaluate — prefers CDN, falls back to adapter from built-in packs. */
export async function loadZmlRightsForMarket(
  market: string,
  options: LoadZmlOptions = {},
): Promise<{ rights: ZmlRight[]; source: "cdn" | "builtin" }> {
  const code = market.toUpperCase();
  const cacheKey = code;
  const now = Date.now();

  if (!options.forceRefresh) {
    const hit = zmlCache.get(cacheKey);
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      return { rights: hit.rights, source: hit.source };
    }
  }

  const origin = options.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://zakai-3uxj.vercel.app";
  let rights: ZmlRight[];
  let source: "cdn" | "builtin" = "cdn";

  if (packsLocalRoot()) {
    try {
      rights = loadZmlFromLocal(code, packsLocalRoot()!);
    } catch {
      rights = loadBuiltinZml(code, origin);
      source = "builtin";
    }
  } else {
    try {
      rights = await fetchZmlFromCdn(code);
    } catch (err) {
      if (!FALLBACK_TO_BUILTIN) throw err;
      rights = loadBuiltinZml(code, origin);
      source = "builtin";
    }
  }

  if (rights.length === 0 && FALLBACK_TO_BUILTIN && !packsLocalRoot()) {
    rights = loadBuiltinZml(code, origin);
    source = "builtin";
  }

  zmlCache.set(cacheKey, { rights, ts: now, source });
  return { rights, source };
}

export function getZmlRightById(
  rights: ZmlRight[],
  id: string,
): ZmlRight | undefined {
  const decoded = decodeURIComponent(id);
  const exact = rights.find((r) => r.id === decoded);
  if (exact) return exact;

  const base = decoded.split("@")[0]!;
  const versions = rights
    .filter((r) => r.id === base || r.id.startsWith(`${base}@`))
    .sort((a, b) => {
      const va = a.metadata?.last_verified ?? a.version ?? "0";
      const vb = b.metadata?.last_verified ?? b.version ?? "0";
      return vb.localeCompare(va);
    });
  return versions[0];
}

export async function findZmlRightById(
  origin: string,
  id: string,
): Promise<ZmlRight | null> {
  const { marketFromZmlId } = await import("@/lib/protocol/zml/evaluation-guide");
  const market = marketFromZmlId(id);
  const { rights } = await loadZmlRightsForMarket(market, { origin });
  return getZmlRightById(rights, id) ?? null;
}

export function invalidateZmlPackCache(market?: string): void {
  if (market) zmlCache.delete(market.toUpperCase());
  else zmlCache.clear();
}

export async function handleReloadNotification(commit: string): Promise<void> {
  invalidateZmlPackCache();
  console.info(`[zml-packs] cache cleared after ${commit}`);
}

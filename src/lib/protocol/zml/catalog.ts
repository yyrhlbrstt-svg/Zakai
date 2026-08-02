import { MARKETS, isSupportedMarket } from "@/lib/global/registry";
import type { JurisdictionPack } from "@/lib/global/types";
import { packToZmlRights, predicateSummaryForRight, rightDefToZml } from "./legacy-adapter";
import type { ZmlCatalogEntry, ZmlCatalogResponse, ZmlRight } from "./types";
import { ZML_VERSION } from "./constants";
import { validateZML } from "./validate";

export const RIGHTS_CATALOG_API_VERSION = "2026-08-01";

const catalogCache = new Map<string, { rights: ZmlRight[]; builtAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getPack(market: string): JurisdictionPack | null {
  const code = market.toUpperCase();
  if (!isSupportedMarket(code)) return null;
  return MARKETS[code].pack;
}

export function buildZmlCatalogForMarket(origin: string, market: string): ZmlRight[] {
  const key = market.toUpperCase();
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return cached.rights;
  }
  const pack = getPack(key);
  if (!pack) return [];
  const rights = packToZmlRights(pack, { origin });
  for (const r of rights) {
    const v = validateZML(r);
    if (!v.ok) throw new Error(`ZML validation failed for ${r.id}: ${v.error}`);
  }
  catalogCache.set(key, { rights, builtAt: Date.now() });
  return rights;
}

export function findZmlRight(origin: string, idOrKey: string): ZmlRight | null {
  const normalized = idOrKey.includes(":") ? idOrKey.split(":")[1]! : idOrKey;
  for (const code of Object.keys(MARKETS)) {
    const rights = buildZmlCatalogForMarket(origin, code);
    const hit = rights.find((r) => r.id === normalized || r.id === idOrKey);
    if (hit) return hit;
    const pack = MARKETS[code]!.pack;
    const legacy = pack.rights.find(
      (r) => r.id === normalized || `${code.toLowerCase()}_${r.id}` === normalized,
    );
    if (legacy) return rightDefToZml(pack, legacy, { origin });
  }
  return null;
}

function toCatalogEntry(origin: string, pack: JurisdictionPack, right: ZmlRight): ZmlCatalogEntry {
  const def = pack.rights.find(
    (r) => right.id === `${pack.market.toLowerCase()}_${r.id}` || right.id.endsWith(`_${r.id}`),
  );
  return {
    id: right.id,
    display_name: right.display_name,
    category: right.category,
    market: right.market,
    predicate_summary: def ? predicateSummaryForRight(def) : "See predicate",
    auto_eligible: right.action.auto_eligible ?? false,
    financial: right.financial,
    _links: {
      self: `/api/rights/catalog/${right.id}`,
      full: `/api/rights/catalog/${right.id}?full=1`,
      evaluate: `/api/rights/evaluate/${right.id}`,
    },
  };
}

export function buildCatalogResponse(
  origin: string,
  market: string,
  opts?: { category?: string; cursor?: string; limit?: number },
): ZmlCatalogResponse | null {
  const pack = getPack(market);
  if (!pack) return null;

  let rights = buildZmlCatalogForMarket(origin, market);
  if (opts?.category) {
    rights = rights.filter((r) => r.category === opts.category);
  }
  rights = [...rights].sort((a, b) => a.id.localeCompare(b.id));

  let start = 0;
  if (opts?.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(opts.cursor, "base64url").toString("utf8")) as {
        id: string;
      };
      const idx = rights.findIndex((r) => r.id === decoded.id);
      if (idx >= 0) start = idx + 1;
    } catch {
      start = 0;
    }
  }

  const limit = Math.min(opts?.limit ?? 50, 100);
  const slice = rights.slice(start, start + limit);
  const entries = slice.map((r) => toCatalogEntry(origin, pack, r));

  const next =
    start + limit < rights.length
      ? {
          next: `/api/rights/catalog?market=${pack.market}&cursor=${Buffer.from(
            JSON.stringify({ id: slice[slice.length - 1]?.id }),
            "utf8",
          ).toString("base64url")}`,
        }
      : undefined;

  return {
    zml_version: ZML_VERSION,
    api_version: RIGHTS_CATALOG_API_VERSION,
    market: pack.market,
    total: rights.length,
    rights: entries,
    _links: next,
  };
}

/** Clear in-memory catalog (tests). */
export function clearZmlCatalogCache(): void {
  catalogCache.clear();
}

import { MARKETS } from "@/lib/global/registry";
import { isCatalogMarket } from "@/lib/global/marketGeo";
import type { JurisdictionPack } from "@/lib/global/types";
import { loadZmlRightsForMarket } from "@/lib/protocol/packs/loader";
import { predicateSummaryForRight } from "./legacy-adapter";
import type { ZmlCatalogEntry, ZmlCatalogResponse, ZmlRight } from "./types";
import { ZML_VERSION } from "./constants";

export const RIGHTS_CATALOG_API_VERSION = "2026-08-01";

const catalogCache = new Map<string, { rights: ZmlRight[]; builtAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getPack(market: string): JurisdictionPack | null {
  const code = market.toUpperCase();
  if (!isCatalogMarket(code)) return null;
  return MARKETS[code]?.pack ?? null;
}

export async function buildZmlCatalogForMarket(
  origin: string,
  market: string,
): Promise<ZmlRight[]> {
  const key = market.toUpperCase();
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return cached.rights;
  }
  const { rights } = await loadZmlRightsForMarket(key, { origin });
  catalogCache.set(key, { rights, builtAt: Date.now() });
  return rights;
}

export async function findZmlRight(origin: string, idOrKey: string): Promise<ZmlRight | null> {
  const { findZmlRightById } = await import("@/lib/protocol/packs/loader");
  return findZmlRightById(origin, idOrKey);
}

function toCatalogEntry(right: ZmlRight): ZmlCatalogEntry {
  return {
    id: right.id,
    display_name: right.display_name,
    category: right.category,
    market: right.market,
    predicate_summary: "See predicate in full document",
    auto_eligible: right.action.auto_eligible ?? false,
    financial: right.financial,
    _links: {
      self: `/api/rights/catalog/${right.id}`,
      full: `/api/rights/catalog/${right.id}?full=1`,
      evaluate: `/api/rights/evaluate/${right.id}`,
    },
  };
}

export async function buildCatalogResponse(
  origin: string,
  market: string,
  opts?: { category?: string; cursor?: string; limit?: number },
): Promise<ZmlCatalogResponse | null> {
  const code = market.toUpperCase();
  if (!isCatalogMarket(code)) return null;
  const pack = getPack(code);

  let rights = await buildZmlCatalogForMarket(origin, code);
  if (rights.length === 0) return null;
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
  const entries = slice.map((r) => toCatalogEntry(r));

  const next =
    start + limit < rights.length
      ? {
          next: `/api/rights/catalog?market=${code}&cursor=${Buffer.from(
            JSON.stringify({ id: slice[slice.length - 1]?.id }),
            "utf8",
          ).toString("base64url")}`,
        }
      : undefined;

  return {
    zml_version: ZML_VERSION,
    api_version: RIGHTS_CATALOG_API_VERSION,
    market: pack?.market ?? code,
    total: rights.length,
    rights: entries,
    _links: next,
  };
}

/** Clear in-memory catalog (tests). */
export function clearZmlCatalogCache(): void {
  catalogCache.clear();
}

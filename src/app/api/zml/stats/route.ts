import { NextResponse } from "next/server";
import { allMarkets } from "@/lib/global/registry";
import { CATALOG_ONLY_MARKETS } from "@/lib/global/marketGeo";
import { loadZmlRightsForMarket } from "@/lib/protocol/packs/loader";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";

export const runtime = "nodejs";
export const revalidate = 600;

const cache = new Map<string, { ts: number; markets: Record<string, number> }>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const now = Date.now();
  let hit = cache.get(origin);
  if (!hit || now - hit.ts > TTL_MS) {
    const codes = [...allMarkets().map((m) => m.code), ...Object.keys(CATALOG_ONLY_MARKETS)];
    const markets: Record<string, number> = {};
    for (const code of codes) {
      try {
        const { rights } = await loadZmlRightsForMarket(code, { origin, forceRefresh: false });
        markets[code] = rights.length;
      } catch {
        markets[code] = 0;
      }
    }
    hit = { ts: now, markets };
    cache.set(origin, hit);
  }

  const total = Object.values(hit.markets).reduce((s, n) => s + n, 0);

  return NextResponse.json(
    {
      zml_version: ZML_VERSION,
      total_rights: total,
      markets: hit.markets,
      contribute: "docs/COUNTRY_PACKS.md",
      disclaimer: "Counts reflect deployed catalog at probe time — not a roadmap promise.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
      },
    },
  );
}

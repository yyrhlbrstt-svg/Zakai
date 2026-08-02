import { NextResponse } from "next/server";
import { allMarkets } from "@/lib/global/registry";
import { CATALOG_ONLY_MARKETS } from "@/lib/global/marketGeo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const markets = [
    ...allMarkets().map((m) => ({
      code: m.code,
      label: m.label,
      ui_locales: m.uiLocales,
      capabilities: ["rights_engine", "letters", "zml_catalog"] as const,
      links: {
        rights_catalog: `${origin}/api/rights/catalog?market=${m.code}`,
        rights_page: `${origin}/en/rights`,
      },
    })),
    ...Object.entries(CATALOG_ONLY_MARKETS).map(([code, meta]) => ({
      code,
      label: meta.label,
      ui_locales: [...meta.uiLocales],
      capabilities: ["zml_catalog"] as const,
      links: {
        rights_catalog: `${origin}/api/rights/catalog?market=${code}`,
        rights_page: `${origin}/en/rights`,
      },
    })),
  ].sort((a, b) => a.code.localeCompare(b.code));

  return NextResponse.json(
    {
      ok: true,
      api_version: "2026-08-02",
      default_market: "IL",
      markets,
      contribute: "https://github.com/zakai/zakai/blob/main/docs/COUNTRY_PACKS.md",
      _links: {
        protocol: `${origin}/api/protocol`,
        openapi: `${origin}/.well-known/zakai-openapi.json`,
        global_hub: `${origin}/en/global`,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

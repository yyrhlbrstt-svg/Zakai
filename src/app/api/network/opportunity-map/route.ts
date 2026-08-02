import { NextResponse } from "next/server";
import { REVENUE_VERTICALS, revenueVerticalsForMarket } from "@/lib/network/revenueVerticals";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
};

/**
 * Machine-readable map of monetizable problems Zakai addresses — for agents,
 * partners, and institutional discovery. Indicative amounts only; not offers.
 */
export async function GET(request: Request) {
  const market = new URL(request.url).searchParams.get("market")?.toUpperCase();
  const verticals = market ? revenueVerticalsForMarket(market) : [...REVENUE_VERTICALS];

  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      ok: true,
      updated: "2026-08-02",
      disclaimer:
        "avgRecoveryMinor is an indicative headline from public market research — not a guarantee to any user.",
      network: {
        trust_registry: `${origin}/.well-known/zakai-trust-registry.json`,
        mandate_discovery: `${origin}/.well-known/zakai-mandate.json`,
        oracle_predict: `${origin}/api/oracle/predict`,
        mcp_binary: "zakai-mandate-mcp",
      },
      verticals,
    },
    { headers: cors },
  );
}

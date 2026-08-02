import { NextResponse } from "next/server";
import { buildReadinessSnapshot } from "@/lib/network/readinessLayers";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
};

/**
 * Non-secret deploy readiness for partners and agents. Never exposes env values.
 * Payment provider name only — not keys.
 */
export async function GET() {
  const { layers, paymentProvider, operationalScore, tier } = buildReadinessSnapshot();

  return NextResponse.json(
    {
      ok: true,
      updated: "2026-08-02",
      disclaimer: "Booleans only — no secrets. Consumer agent loops need SMTP for outbound mail.",
      operationalScore,
      tier,
      paymentProvider,
      layers,
      urls: {
        opportunity_map: "/api/network/opportunity-map",
        mandate_verify: "/api/mandate/verify",
        integrations: "/en/integrations",
        network_proof: "/en/network-proof",
      },
    },
    { headers: cors },
  );
}

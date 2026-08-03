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
  const snapshot = buildReadinessSnapshot();

  return NextResponse.json(
    {
      ok: true,
      updated: "2026-08-03",
      disclaimer: "Booleans only — no secrets. Consumer agent loops need SMTP for outbound mail.",
      operationalScore: snapshot.operationalScore,
      tier: snapshot.tier,
      consumerReleaseScore: snapshot.consumerReleaseScore,
      canReleaseConsumerApp: snapshot.canReleaseConsumerApp,
      paymentsMode: snapshot.paymentsMode,
      layers: snapshot.layers,
      urls: {
        opportunity_map: "/api/network/opportunity-map",
        mandate_verify: "/api/mandate/verify",
        integrations: "/en/integrations",
        network_proof: "/en/network-proof",
        release_gate: "/api/release-gate",
      },
    },
    { headers: cors },
  );
}

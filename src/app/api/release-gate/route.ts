import { NextResponse } from "next/server";
import { evaluateConsumerReleaseGate } from "@/lib/deploy/releaseGate";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/**
 * Public consumer release gate — booleans and scores only, never env values.
 * Founder uses this to verify production before shipping.
 */
export async function GET() {
  const gate = evaluateConsumerReleaseGate();
  const failing = gate.checks
    .filter((c) => c.level !== "optional" && !c.ok)
    .map((c) => ({ id: c.id, level: c.level, envKeys: c.envKeys, cost: c.cost }));

  return NextResponse.json(
    {
      ok: true,
      releaseScore: gate.releaseScore,
      canReleaseConsumerApp: gate.canReleaseConsumerApp,
      failing,
      docs: {
        excellence: "docs/EXCELLENCE_SCORECARD.md",
        vercel: "docs/VERCEL_PRODUCTION_CHECKLIST.md",
        bootstrap: "node scripts/bootstrap-release-env.mjs",
      },
    },
    { headers: cors },
  );
}

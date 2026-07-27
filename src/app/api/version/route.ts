import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

/**
 * Deploy probe — open this URL after Redeploy to confirm production is on latest main.
 * Expected: version >= 0.2.0 and buildId present.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "0.2.0",
    buildMarker: "mandate-ui-priority-2026-07-27",
    ai: { available: aiAvailable(), provider: aiProvider() },
    features: {
      leaks: true,
      cancel: true,
      moneyHub: true,
      mandateOnAuthorization: true,
      selfServeStart: true,
      negotiationFollowUp: true,
      strategyOutcome: true,
    },
    time: new Date().toISOString(),
  });
}

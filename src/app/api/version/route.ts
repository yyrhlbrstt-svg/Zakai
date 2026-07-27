import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

/**
 * Deploy probe — open this URL after Redeploy to confirm production is on latest main.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "0.2.4",
    buildMarker: "scan-to-case-viral-2026-07-28",
    ai: { available: aiAvailable(), provider: aiProvider() },
    features: {
      leaks: true,
      cancel: true,
      moneyHub: true,
      fromScanCase: true,
      mandateOnAuthorization: true,
      selfServeStart: true,
      negotiationFollowUp: true,
      strategyOutcome: true,
      viralAfterSaved: true,
    },
    time: new Date().toISOString(),
  });
}

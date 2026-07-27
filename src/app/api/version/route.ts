import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "0.2.5",
    buildMarker: "scan-parity-sent-nudge-2026-07-28",
    ai: { available: aiAvailable(), provider: aiProvider() },
    features: {
      leaks: true,
      cancel: true,
      moneyHub: true,
      fromScanCase: true,
      scanOneClick: true,
      sentCronNudge: true,
      cancelPrefill: true,
      mandateOnAuthorization: true,
      selfServeStart: true,
      negotiationFollowUp: true,
      strategyOutcome: true,
      viralAfterSaved: true,
    },
    time: new Date().toISOString(),
  });
}

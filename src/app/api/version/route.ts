import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "0.3.3",
    buildMarker: "overnight-agent-mandate-qr-2026-07-28",
    positioning: "standard consumer money agent",
    ai: { available: aiAvailable(), provider: aiProvider() },
    markets: ["IL", "GB", "US", "DE", "FR", "CA"],
    features: {
      moneyOs: true,
      fromScanCase: true,
      scanOneClick: true,
      sentCronNudge: true,
      cancelPrefill: true,
      mandate: true,
      mandateQr: true,
      overnightAgent: true,
      agentAutoApprove: true,
      recheckReminders: true,
      competitorFollowUp: true,
      viralAfterSaved: true,
      leaksDemandEngine: true,
      globalMarketsStrip: true,
    },
    time: new Date().toISOString(),
  });
}

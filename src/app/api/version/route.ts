import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "0.3.10",
    buildMarker: "agent-autofollow-webpush-2026-07-28",
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
      agentAutoFollowUp: true,
      recheckReminders: true,
      competitorFollowUp: true,
      documentVault: true,
      yearWrapped: true,
      publicProofWall: true,
      householdMode: true,
      airlineCase: true,
      refundChaseCase: true,
      bankFeesCase: true,
      parkingCase: true,
      transportFineCase: true,
      b2bEmbed: true,
      viralAfterSaved: true,
      leaksDemandEngine: true,
      globalMarketsStrip: true,
      inboundEmailProof: true,
      webPush: true,
    },
    time: new Date().toISOString(),
  });
}

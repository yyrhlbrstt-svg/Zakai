import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "1.2.0",
    buildMarker: "final-dual-track-production-2026-07-28",
    positioning: "standard consumer money agent + Mandate infrastructure",
    tracks: {
      consumer:
        "problem doors · Money OS · electricity/bank/cancel/airline full agent · household · viral SAVED · persistence recheck",
      infrastructure:
        "Ed25519 Mandate · JWKS · CORS verify · OpenAPI · B2B embed · institutional pilot",
    },
    flags: {
      problemFirstHomepage: true,
      dualTrackBusinessPage: true,
      whatAmIOwedActionDoors: true,
      usPackDeep: true,
      dualTrackNav: true,
      embedPathAwarePreview: true,
      emptyDashboardProblemDoors: true,
      priorityAgenticBoost: true,
      openapiInstitutional: true,
      b2bDualTrackLeads: true,
      agentRoundVisibility: true,
      institutionalPilotCta: true,
      monthlyDigestOpenSent: true,
      providerHeRegistry: true,
      electricityFullService: true,
      householdMode: true,
      persistenceRecheck: true,
      mandateCorsVerify: true,
      ownershipMagicLink: true,
      inboundProofsLoop: true,
      webPush: true,
    },
    ai: { available: aiAvailable(), provider: aiProvider() },
    markets: ["IL", "GB", "US", "DE", "FR", "CA"],
    fullVerticalsIL: [
      "telecom",
      "bank-fees",
      "subscription",
      "airline",
      "refund-chase",
      "parking",
      "transport-fine",
      "electricity",
    ],
    see: {
      app: process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app",
      version: "/api/version",
      mandate: "/.well-known/zakai-mandate.json",
      jwks: "/.well-known/zakai-jwks.json",
      openapi: "/api/mandate/openapi.json",
      howTo: "HOW-TO-SEE.md (repo root)",
    },
    time: new Date().toISOString(),
  });
}

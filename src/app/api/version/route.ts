import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";
import pkg from "../../../../package.json";
import { allMarkets } from "@/lib/global/registry";
import { CATALOG_ONLY_MARKETS } from "@/lib/global/marketGeo";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { emailConfigured } from "@/lib/messaging";
import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

/** Public version probe — no AI provider, ops flags, or market inventory (see internal). */
export async function GET(request: Request) {
  const marketCodes = [
    ...allMarkets().map((m) => m.code),
    ...Object.keys(CATALOG_ONLY_MARKETS),
  ].sort();

  const internal = isInternalOpsRequest(request);

  const publicBase = {
    ok: true,
    name: "zakai",
    version: pkg.version,
    buildMarker: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    see: {
      app: APP_URL,
      protocol: "/.well-known/zakai-protocol.json",
      interop: "/.well-known/zakai-interop.json",
      mandate: "/.well-known/zakai-mandate.json",
      markets: "/api/markets",
      domains: "/.well-known/zakai-domains.json",
      howTo: "HOW-TO-SEE.md (repo root)",
    },
    time: new Date().toISOString(),
  };

  if (!internal) {
    return NextResponse.json(publicBase);
  }

  return NextResponse.json({
    ...publicBase,
    positioning: "standard consumer money agent + Mandate infrastructure",
    operations: {
      payments_live: paymentsFullyLive(),
      email_delivery: emailConfigured(),
    },
    ai: { available: aiAvailable(), provider: aiProvider() },
    markets: marketCodes,
    see: {
      ...publicBase.see,
      version: "/api/version",
      zml_schema: "/.well-known/zakai-rights-schema.json",
      rights_catalog: "/api/rights/catalog?market={market}",
      global_hub: "/en/global",
      interop_probe: "/api/interop?probe=1",
      network: "/api/network",
      jwks: "/.well-known/zakai-jwks.json",
      openapi: "/api/mandate/openapi.json",
      health_internal: "/api/health?internal=1",
    },
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
    fullVerticalsIL: [
      "telecom",
      "bank-fees",
      "subscription",
      "airline",
      "refund-chase",
      "parking",
      "transport-fine",
      "electricity",
      "late-payment",
      "deposit",
      "duplicate-insurance",
      "arnona",
    ],
  });
}

import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";
import { version as pkgVersion } from "../../../../package.json";
import { allMarkets } from "@/lib/global/registry";
import { CATALOG_ONLY_MARKETS } from "@/lib/global/marketGeo";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { emailConfigured } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/** Public version probe — no internal product flags (see ?internal=1 + admin token). */
export async function GET(request: Request) {
  const marketCodes = [
    ...allMarkets().map((m) => m.code),
    ...Object.keys(CATALOG_ONLY_MARKETS),
  ].sort();

  const url = new URL(request.url);
  const adminToken = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  const internal =
    url.searchParams.get("internal") === "1" &&
    adminToken &&
    request.headers.get("x-zakai-admin-token") === adminToken;

  const base = {
    ok: true,
    name: "zakai",
    version: pkgVersion,
    buildMarker: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    positioning: "standard consumer money agent + Mandate infrastructure",
    operations: {
      payments_live: paymentsFullyLive(),
      email_delivery: emailConfigured(),
    },
    ai: { available: aiAvailable(), provider: aiProvider() },
    markets: marketCodes,
    see: {
      app: process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app",
      version: "/api/version",
      protocol: "/.well-known/zakai-protocol.json",
      zml_schema: "/.well-known/zakai-rights-schema.json",
      rights_catalog: "/api/rights/catalog?market={market}",
      markets: "/api/markets",
      global_hub: "/en/global",
      interop: "/.well-known/zakai-interop.json",
      interop_probe: "/api/interop?probe=1",
      network: "/api/network",
      mandate: "/.well-known/zakai-mandate.json",
      jwks: "/.well-known/zakai-jwks.json",
      openapi: "/api/mandate/openapi.json",
      howTo: "HOW-TO-SEE.md (repo root)",
    },
    time: new Date().toISOString(),
  };

  if (!internal) {
    return NextResponse.json(base);
  }

  return NextResponse.json({
    ...base,
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

import { NextResponse } from "next/server";
import { aiAvailable, aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "zakai",
    version: "1.1.0",
    buildMarker: "final-dual-track-surface-2026-07-28",
    positioning: "standard consumer money agent + Mandate infrastructure",
    tracks: {
      consumer:
        "problem doors · Money OS · electricity/bank/cancel/airline full agent · household · viral SAVED",
      infrastructure:
        "Ed25519 Mandate · JWKS · CORS verify · OpenAPI · B2B embed · institutional pilot",
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
      howTo: "/HOW-TO-SEE.md (repo root)",
    },
    time: new Date().toISOString(),
  });
}

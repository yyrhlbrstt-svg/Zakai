import { NextResponse } from "next/server";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * How to run a sandbox second issuer for demos without greening G5.
 * Sandbox status never counts as network control.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  return NextResponse.json(
    {
      spec: "zakai-sandbox-issuer",
      version: "2026-08-03",
      status: "documentation_only",
      honesty:
        "Sandbox issuers must use status \"sandbox\". They are refused by decideTrust in production paths and do not increment G5. A real second issuer requires human admission after evidence dry-run.",
      env_example: {
        ZAKAI_EXTRA_ISSUERS_JSON: [
          {
            iss: "https://sandbox.issuer.example",
            name: "Sandbox Issuer (demo)",
            jwksUri: "https://sandbox.issuer.example/.well-known/jwks.json",
            statusListUri: "https://sandbox.issuer.example/api/mandate/revocations",
            allowedScopes: ["read:bills", "dispute:charge"],
            status: "sandbox",
            admittedAt: "2026-08-03",
            note: "Local evaluation only — not a network issuer.",
          },
        ],
      },
      production_path: {
        evidence_dry_run: `${origin}/api/mandate/delegation/evidence`,
        apply_delegated: `${origin}/api/mandate/delegation/apply`,
        admit_script: "npm run delegation:admit-pilot",
        gate: "G5_second_issuer on /api/network/trillion-gates",
      },
      vectors: {
        decide: `${origin}/api/mandate/test-vectors`,
        settle: `${origin}/api/settlement/test-vectors`,
      },
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControlHeader("catalog"),
      },
    },
  );
}

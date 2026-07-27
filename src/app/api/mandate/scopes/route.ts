import { NextResponse } from "next/server";
import { SCOPES, FORBIDDEN_SCOPES } from "@/lib/mandate/scopes";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Public vocabulary of Mandate capabilities.
 * Institutions map their internal permissions onto this closed set.
 * Forbidden scopes are listed explicitly so absence is not ambiguity.
 */
export async function GET() {
  return NextResponse.json(
    {
      version: 1,
      scopes: SCOPES.map((s) => ({
        scope: s.scope,
        tier: s.tier,
        perActConfirmation: s.perActConfirmation,
        summary: s.summary,
      })),
      forbidden: [...FORBIDDEN_SCOPES],
      note: "Unknown scopes on a Mandate must be rejected, not ignored.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

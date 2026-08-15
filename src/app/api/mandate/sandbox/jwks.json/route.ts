import { NextResponse } from "next/server";
import { sandboxJwks } from "@/lib/mandate/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The sandbox public key, served separately from the production JWKS.
 *
 * Kept off `/.well-known/zakai-jwks.json` on purpose. A verifier that resolves
 * an issuer to its JWKS must never find a sandbox key at the production
 * issuer's URI, or the separation between "valid signature" and "valid
 * authority" would collapse into a single document.
 *
 * `no-store` because the key is generated per process and dies with it. A
 * cached copy would outlive the key it describes and produce verification
 * failures that look like tampering.
 */
export async function GET() {
  const jwks = await sandboxJwks();
  return NextResponse.json(
    {
      ...jwks,
      warning:
        "Sandbox key, regenerated on every server start. Signatures made with it prove integrity only — never authority. The production trust registry does not list the sandbox issuer.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

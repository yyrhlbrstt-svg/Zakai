import { NextResponse } from "next/server";
import { issueVerifierReadinessDemoToken } from "@/lib/mandate/demoVerifierReadiness";
import { VERIFIER_READINESS_AUDIENCE } from "@/lib/referenceVerifier";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/** Demo JWT for the Reference Verifier readiness wizard (verify API self-test). */
export async function GET() {
  const sample = await issueVerifierReadinessDemoToken();
  if (!sample) {
    return NextResponse.json(
      { ok: false, error: "mandate_keys_not_configured" },
      { status: 503, headers: CORS },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      audience: VERIFIER_READINESS_AUDIENCE,
      token: sample.token,
      jti: sample.jti,
    },
    { headers: CORS },
  );
}

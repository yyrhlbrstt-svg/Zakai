import { NextResponse } from "next/server";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";
import { MandateKeyUnavailableError, loadSigningKeyFromEnv } from "@/lib/mandate/mandate";
import { emailConfigured } from "@/lib/messaging";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
};

function mandateLive(): boolean {
  try {
    loadSigningKeyFromEnv();
    return true;
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) return false;
    return false;
  }
}

/** Live pipe manifest + health of each rail. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pipe = buildZakaiPipeDocument(origin);
  const authorityLive = mandateLive();

  return NextResponse.json(
    {
      ok: true,
      ...pipe,
      health: {
        authority_signing: authorityLive,
        email_delivery: emailConfigured(),
        payments_live: paymentsFullyLive(),
        pipe_ready: authorityLive,
        note: authorityLive
          ? "Mandate signing live — SENT cases carry verifiable JWS on the pipe."
          : "Mandate keys not configured in this environment — human Authorization still works; machine pipe soft-degrades.",
      },
    },
    { headers: CORS },
  );
}

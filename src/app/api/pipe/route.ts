import { NextResponse } from "next/server";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";
import { loadPipeNetworkVolume } from "@/lib/pipe/loadPipeNetwork";
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

/** Live pipe manifest + health + de-identified network volume. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pipe = buildZakaiPipeDocument(origin);
  const authorityLive = mandateLive();
  const network = await loadPipeNetworkVolume();

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
      network: {
        ...network,
        disclaimer:
          "Counts are de-identified aggregates. Empty is honest. Visa-scale gravity requires volume, not slides.",
      },
    },
    { headers: CORS },
  );
}

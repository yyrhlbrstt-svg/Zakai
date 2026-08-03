import { NextResponse } from "next/server";
import { WELL_KNOWN_RELATIVE, absoluteWellKnown } from "@/lib/protocol/laws";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Machine "acceptance mark" — institutions publish this URL when they process
 * Zakai Mandates (like displaying a Visa mark). Does not claim any named bank.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      mark: "zakai-pipe-acceptor",
      version: "2026-08-03",
      meaning:
        "This organisation can verify inbound Zakai Mandates (JWKS + decide/accept) without calling Zakai back.",
      verify: {
        jwks: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.jwks),
        accept: `${origin}/api/pipe/accept`,
        decide: `${origin}/api/mandate/decide`,
        inbound_spec: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.inboundReceive),
      },
      human: `${origin}/he/pipe`,
      manifesto: absoluteWellKnown(origin, WELL_KNOWN_RELATIVE.pipe),
      laws: [
        "No outbound money scopes",
        "Inbound-only — institution never callbacks Zakai to verify",
        "Fee only after SavingsProof on the consumer side",
      ],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControlHeader("catalog"),
      },
    },
  );
}

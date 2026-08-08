import { NextResponse } from "next/server";
import { loadSigningKeyFromEnv, publicJwkFor, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { verifySettlement, SettlementVerifyError } from "@/lib/mandate/settlementRecord";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check a settlement without trusting us.
 *
 * A signed record nobody can check is the same thing as an unsigned one. The
 * whole point of signing an outcome is that a counterparty, a regulator, or
 * the person holding it can confirm the facts independently — so the check has
 * to be reachable by all three, none of whom has an account here.
 *
 * Unauthenticated and CORS-open on purpose: requiring a credential to verify a
 * public record would defeat the property it exists to provide. It also
 * reveals nothing an attacker gains from, because a settlement carries no
 * person — no name, email, phone or case id — and this endpoint only ever
 * echoes back what was already inside the token the caller supplied.
 *
 * Better still, they need not call this at all: the same check runs offline
 * against /.well-known/zakai-jwks.json with any JOSE library. This endpoint is
 * a convenience, not a dependency, and saying so is the difference between
 * infrastructure and a service someone has to keep paying for.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  // Protects CPU from signature spam. There is no authority here to protect.
  const limited = await rateLimit("settlement-verify", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  let body: { settlement?: string; jws?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: CORS });
  }

  const jws = (body.settlement || body.jws || body.token || "").trim();
  if (!jws) {
    return NextResponse.json(
      { error: "missing_fields", hint: 'POST { "settlement": "<compact-jws>" }' },
      { status: 400, headers: CORS },
    );
  }
  if (jws.length > 16_384) {
    return NextResponse.json({ error: "token_too_large" }, { status: 400, headers: CORS });
  }

  let publicJwk;
  try {
    publicJwk = await publicJwkFor(loadSigningKeyFromEnv());
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      // Says which side is unconfigured. "Invalid" here would tell a holder
      // their genuine record is worthless, which is both wrong and unfixable
      // from their end.
      return NextResponse.json({ error: "issuer_key_unavailable" }, { status: 503, headers: CORS });
    }
    throw err;
  }

  try {
    const claims = await verifySettlement(jws, publicJwk);
    return NextResponse.json(
      {
        valid: true,
        counterparty: claims.counterparty,
        market: claims.market,
        vertical: claims.vertical,
        outcome: claims.outcome,
        beforeMinor: claims.beforeMinor,
        afterMinor: claims.afterMinor,
        recoveredMinor: claims.recoveredMinor,
        days: claims.days,
        // Surfaced, never smoothed over: a reader weighing this as evidence
        // needs to know whether a pipeline documented it or a person recalled it.
        selfReported: claims.selfReported,
        issuer: claims.iss,
        issuedAt: new Date(claims.iat * 1000).toISOString(),
      },
      { headers: CORS },
    );
  } catch (err) {
    if (err instanceof SettlementVerifyError) {
      // The reason is the useful part — "wrong type" and "bad signature" mean
      // very different things to whoever is holding this.
      return NextResponse.json(
        { valid: false, reason: err.code, message: err.message },
        { status: 400, headers: CORS },
      );
    }
    return NextResponse.json({ valid: false, reason: "MALFORMED" }, { status: 400, headers: CORS });
  }
}

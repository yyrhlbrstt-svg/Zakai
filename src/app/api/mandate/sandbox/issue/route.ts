import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSandboxMandate, SANDBOX_TTL_SECONDS } from "@/lib/mandate/sandbox";
import { MandateError } from "@/lib/mandate/mandate";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a sandbox mandate so an integrator can actually run the quickstart.
 *
 * Deliberately unauthenticated: requiring a key to obtain a token that grants
 * nothing would reinstate exactly the barrier this removes — "find a human
 * first" — which is the failure mode the whole inbound-only protocol exists to
 * avoid. What makes that safe is not a credential but the containment in
 * lib/mandate/sandbox.ts: the issuer is absent from the trust registry, so a
 * token from here is refused by the production verifier as UNKNOWN_ISSUER.
 * That is asserted directly, against the real verify path, in sandbox.test.ts.
 *
 * Rate limiting here is therefore about protecting the server's CPU from
 * signature spam, not about protecting authority — there is no authority here
 * to protect.
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

const Body = z.object({
  // Closed set is enforced by validateScopes inside issueSandboxMandate; the
  // cap here only stops a caller making us validate an unbounded array.
  scopes: z.array(z.string().min(1).max(64)).min(1).max(8),
  principalName: z.string().max(80).optional(),
  agent: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-sandbox-issue", clientIp(req), 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      {
        error: "invalid_body",
        hint: 'POST { "scopes": ["read:bills"] }',
      },
      { status: 400, headers: CORS },
    );
  }

  try {
    const origin = new URL(req.url).origin;
    const mandate = await issueSandboxMandate({
      origin,
      scopes: parsed.scopes,
      principalName: parsed.principalName,
      agent: parsed.agent,
    });

    return NextResponse.json(
      {
        ...mandate,
        ttlSeconds: SANDBOX_TTL_SECONDS,
        jwksUri: `${origin}/api/mandate/sandbox/jwks.json`,
        // Said in the response itself, so an integrator reading only the JSON
        // still learns it before wiring anything to it.
        warning:
          "SANDBOX ONLY. This mandate grants no authority and names no real person. The production verifier rejects it with UNKNOWN_ISSUER. Verify it against jwksUri, not the production JWKS.",
      },
      { status: 200, headers: CORS },
    );
  } catch (err) {
    if (err instanceof MandateError) {
      // The protocol's own scope rules apply here, so an integrator learns
      // immediately that a scope is forbidden rather than at go-live.
      return NextResponse.json(
        { error: "invalid_scopes", detail: err.message },
        { status: 400, headers: CORS },
      );
    }
    return NextResponse.json({ error: "sandbox_unavailable" }, { status: 503, headers: CORS });
  }
}

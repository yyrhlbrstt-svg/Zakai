import { NextResponse } from "next/server";
import { z } from "zod";
import type { JWK } from "jose";
import { probeIssuer } from "@/lib/mandate/probe";
import { assessConformance } from "@/lib/mandate/conformance";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Independent conformance probing for a candidate issuer.
 *
 * The candidate posts artifacts they already have — their public JWKS and a
 * sample mandate token or two — and this endpoint runs Zakai's own reference
 * verifier against them as a neutral judge, rather than trusting a
 * self-reported CheckResult[]. See lib/mandate/probe.ts for exactly which of
 * the ten published checks this can honestly settle from submitted artifacts.
 *
 * The JWKS is submitted inline, not fetched from a candidate-supplied URL —
 * fetching an arbitrary caller-controlled URL server-side would make this
 * endpoint an SSRF probe against internal network addresses. Any candidate
 * that already runs the JWKS endpoint the standard requires can trivially
 * paste its contents.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const jwkSchema = z.record(z.string(), z.unknown()).and(z.object({ kty: z.string() }));

const schema = z.object({
  jwks: z.array(jwkSchema).min(1).max(8),
  audience: z.string().trim().min(1).max(200),
  sampleValidToken: z.string().trim().min(1).max(16_384),
  sampleExpiredToken: z.string().trim().min(1).max(16_384).optional(),
  /** Signed statuslist+jwt with the sample's idx revoked — settles revocation_takes_effect. */
  sampleStatusListToken: z.string().trim().min(1).max(65_536).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-conformance-probe", clientIp(req), 20, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400, headers: CORS });
  }

  const { jwks, audience, sampleValidToken, sampleExpiredToken, sampleStatusListToken } =
    parsed.data;

  const results = await probeIssuer({
    jwks: jwks as JWK[],
    audience,
    sampleValidToken,
    sampleExpiredToken,
    sampleStatusListToken,
  });
  const report = assessConformance(results);

  return NextResponse.json({ results, report }, { headers: CORS });
}

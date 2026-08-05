import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyTrackRecordCredential,
  TrackRecordVerifyError,
} from "@/lib/mandate/trackRecordCredential";
import { loadSigningKeyFromEnv, publicJwkFor, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10).max(4000) });

/**
 * Verify a track-record credential someone handed you — a bank weighing a
 * new account, a landlord, an employer. Public and unauthenticated on
 * purpose: the whole point of a portable, signed credential is that the
 * recipient can check it without an account, a login, or implementing
 * Ed25519 JWT verification themselves. This is that check, done once,
 * correctly, so nobody downstream has to.
 *
 * Same public key /.well-known/zakai-jwks.json publishes — loaded directly
 * rather than fetched over HTTP since this server IS the issuer.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("track-record-verify", clientIp(request), 60, 60);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  try {
    const key = loadSigningKeyFromEnv();
    const jwk = await publicJwkFor(key);
    const claims = await verifyTrackRecordCredential(parsed.data.token, [jwk]);
    return NextResponse.json({
      ok: true,
      verified: true,
      issuer: claims.iss,
      issuedAt: new Date(claims.iat * 1000).toISOString(),
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      stats: claims.stats,
      note: "A signed fact about this account's own documented past — not a Mandate, carries no authority to act on anyone's behalf.",
    });
  } catch (err) {
    if (err instanceof TrackRecordVerifyError) {
      return NextResponse.json({ ok: true, verified: false, reason: err.code }, { status: 200 });
    }
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "signing_unavailable" }, { status: 503 });
    }
    await reportError(err, { route: "authority-track-record-verify" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}

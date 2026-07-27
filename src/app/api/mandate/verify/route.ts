import { NextResponse } from "next/server";
import {
  verifyMandate,
  publicJwkFor,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reference verifier for institutions and for our own tooling.
 *
 * Body: { token: string, audience: string }
 * Returns claims when the signature is valid, audience matches, and the jti
 * has not been revoked. Mirrors what a bank should implement against JWKS.
 */
export async function POST(req: Request) {
  let body: { token?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = (body.token || "").trim();
  const audience = (body.audience || "").trim();
  if (!token || !audience) {
    return NextResponse.json(
      { error: "missing_fields", need: ["token", "audience"] },
      { status: 400 },
    );
  }

  try {
    const key = loadSigningKeyFromEnv();
    const jwk = await publicJwkFor(key);
    const claims = await verifyMandate(token, {
      audience,
      publicJwks: [jwk],
    });

    let status: "active" | "revoked" | "unknown" = "active";
    try {
      const row = await prisma.mandateRevocation.findUnique({
        where: { jti: claims.jti },
        select: { jti: true },
      });
      if (row) status = "revoked";
    } catch {
      status = "unknown";
    }

    if (status === "revoked") {
      return NextResponse.json(
        { valid: false, reason: "revoked", jti: claims.jti },
        { status: 410 },
      );
    }

    return NextResponse.json({
      valid: true,
      status,
      claims: {
        jti: claims.jti,
        aud: claims.aud,
        sub: claims.sub,
        scopes: claims.scopes,
        market: claims.market,
        exp: claims.exp,
        principal: claims.principal,
        statement: claims.statement,
      },
    });
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json({ error: "mandate_keys_not_configured" }, { status: 503 });
    }
    if (err instanceof MandateError) {
      return NextResponse.json(
        { valid: false, reason: err.code, message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }
}

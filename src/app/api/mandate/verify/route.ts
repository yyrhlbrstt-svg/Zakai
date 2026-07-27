import { NextResponse } from "next/server";
import {
  verifyMandate,
  publicJwkFor,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-verify", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

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
  if (token.length > 16_384) {
    return NextResponse.json({ error: "token_too_large" }, { status: 400 });
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

import { NextResponse } from "next/server";
import { MandateError, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import {
  verifyMandateWithTrustRegistry,
  RegistryVerifyError,
} from "@/lib/mandate/verifyWithRegistry";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Institutional clients verify offline; CORS lets bank/insurer portals call verify. */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const limited = await rateLimit("mandate-verify", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  let body: { token?: string; mandate?: string; jws?: string; audience?: string; aud?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: CORS });
  }

  // Quickstart / Python historically sent { mandate }; SDK clients send { token }.
  const token = (body.token || body.mandate || body.jws || "").trim();
  const audience = (body.audience || body.aud || "").trim();
  if (!token || !audience) {
    return NextResponse.json(
      {
        error: "missing_fields",
        need: ["token|mandate", "audience"],
        hint: "POST { \"mandate\": \"<compact-jws>\", \"audience\": \"your-institution-id\" }",
      },
      { status: 400, headers: CORS },
    );
  }
  if (token.length > 16_384) {
    return NextResponse.json({ error: "token_too_large" }, { status: 400, headers: CORS });
  }

  try {
    const { claims, issuer } = await verifyMandateWithTrustRegistry(token, { audience });

    // Fail closed on store failure: an unverifiable revocation check must not
    // mint valid:true (decide() already denies as revocation_unknown).
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
        { status: 410, headers: CORS },
      );
    }

    if (status === "unknown") {
      return NextResponse.json(
        { valid: false, reason: "revocation_unknown", jti: claims.jti },
        { status: 503, headers: CORS },
      );
    }

    return NextResponse.json(
      {
        valid: true,
        status,
        issuer: { iss: issuer.iss, name: issuer.name, status: issuer.status },
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
      },
      { headers: CORS },
    );
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return NextResponse.json(
        { error: "mandate_keys_not_configured" },
        { status: 503, headers: CORS },
      );
    }
    if (err instanceof RegistryVerifyError) {
      return NextResponse.json(
        { valid: false, reason: err.code, message: err.message },
        { status: 400, headers: CORS },
      );
    }
    if (err instanceof MandateError) {
      return NextResponse.json(
        { valid: false, reason: err.code, message: err.message },
        { status: 400, headers: CORS },
      );
    }
    throw err;
  }
}

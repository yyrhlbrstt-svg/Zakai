import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Mandate status — the recency half of institutional verification.
 *
 * Flow for a bank / insurer / municipality:
 *   1. Verify the JWS offline against /.well-known/zakai-jwks.json
 *   2. GET this endpoint with the mandate's `jti`
 *   3. Accept only if signature is valid AND status is "active"
 *
 * No auth on GET by design: the jti is high-entropy (cuid/uuid), and the
 * response reveals nothing about the principal — only whether that token
 * was withdrawn. Enumeration is not useful without a valid signature.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jti: string }> },
) {
  const { jti } = await ctx.params;
  const id = (jti || "").trim();

  if (!id || id.length < 8 || id.length > 128) {
    return NextResponse.json(
      { error: "invalid_jti" },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.mandateRevocation.findUnique({
      where: { jti: id },
      select: { jti: true, revokedAt: true },
    });

    if (row) {
      return NextResponse.json(
        {
          jti: row.jti,
          status: "revoked",
          revokedAt: row.revokedAt.toISOString(),
          checkedAt: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // No revocation row means active from our side. Expiry is enforced by the
    // verifier from the `exp` claim in the JWS — we do not re-check clocks here.
    return NextResponse.json(
      {
        jti: id,
        status: "active",
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch {
    // Table missing (migration not applied yet) or DB blip: fail with unknown
    // so the institution can decide policy rather than treating every mandate
    // as revoked during an outage.
    return NextResponse.json(
      {
        jti: id,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        hint: "status_store_unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

/**
 * Revoke a mandate by jti. Intended for authenticated product paths only
 * (user cancels, support, or case REVOKED). Body: { reason?: string }.
 * Until a session helper is wired here, this accepts a shared secret header
 * so the route is not a public kill-switch:
 *   X-Zakai-Revoke-Key: process.env.MANDATE_REVOKE_KEY
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ jti: string }> },
) {
  const { jti } = await ctx.params;
  const id = (jti || "").trim();
  if (!id || id.length < 8 || id.length > 128) {
    return NextResponse.json({ error: "invalid_jti" }, { status: 400 });
  }

  const expected = process.env.MANDATE_REVOKE_KEY;
  const provided = req.headers.get("x-zakai-revoke-key") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let reason = "user_request";
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    if (body.reason && typeof body.reason === "string") {
      reason = body.reason.slice(0, 120);
    }
  } catch {
    // keep default
  }

  try {
    const row = await prisma.mandateRevocation.upsert({
      where: { jti: id },
      create: { jti: id, reason },
      update: {},
      select: { jti: true, revokedAt: true, reason: true },
    });

    return NextResponse.json({
      jti: row.jti,
      status: "revoked",
      revokedAt: row.revokedAt.toISOString(),
      reason: row.reason,
    });
  } catch {
    return NextResponse.json(
      { error: "status_store_unavailable" },
      { status: 503 },
    );
  }
}

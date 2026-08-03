import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishRevocation } from "@/lib/mandate/statusIndex";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { secretsMatch } from "@/lib/security/timingSafe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

/**
 * Public Mandate status — recency half of institutional verification.
 * Rate-limited per IP to deter noisy probing; jti remains high-entropy.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ jti: string }> },
) {
  const limited = await rateLimit("mandate-status", clientIp(req), 120, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: cors },
    );
  }

  const { jti } = await ctx.params;
  const id = (jti || "").trim();

  if (!id || id.length < 8 || id.length > 128) {
    return NextResponse.json({ error: "invalid_jti" }, { status: 400, headers: cors });
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
        { headers: cors },
      );
    }

    return NextResponse.json(
      {
        jti: id,
        status: "active",
        checkedAt: new Date().toISOString(),
      },
      { headers: cors },
    );
  } catch {
    return NextResponse.json(
      {
        jti: id,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        hint: "status_store_unavailable",
      },
      { status: 503, headers: cors },
    );
  }
}

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
  // Constant-time via fixed-length hash comparison — the revoke key is a
  // shared secret, and `!==` on the raw strings leaks its bytes one at a time
  // to whoever can measure response latency across enough attempts.
  if (!expected || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let reason = "user_request";
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    if (body.reason && typeof body.reason === "string") {
      reason = body.reason.slice(0, 120);
    }
  } catch {
    /* default */
  }

  try {
    // Must allocate statusIndex — rows without an index never appear on the
    // signed /revocations list, so offline verifiers would keep treating the
    // mandate as active after an ops revoke.
    const row = await prisma.$transaction((tx) =>
      publishRevocation(tx, { jti: id, reason }),
    );

    return NextResponse.json({
      jti: row.jti,
      status: "revoked",
      revokedAt: row.revokedAt.toISOString(),
      reason: row.reason,
      statusIndex: row.statusIndex,
    });
  } catch {
    return NextResponse.json({ error: "status_store_unavailable" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  publishRevocation,
  StatusIndexUnknownError,
  StatusListCapacityError,
} from "@/lib/mandate/statusIndex";
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
    /**
     * Two different questions, answered together.
     *
     * `status` is the protocol answer and its meaning is unchanged: is this
     * identifier on the revocation list. Six reference verifiers and the
     * OpenAPI document depend on those exact words, so they stay.
     *
     * `issuedHere` is the honesty. Absence from a revocation list is not
     * evidence a mandate exists — an identifier nobody ever issued is also
     * absent from it, and this endpoint used to answer such a string with a
     * bare "active". A machine following the protocol was never misled by
     * that; a human pasting an identifier they were handed absolutely was,
     * and this endpoint is public precisely so humans can paste into it.
     */
    const [row, issued] = await Promise.all([
      prisma.mandateRevocation.findUnique({
        where: { jti: id },
        select: { jti: true, revokedAt: true },
      }),
      prisma.authorization
        .findUnique({ where: { mandateJti: id }, select: { id: true } })
        .catch(() => null),
    ]);

    if (row) {
      return NextResponse.json(
        {
          jti: row.jti,
          status: "revoked",
          issuedHere: true,
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
        issuedHere: Boolean(issued),
        checkedAt: new Date().toISOString(),
        means: issued
          ? "Issued by this issuer and not revoked."
          : "Not on the revocation list. No mandate with this identifier was issued here, and " +
            "absence from a revocation list is not proof a mandate exists — verify the signed " +
            "mandate itself at /api/mandate/inspect.",
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
    // Reuse the issue-time statusIndex only — inventing a new bit would leave
    // zkm.status.idx forever unset on the signed /revocations list.
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
  } catch (err) {
    if (err instanceof StatusIndexUnknownError) {
      return NextResponse.json(
        { error: "status_index_unknown", jti: id },
        { status: 409 },
      );
    }
    if (err instanceof StatusListCapacityError) {
      return NextResponse.json({ error: "status_list_capacity" }, { status: 503 });
    }
    return NextResponse.json({ error: "status_store_unavailable" }, { status: 503 });
  }
}

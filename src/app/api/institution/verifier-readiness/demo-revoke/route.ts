import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  publishRevocation,
  StatusIndexUnknownError,
  StatusListCapacityError,
} from "@/lib/mandate/statusIndex";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isVerifierReadinessDemoJti } from "@/lib/mandate/demoRevokeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/**
 * Demo-only revoke for Reference Verifier readiness JTIs (`readiness_*`).
 * Never accepts live consumer JTIs — banks exercise the revoke half of the
 * discover→verify→decide→revoke path without holding MANDATE_REVOKE_KEY.
 */
const bodySchema = z.object({
  jti: z.string().trim().min(12).max(128),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const limited = await rateLimit("verifier-demo-revoke", clientIp(req), 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success || !isVerifierReadinessDemoJti(parsed.data.jti)) {
    return NextResponse.json(
      {
        error: "invalid_jti",
        hint: "Only readiness_* demo JTIs from /api/institution/verifier-readiness/sample",
      },
      { status: 400, headers: CORS },
    );
  }

  const { jti } = parsed.data;

  try {
    const row = await prisma.$transaction((tx) =>
      publishRevocation(tx, { jti, reason: "verifier_readiness_demo" }),
    );
    return NextResponse.json(
      {
        ok: true,
        jti: row.jti,
        status: "revoked",
        revokedAt: row.revokedAt.toISOString(),
        statusIndex: row.statusIndex,
        note: "Demo revoke only — live consumer mandates use ops revoke key.",
      },
      { headers: CORS },
    );
  } catch (err) {
    if (err instanceof StatusIndexUnknownError) {
      return NextResponse.json(
        { error: "status_index_unknown", jti },
        { status: 409, headers: CORS },
      );
    }
    if (err instanceof StatusListCapacityError) {
      return NextResponse.json({ error: "status_list_capacity" }, { status: 503, headers: CORS });
    }
    return NextResponse.json({ error: "status_store_unavailable" }, { status: 503, headers: CORS });
  }
}

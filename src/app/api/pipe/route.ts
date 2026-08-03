import { NextResponse } from "next/server";
import { buildZakaiPipeDocument } from "@/lib/pipe/zakaiPipe";
import { scorePipeGravity } from "@/lib/pipe/pipeNetwork";
import { MandateKeyUnavailableError, loadSigningKeyFromEnv } from "@/lib/mandate/mandate";
import { emailConfigured } from "@/lib/messaging";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
};

function mandateLive(): boolean {
  try {
    loadSigningKeyFromEnv();
    return true;
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) return false;
    return false;
  }
}

/** Live pipe manifest + health + de-identified network volume. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pipe = buildZakaiPipeDocument(origin);
  const authorityLive = mandateLive();

  const [mandatesIssued, casesSent, proofAgg] = await Promise.all([
    prisma.authorization
      .count({ where: { mandateJti: { not: null }, status: "ACTIVE" } })
      .catch(() => 0),
    prisma.case
      .count({ where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } } })
      .catch(() => 0),
    prisma.savingsProof
      .aggregate({
        where: { selfReported: false, savingMonthly: { gt: 0 } },
        _count: true,
        _sum: { savingMonthly: true },
      })
      .catch(() => ({ _count: 0, _sum: { savingMonthly: null as number | null } })),
  ]);

  const volume = {
    mandatesIssued,
    casesSent,
    savingsProofs: proofAgg._count,
    verifiedRecoveredMinor: proofAgg._sum.savingMonthly ?? 0,
  };
  const gravity = scorePipeGravity(volume);

  return NextResponse.json(
    {
      ok: true,
      ...pipe,
      health: {
        authority_signing: authorityLive,
        email_delivery: emailConfigured(),
        payments_live: paymentsFullyLive(),
        pipe_ready: authorityLive,
        note: authorityLive
          ? "Mandate signing live — SENT cases carry verifiable JWS on the pipe."
          : "Mandate keys not configured in this environment — human Authorization still works; machine pipe soft-degrades.",
      },
      network: {
        ...volume,
        gravity_tier: gravity.tier,
        gravity_note: gravity.note,
        disclaimer:
          "Counts are de-identified aggregates. Empty is honest. Visa-scale gravity requires volume, not slides.",
      },
    },
    { headers: CORS },
  );
}

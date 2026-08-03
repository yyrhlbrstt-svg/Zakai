import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSavingsLedgerSnapshot } from "@/lib/savingsLedger";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120",
};

/**
 * Public append-only gravity: de-identified SavingsProof / StrategyOutcome feed.
 * Other agents, journalists, and institutions poll this — empty is honest.
 */
export async function GET() {
  const [verifiedAgg, outcomes] = await Promise.all([
    prisma.savingsProof
      .aggregate({
        where: { selfReported: false, savingMonthly: { gt: 0 } },
        _count: true,
        _sum: { savingMonthly: true },
      })
      .catch(() => ({ _count: 0, _sum: { savingMonthly: null as number | null } })),
    prisma.strategyOutcome
      .findMany({
        where: { recoveredMinor: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          vertical: true,
          counterparty: true,
          recoveredMinor: true,
          days: true,
          selfReported: true,
          createdAt: true,
        },
      })
      .catch(() => []),
  ]);

  const body = buildSavingsLedgerSnapshot({
    verifiedProofCount: verifiedAgg._count,
    verifiedRecoveredMinor: verifiedAgg._sum.savingMonthly ?? 0,
    outcomes,
  });

  return NextResponse.json({ ok: true, ...body }, { headers: CORS });
}

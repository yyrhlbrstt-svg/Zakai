import "server-only";
import { prisma } from "@/lib/prisma";
import { scorePipeGravity, type PipeNetworkVolume } from "@/lib/pipe/pipeNetwork";

export async function loadPipeNetworkVolume(): Promise<
  PipeNetworkVolume & {
    gravity_tier: "empty" | "signal" | "gravity" | "network";
    gravity_note: string;
    gravity_note_he: string;
  }
> {
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

  const volume: PipeNetworkVolume = {
    mandatesIssued,
    casesSent,
    savingsProofs: proofAgg._count,
    verifiedRecoveredMinor: proofAgg._sum.savingMonthly ?? 0,
  };
  const gravity = scorePipeGravity(volume);
  return {
    ...volume,
    gravity_tier: gravity.tier,
    gravity_note: gravity.note,
    gravity_note_he: gravity.noteHe,
  };
}

import "server-only";
import { prisma } from "@/lib/prisma";
import {
  buildCounterMemory,
  type CounterpartyMemory,
  type OutreachRecord,
} from "@/lib/counterMemory";

/**
 * Assemble one person's own history with each counterparty.
 *
 * Reads only that user's rows. This is the private inverse of
 * `companyScore.ts`, which aggregates across everyone into publishable
 * statistics: nothing here is de-identified because nothing here leaves the
 * person it belongs to.
 *
 * Deliberately needs no cooperation from any institution — it is built from
 * what we sent, when it actually left, and what came back.
 */
export async function loadCounterMemory(userId: string): Promise<CounterpartyMemory[]> {
  const cases = await prisma.case.findMany({
    where: { userId },
    select: {
      provider: true,
      status: true,
      strategyVariant: true,
      outcomeRecordedAt: true,
      updatedAt: true,
      savingsProof: { select: { savingMonthly: true } },
      // A letter counts as delivered only when the transport actually sent it.
      outbox: {
        where: { status: "SENT" },
        select: { sentAt: true },
        orderBy: { sentAt: "asc" },
        take: 1,
      },
    },
  });

  const records: OutreachRecord[] = cases.map((c) => {
    // Both terminal states mean the counterparty came back to us: NO_SAVING is
    // documented in the schema as "reply recorded, no saving". Anything short
    // of them is still open, and an open case is not a reply.
    const replied = c.status === "SAVED" || c.status === "NO_SAVING";
    const savingMonthly = c.savingsProof?.savingMonthly ?? 0;

    return {
      counterparty: c.provider,
      deliveredAt: c.outbox[0]?.sentAt ?? null,
      repliedAt: replied ? (c.outcomeRecordedAt ?? c.updatedAt) : null,
      saved: c.status === "SAVED" && savingMonthly > 0,
      recoveredMinor: Math.max(0, savingMonthly),
      variantId: c.strategyVariant,
    };
  });

  return buildCounterMemory(records);
}

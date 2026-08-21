import "server-only";

import { prisma } from "@/lib/prisma";
import { computeAlertToOutcome, type AlertToOutcome } from "./alertToOutcome";

/**
 * Read the alert-to-outcome counts out of the event spine.
 *
 * Separate from the pure metric so the arithmetic stays testable without a
 * database, and so the one place that touches Prisma is small enough to read
 * in full. `proved` counts only outcomes that both ended well AND carry an
 * amount, which is the same standard the product uses before it calls a saving
 * documented — a metric may not grade itself more kindly than the thing it is
 * grading.
 */
export async function readAlertToOutcome(sinceDays = 90): Promise<AlertToOutcome> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const [surfaced, cases, outcomes] = await Promise.all([
      prisma.zakaiEvent.count({ where: { eventType: "claim.surfaced", occurredAt: { gte: since } } }),
      prisma.zakaiEvent.count({ where: { eventType: "claim.created", occurredAt: { gte: since } } }),
      prisma.zakaiEvent.findMany({
        where: { eventType: "outcome.recorded", occurredAt: { gte: since } },
        select: { payload: true },
      }),
    ]);

    let proved = 0;
    let provedAgorot = 0;
    for (const row of outcomes) {
      const p = row.payload as { finalStatus?: string; finalAmountAgorot?: number | null } | null;
      if (!p) continue;
      if (p.finalStatus !== "won" && p.finalStatus !== "partial") continue;
      const amount = typeof p.finalAmountAgorot === "number" ? p.finalAmountAgorot : 0;
      if (amount <= 0) continue;
      proved += 1;
      provedAgorot += amount;
    }

    return computeAlertToOutcome({ surfaced, cases, proved, provedAgorot });
  } catch {
    // A steering number that can take down the page it steers is not worth
    // having. An unreachable spine reads as "nothing measured yet", which is
    // also what it honestly is from the caller's point of view.
    return computeAlertToOutcome({ surfaced: 0, cases: 0, proved: 0, provedAgorot: 0 });
  }
}

import "server-only";

import { prisma } from "@/lib/prisma";
import { computeAlertToOutcome, type AlertToOutcome } from "./alertToOutcome";

/**
 * Read outcomes in pages rather than all at once.
 *
 * The first version selected every outcome.recorded row in the window with no
 * limit. At today's volume that is zero rows and looks fine, which is exactly
 * how this kind of thing survives review: ZakaiEvent is append-only and only
 * grows, and a page the founder loads regularly would eventually pull the
 * whole quarter into memory to compute two integers.
 *
 * The cap is a tripwire, not a silent truncation — if it is ever reached the
 * result says so rather than quietly under-reporting, because a metric whose
 * entire purpose is catching us out must not be the thing that flatters us.
 */
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

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
export async function readAlertToOutcome(
  sinceDays = 90,
): Promise<AlertToOutcome & { truncated: boolean }> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const [surfaced, cases] = await Promise.all([
      prisma.zakaiEvent.count({ where: { eventType: "claim.surfaced", occurredAt: { gte: since } } }),
      prisma.zakaiEvent.count({ where: { eventType: "claim.created", occurredAt: { gte: since } } }),
    ]);

    let proved = 0;
    let provedAgorot = 0;
    let cursor: string | undefined;
    let pages = 0;
    let truncated = false;

    for (;;) {
      const rows = await prisma.zakaiEvent.findMany({
        where: { eventType: "outcome.recorded", occurredAt: { gte: since } },
        select: { id: true, payload: true },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const row of rows) {
        const p = row.payload as { finalStatus?: string; finalAmountAgorot?: number | null } | null;
        if (!p) continue;
        if (p.finalStatus !== "won" && p.finalStatus !== "partial") continue;
        const amount = typeof p.finalAmountAgorot === "number" ? p.finalAmountAgorot : 0;
        if (amount <= 0) continue;
        proved += 1;
        provedAgorot += amount;
      }
      if (rows.length < PAGE_SIZE) break;
      cursor = rows[rows.length - 1].id;
      if (++pages >= MAX_PAGES) {
        truncated = true;
        break;
      }
    }

    return { ...computeAlertToOutcome({ surfaced, cases, proved, provedAgorot }), truncated };
  } catch {
    // A steering number that can take down the page it steers is not worth
    // having. An unreachable spine reads as "nothing measured yet", which is
    // also what it honestly is from the caller's point of view.
    return { ...computeAlertToOutcome({ surfaced: 0, cases: 0, proved: 0, provedAgorot: 0 }), truncated: false };
  }
}

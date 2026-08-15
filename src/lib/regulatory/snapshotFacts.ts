import "server-only";
import { prisma } from "@/lib/prisma";
import { SNAPSHOT_MIN_SAMPLE, type SnapshotFacts } from "@/lib/mandate/signedSnapshot";

/**
 * The figures that go inside the signature.
 *
 * Deliberately narrower than the snapshot page. The page can show links,
 * schema versions and a disclaimer; a signed object should carry only claims
 * that are checkable and that a reader could be misled by. Everything here is
 * a count, a sum or a date derived from `StrategyOutcome` rows.
 *
 * Documented outcomes only. A self-reported result is somebody's memory, and
 * mixing it into a signed market statistic would give a weak input the
 * authority of a strong one — the same filter the oracle and fairness
 * aggregates already apply, for the same reason.
 */
const DOCUMENTED = { selfReported: false as const };

/**
 * Returns null when there is nothing publishable — no rows, a sample below the
 * minimum, or the database being unreachable. Null means "do not sign", not
 * "sign zeros": an authoritative-looking document reporting an empty aggregate
 * is worse than no document, because the first use of it would be to imply a
 * rigour the data has not earned.
 */
export async function loadSnapshotFacts(market: string): Promise<SnapshotFacts | null> {
  try {
    const rows = await prisma.strategyOutcome.findMany({
      where: { ...DOCUMENTED, market },
      select: { counterparty: true, paid: true, recoveredMinor: true, days: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (rows.length < SNAPSHOT_MIN_SAMPLE) return null;

    const counterparties = new Set(rows.map((r) => r.counterparty)).size;
    const paid = rows.filter((r) => r.paid);
    const recoveredMinor = rows.reduce((s, r) => s + r.recoveredMinor, 0);

    return {
      market,
      sampleSize: rows.length,
      counterparties,
      paidCount: paid.length,
      recoveredMinor,
      // No paid outcome means there is no median. Substituting a number would
      // fabricate the figure a reader relies on most.
      medianDays: median(paid.map((r) => r.days)),
      from: isoDate(rows[0].createdAt),
      to: isoDate(rows[rows.length - 1].createdAt),
    };
  } catch {
    return null;
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  // Even counts average the two middle values, then round: days are whole
  // numbers everywhere else in the product and a half-day median would be an
  // artefact of the arithmetic rather than an observation.
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

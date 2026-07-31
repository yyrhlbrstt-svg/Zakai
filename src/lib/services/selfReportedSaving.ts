import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Closing the loop for the six categories that could not close it.
 *
 * THE GAP THIS FILLS
 *
 * The company thesis is a closed loop: find the money, act, prove it, share the
 * proof. Six engines now find money — entitlements, overcharges, captive
 * pricing, incidents, dormant accounts, pre-purchase — and every one of them
 * stopped at the letter.
 *
 * The reason was structural rather than deliberate. A SavingsProof is one-to-one
 * with a Case, and only the telecom case pipeline creates one. So the proof
 * wall could never fill, the person's own record showed nothing, and the loop
 * the whole product is organised around was reachable from one vertical out of
 * seven — however well the other six worked.
 *
 * WHY THIS IS NOT A FEE
 *
 * The obvious next thought is to charge on it, and it is wrong. The success fee
 * is eighteen percent of a *documented* saving: a provider reply, a before, an
 * after. A self-report is somebody's word, given from memory, usually rounded.
 * Charging on that would mean invoicing against a number we cannot show anybody
 * — and the first time a customer disputed one, we would have nothing to
 * produce. So a self-reported proof creates no Fee at all, and the pricing
 * promise stays exactly what it says.
 *
 * What it does do is count. It appears in the person's record and on the public
 * wall, marked, because a wall that silently mixes verified outcomes with
 * remembered ones is a fabricated traction metric wearing a receipt.
 *
 * WHY IT CREATES A CASE
 *
 * Rather than loosening SavingsProof to stand alone. The proof's invariant —
 * every proof points at a case, every case at a user — is what makes the ledger
 * answerable months later. Relaxing it to fit a lighter flow would trade a
 * durable property for a convenience, and the convenience is a nullable column.
 */

export interface SelfReportedSaving {
  userId: string;
  /** Which engine produced the letter: rights, captive, incident, dormant. */
  vertical: string;
  /** Normalised counterparty key — never free text, so evidence aggregates. */
  provider: string;
  /** What they say came back, in minor units. Coarse by construction. */
  recoveredMinor: number;
  /** Which specific claim, for the person's own record. */
  reference?: string;
}

export type SelfReportOutcome =
  | { ok: true; caseId: string }
  | { ok: false; reason: "invalid_amount" | "failed" };

/** A single recovery is capped at a figure no honest self-report exceeds. */
const MAX_SELF_REPORTED_MINOR = 100_000_00; // ₪100,000

/**
 * Record a win the person told us about.
 *
 * The case is created already SAVED. It never passed through approval,
 * ownership verification or dispatch, and pretending otherwise by walking it
 * through those states would put timestamps in the ledger for events that did
 * not happen.
 */
export async function recordSelfReportedSaving(
  input: SelfReportedSaving,
): Promise<SelfReportOutcome> {
  const amount = Math.round(input.recoveredMinor);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SELF_REPORTED_MINOR) {
    return { ok: false, reason: "invalid_amount" };
  }

  try {
    const kase = await prisma.$transaction(async (tx) => {
      const created = await tx.case.create({
        data: {
          userId: input.userId,
          vertical: input.vertical,
          provider: input.provider,
          planDescription: input.reference?.slice(0, 200) ?? "",
          // A recovery is money that came back, not a bill that went down. The
          // before is zero and the after is negative-of-recovered, so the
          // saving arithmetic — max(0, original - new) — yields the amount
          // without inventing a "previous bill" that never existed.
          amountOriginal: amount,
          targetAmount: 0,
          status: "SAVED",
        },
        select: { id: true },
      });

      await tx.savingsProof.create({
        data: {
          caseId: created.id,
          originalAmount: amount,
          newAmount: 0,
          savingMonthly: amount,
          source: "self_reported",
          selfReported: true,
        },
      });

      // Deliberately no Fee row. Not a WAIVED one either: waiving implies a fee
      // was owed and forgiven, and none was ever owed here.
      return created;
    });

    return { ok: true, caseId: kase.id };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * The public wall, split by provenance.
 *
 * Returned separately rather than summed, because a single total that quietly
 * blends documented outcomes with remembered ones is the fake-traction
 * anti-pattern with extra steps. The caller has to decide how to show both,
 * which is the point.
 */
export async function provenSavings(): Promise<{
  verifiedMinor: number;
  verifiedCount: number;
  selfReportedMinor: number;
  selfReportedCount: number;
}> {
  try {
    const [verified, self] = await Promise.all([
      prisma.savingsProof.aggregate({
        where: { selfReported: false, savingMonthly: { gt: 0 } },
        _sum: { savingMonthly: true },
        _count: { _all: true },
      }),
      prisma.savingsProof.aggregate({
        where: { selfReported: true, savingMonthly: { gt: 0 } },
        _sum: { savingMonthly: true },
        _count: { _all: true },
      }),
    ]);
    return {
      verifiedMinor: verified._sum.savingMonthly ?? 0,
      verifiedCount: verified._count._all,
      selfReportedMinor: self._sum.savingMonthly ?? 0,
      selfReportedCount: self._count._all,
    };
  } catch {
    // Zero rather than a throw: the wall is decoration on a page somebody is
    // reading, and an unreachable ledger must not take the page with it.
    return { verifiedMinor: 0, verifiedCount: 0, selfReportedMinor: 0, selfReportedCount: 0 };
  }
}

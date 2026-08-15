import "server-only";
import { prisma } from "@/lib/prisma";
import {
  assessDefense,
  dueForCheck,
  type DefendedSaving,
  type DefenseVerdict,
} from "@/lib/savingsDefense";
import type { RecurringCharge } from "@/lib/subscriptions";

/**
 * The savings this person won that are old enough to have lapsed.
 *
 * Self-reported proofs are excluded. They never produced a chargeable fee in
 * the first place — for the reason spelled out on the column itself — and
 * accusing a company of breaking an agreement whose "after" figure is
 * somebody's recollection is not a letter this product should send.
 */
export async function defendableSavings(userId: string): Promise<DefendedSaving[]> {
  const proofs = await prisma.savingsProof.findMany({
    where: { selfReported: false, case: { userId } },
    select: {
      originalAmount: true,
      newAmount: true,
      recordedAt: true,
      case: { select: { provider: true } },
    },
    orderBy: { recordedAt: "desc" },
  });

  return proofs
    .map((p) => ({
      counterparty: p.case.provider,
      originalAgorot: p.originalAmount,
      agreedAgorot: p.newAmount,
      agreedAt: p.recordedAt,
    }))
    .filter((s) => dueForCheck(s));
}

/**
 * Match won savings against what a fresh scan shows is being charged now.
 *
 * The comparison uses the scan's own median monthly figure rather than any
 * single line, because one unusual month is not a price change.
 */
export function defenceVerdicts(
  savings: readonly DefendedSaving[],
  charges: readonly RecurringCharge[],
): DefenseVerdict[] {
  const byMerchant = new Map<string, RecurringCharge>();
  for (const c of charges) {
    // Keep the largest match per merchant; a provider can appear twice when a
    // statement splits a bill, and the main line is the one under agreement.
    const key = normalize(c.merchant);
    const existing = byMerchant.get(key);
    if (!existing || c.monthlyAgorot > existing.monthlyAgorot) byMerchant.set(key, c);
  }

  const out: DefenseVerdict[] = [];
  for (const saving of savings) {
    const match =
      byMerchant.get(normalize(saving.counterparty)) ??
      // Providers are stored as keys ("cellcom") while statements carry
      // display names ("סלקום"), so fall back to a containment match on the
      // provider key rather than silently reporting nothing.
      [...byMerchant.values()].find((c) => sharesToken(c.providerKey, saving.counterparty));
    if (!match) continue;
    out.push(assessDefense(saving, match.monthlyAgorot));
  }
  return out;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function sharesToken(providerKey: string | null, counterparty: string): boolean {
  return providerKey !== null && normalize(providerKey) === normalize(counterparty);
}

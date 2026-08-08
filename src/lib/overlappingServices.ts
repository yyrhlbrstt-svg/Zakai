import type { ChargeCategory, RecurringCharge } from "./subscriptions";

/**
 * Two vendors, one job, both being paid.
 *
 * THE PROBLEM
 *
 * A business signs a tool, someone else signs a competing one, and both keep
 * billing. A household keeps a streaming service after switching to another.
 * Neither charge looks wrong on its own — each is a real service, correctly
 * priced, from a company you did agree to pay. They are only wrong *together*,
 * and nothing looks at charges together: a statement is a list, and a list
 * hides pairs.
 *
 * The insurance case is already covered by duplicateInsuranceClaim. Nothing
 * covered the general one, which is the larger and quieter version.
 *
 * WHY THIS REPORTS "WORTH REVIEWING" AND NEVER "YOU ARE WASTING MONEY"
 *
 * Two telecom charges are usually two phone lines, not a duplicate. Two
 * software charges are often two tools that genuinely do different things.
 * The product cannot tell from a statement which pairs are redundant, and
 * asserting it would be exactly the fabricated claim this codebase forbids.
 *
 * So this finds the pairs a person should look at, states what it is basing
 * that on, and leaves the judgement to them. That is a smaller claim than a
 * competitor would make and the only one the evidence supports.
 */

/** Categories where paying two vendors at once is usually deliberate. */
const OFTEN_LEGITIMATE: ReadonlySet<ChargeCategory> = new Set<ChargeCategory>([
  // Several lines, several meters, several vehicles — normal for a household
  // and near-universal for a business.
  "cellular",
  "electricity",
]);

/** Below this, the smaller of a pair is not worth anyone's attention. */
export const MIN_PAIR_AGOROT = 2_000; // ₪20/month

export interface ServiceOverlap {
  category: ChargeCategory;
  /** The two charges, larger first. */
  charges: [RecurringCharge, RecurringCharge];
  /** Monthly cost of the smaller one — the most that could be saved. */
  smallerMonthlyAgorot: number;
  /**
   * True when this category commonly has legitimate parallel vendors. Shown,
   * not filtered: a business with two mobile plans may still have one too
   * many, and hiding the pair decides for them.
   */
  commonlyLegitimate: boolean;
}

export function findOverlaps(charges: readonly RecurringCharge[]): ServiceOverlap[] {
  const byCategory = new Map<ChargeCategory, RecurringCharge[]>();
  for (const c of charges) {
    if (c.monthlyAgorot < MIN_PAIR_AGOROT) continue;
    const list = byCategory.get(c.category);
    if (list) list.push(c);
    else byCategory.set(c.category, [c]);
  }

  const out: ServiceOverlap[] = [];
  for (const [category, list] of byCategory) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.monthlyAgorot - a.monthlyAgorot);

    // Every distinct pair. A category with four vendors has six pairs worth
    // looking at, not one — collapsing to "the top two" would hide the rest.
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sameMerchant(sorted[i], sorted[j])) continue;
        out.push({
          category,
          charges: [sorted[i], sorted[j]],
          smallerMonthlyAgorot: sorted[j].monthlyAgorot,
          commonlyLegitimate: OFTEN_LEGITIMATE.has(category),
        });
      }
    }
  }

  // Biggest avoidable amount first, and pairs that are rarely legitimate
  // ahead of those that usually are.
  return out.sort(
    (a, b) =>
      Number(a.commonlyLegitimate) - Number(b.commonlyLegitimate) ||
      b.smallerMonthlyAgorot - a.smallerMonthlyAgorot,
  );
}

/**
 * The most that could be saved if every flagged pair turned out to be
 * redundant — an upper bound, and it must be presented as one.
 *
 * Counts each charge at most once. A vendor appearing in three pairs is still
 * only one subscription, and summing per pair would inflate the figure into
 * something plainly untrue.
 */
export function maxAvoidableMonthlyAgorot(overlaps: readonly ServiceOverlap[]): number {
  const counted = new Set<string>();
  let total = 0;
  for (const o of overlaps) {
    const key = normalize(o.charges[1].merchant);
    if (counted.has(key)) continue;
    counted.add(key);
    total += Math.max(0, Math.round(o.smallerMonthlyAgorot));
  }
  return total;
}

/** Pairs where paying twice is rarely deliberate — the ones to show first. */
export function likelyRedundant(overlaps: readonly ServiceOverlap[]): ServiceOverlap[] {
  return overlaps.filter((o) => !o.commonlyLegitimate);
}

function sameMerchant(a: RecurringCharge, b: RecurringCharge): boolean {
  return normalize(a.merchant) === normalize(b.merchant);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

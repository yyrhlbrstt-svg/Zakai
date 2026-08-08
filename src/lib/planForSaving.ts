import { PLANS, PLAN_IDS, type PlanId } from "./plans";

/**
 * Which plan actually costs this person the least, over a year.
 *
 * WHY THIS IS WORTH COMPUTING RATHER THAN ASSERTING
 *
 * The pricing page marks one plan "popular" and leaves the reader to work out
 * the rest. But the plans trade a monthly price against a success-fee rate, so
 * which is cheapest depends entirely on how much that person recovers — and
 * the crossover points are not obvious from the table. Telling someone to pick
 * the tier that is better for us, when a cheaper one would serve them, is the
 * kind of thing that gets found out.
 *
 * So this computes the honest answer, including when the honest answer is
 * "stay on Free". A recommendation that can never say "don't upgrade" is not a
 * recommendation, it is an ad.
 *
 * All arithmetic is in integer agorot. The fee rate is basis points, so
 * `agorot * bps / 10_000` stays exact and no float touches money.
 */

/** Twelve months of a monthly saving — the same basis the fee is charged on. */
export const MONTHS = 12;

export interface PlanCost {
  planId: PlanId;
  /** Subscription for a year, in agorot. */
  subscriptionAgorot: number;
  /** Success fee on a year of the saving, in agorot. */
  feeAgorot: number;
  /** What this plan costs in total, in agorot. */
  totalAgorot: number;
}

/**
 * Cost of each plan for someone saving `monthlySavingAgorot` per month.
 * Ordered cheapest first; ties break toward the lower-commitment plan, since
 * a subscription that costs the same as no subscription is worse for the
 * person paying it.
 */
export function planCosts(monthlySavingAgorot: number): PlanCost[] {
  const saving = Math.max(0, Math.round(monthlySavingAgorot));
  const recovered = saving * MONTHS;

  return PLAN_IDS.map((planId) => {
    const p = PLANS[planId];
    const subscriptionAgorot = p.priceAgorot * MONTHS;
    // Integer throughout: basis points divide by 10,000 exactly.
    const feeAgorot = Math.round((recovered * p.feeRateBps) / 10_000);
    return {
      planId,
      subscriptionAgorot,
      feeAgorot,
      totalAgorot: subscriptionAgorot + feeAgorot,
    };
  }).sort(
    (a, b) => a.totalAgorot - b.totalAgorot || a.subscriptionAgorot - b.subscriptionAgorot,
  );
}

export interface PlanAdvice {
  best: PlanCost;
  /** The next-best option, for showing what the choice is against. */
  runnerUp: PlanCost | null;
  /** Agorot saved per year by choosing `best` over `runnerUp`. */
  savesAgorot: number;
  /**
   * False when the difference is too small to matter. Nudging someone to
   * switch plans to save a few shekels a year is churn dressed as advice.
   */
  worthSwitching: boolean;
}

/** Below this yearly difference, a switch is not worth recommending. */
export const WORTH_SWITCHING_AGOROT = 5_000; // ₪50/year

export function adviseplan(monthlySavingAgorot: number): PlanAdvice {
  const costs = planCosts(monthlySavingAgorot);
  const best = costs[0];
  const runnerUp = costs[1] ?? null;
  const savesAgorot = runnerUp ? runnerUp.totalAgorot - best.totalAgorot : 0;

  return {
    best,
    runnerUp,
    savesAgorot,
    worthSwitching: savesAgorot >= WORTH_SWITCHING_AGOROT,
  };
}

/**
 * The monthly saving at which `planId` first becomes the cheapest option, or
 * null if it never does.
 *
 * Exposed because the crossovers are the genuinely useful fact here: they say
 * who each plan is actually for, and they are computed from PLANS rather than
 * written into copy that can drift away from the prices.
 */
export function crossoverAgorot(planId: PlanId, maxMonthlyAgorot = 500_000): number | null {
  // Coarse then fine: the cost curves are linear, so a scan is exact enough
  // and far clearer than solving simultaneous equations per pair.
  for (let saving = 0; saving <= maxMonthlyAgorot; saving += 100) {
    if (planCosts(saving)[0].planId === planId) return saving;
  }
  return null;
}

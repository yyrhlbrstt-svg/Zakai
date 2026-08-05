/**
 * Referral rewards — kept as a tiny, fully-tested pure module, like the fee
 * math it sits next to.
 *
 * Model (deliberately basic):
 *  - Every user has a shareable invite link. When a friend signs up through it
 *    AND that friend's FIRST check documents a real monthly saving, the
 *    referrer earns a one-time credit.
 *  - The reward is a fixed credit toward the referrer's NEXT success fee. It is
 *    never paid out as cash — it only ever reduces a fee we would otherwise
 *    charge, and can never push a fee below zero.
 *  - A milestone bonus stacks on top of the flat reward at specific referral
 *    counts, so sharing once and sharing repeatedly aren't rewarded the same —
 *    the incentive is real to push past the first invite, not just make one.
 */

/** One-time referral reward, in agorot (₪25). */
export const REFERRAL_REWARD_AGOROT = 2500;

/**
 * Extra one-time bonus, in agorot, stacked on REFERRAL_REWARD_AGOROT when a
 * referrer's Nth successful referral (1-indexed, counting this one) lands on
 * one of these milestones. Deliberately modest and few — a milestone table
 * that grows every release is a table nobody can reason about.
 */
export const REFERRAL_MILESTONE_BONUS_AGOROT: Readonly<Record<number, number>> = {
  3: 5000, // ₪50 bonus on the 3rd successful referral
  5: 10000, // ₪100 bonus on the 5th
  10: 25000, // ₪250 bonus on the 10th
};

/** The next milestone count strictly above `count`, or null if none remain. */
export function nextReferralMilestone(
  count: number,
): { count: number; bonusAgorot: number } | null {
  const milestones = Object.keys(REFERRAL_MILESTONE_BONUS_AGOROT)
    .map(Number)
    .sort((a, b) => a - b);
  const next = milestones.find((m) => m > count);
  return next === undefined ? null : { count: next, bonusAgorot: REFERRAL_MILESTONE_BONUS_AGOROT[next] };
}

/**
 * Total credit for the referral that brings a referrer's successful-referral
 * count to exactly `count` (1-indexed) — the flat reward, plus a milestone
 * bonus if `count` lands exactly on one.
 */
export function referralRewardForCount(count: number): number {
  const bonus = REFERRAL_MILESTONE_BONUS_AGOROT[count] ?? 0;
  return REFERRAL_REWARD_AGOROT + bonus;
}

export interface CreditApplication {
  /** Credit consumed against this fee (>= 0, never more than the gross fee). */
  applied: number;
  /** Net fee actually charged after the credit (>= 0). */
  net: number;
  /** Credit left over for the user's future fees (>= 0). */
  remainingCredit: number;
}

/**
 * Apply as much available credit as possible to a gross fee. Credit never
 * exceeds the fee (no negative fees, no cash back), and whatever is unused
 * stays on the user's balance.
 */
export function applyCredit(grossAgorot: number, availableCreditAgorot: number): CreditApplication {
  const gross = Math.max(0, Math.trunc(grossAgorot));
  const credit = Math.max(0, Math.trunc(availableCreditAgorot));
  const applied = Math.min(gross, credit);
  return {
    applied,
    net: gross - applied,
    remainingCredit: credit - applied,
  };
}

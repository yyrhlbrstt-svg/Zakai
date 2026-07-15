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
 */

/** One-time referral reward, in agorot (₪25). */
export const REFERRAL_REWARD_AGOROT = 2500;

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

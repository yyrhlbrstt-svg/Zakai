/**
 * Success-fee calculation — the most expensive thing in the product to get
 * wrong, so it lives in one tiny, fully-tested pure function.
 *
 * Rules (from the business model, non-negotiable):
 *  - The fee is a success fee of 18% (1800 basis points).
 *  - It is charged ONLY on a documented, positive monthly saving.
 *  - Saving = max(0, original - new). A higher new amount is never a "negative
 *    fee" and never a charge.
 *  - All inputs/outputs are agorot (integers). The result is rounded to the
 *    nearest agora.
 */

export const FEE_RATE_BPS = 1800; // 18.00%
export const BPS_DENOMINATOR = 10000;

export interface FeeResult {
  /** Documented monthly saving in agorot (always >= 0). */
  savingMonthly: number;
  /** Basis points applied. */
  rateBps: number;
  /** Fee in agorot (always >= 0). */
  amount: number;
  /** Whether a fee is actually owed. */
  chargeable: boolean;
}

/** The documented monthly saving, clamped at zero. */
export function monthlySaving(originalAgorot: number, newAgorot: number): number {
  assertIntAgorot(originalAgorot, "originalAgorot");
  assertIntAgorot(newAgorot, "newAgorot");
  return Math.max(0, originalAgorot - newAgorot);
}

/**
 * Compute the success fee from a documented before/after.
 * `rateBps` is injectable for testing / future plans, defaulting to 18%.
 */
export function computeFee(
  originalAgorot: number,
  newAgorot: number,
  rateBps: number = FEE_RATE_BPS,
): FeeResult {
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new Error(`rateBps must be a non-negative integer, got ${rateBps}`);
  }
  const saving = monthlySaving(originalAgorot, newAgorot);
  // Round half-up to nearest agora. Integer math throughout.
  const amount = Math.round((saving * rateBps) / BPS_DENOMINATOR);
  return {
    savingMonthly: saving,
    rateBps,
    amount,
    chargeable: saving > 0 && amount > 0,
  };
}

function assertIntAgorot(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer number of agorot, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${name} must not be negative, got ${value}`);
  }
}

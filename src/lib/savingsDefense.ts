/**
 * Keep the saving, not just win it.
 *
 * THE GAP THIS CLOSES
 *
 * Every tool in this market — this one included, until now — is one-shot. It
 * wins ₪50/month off a bill, documents it, charges a fee on twelve months of
 * it, and moves on. Four months later the promotional rate lapses or the price
 * quietly creeps back, and nobody is watching. The person paid for a year of
 * saving and received a third of it, and the only party who knew what the
 * agreed amount was had already stopped looking.
 *
 * `SavingsProof` records the exact "after" figure that was won. `costDrift`
 * already detects a charge rising between two scans. Neither was ever pointed
 * at the other. This does that: it holds the won amount as a commitment and
 * reports when reality has drifted away from it.
 *
 * WHY IT IS ALSO THE HONEST REVENUE MODEL
 *
 * A recovered saving is recurring value; a one-time fee against it is a single
 * capture. Re-winning a lapsed saving produces a NEW documented SavingsProof,
 * which is the only thing this product is ever allowed to charge for. So
 * defending a saving earns again without ever charging for a subscription that
 * did nothing — the fee still follows documented money, exactly as before.
 *
 * WHAT IT REFUSES TO DO
 *
 * It never reports erosion it cannot demonstrate. A bill that moves by a few
 * shekels is noise; a bill that moves because the person themselves upgraded
 * is not a broken promise; and a single reading is not a trend. Each of those
 * is handled explicitly below rather than averaged away, because an agent that
 * cries breach at its counterparty on thin evidence burns the credibility that
 * makes the next letter work.
 */

/** Below this, chasing costs more credibility than the money is worth. */
export const DEFENSE_MIN_AGOROT = 1_000; // ₪10/month

/** And below this share of the won saving, it is drift, not a reversal. */
export const DEFENSE_MIN_SHARE = 0.25;

export interface DefendedSaving {
  counterparty: string;
  /** What the bill was before Zakai acted. */
  originalAgorot: number;
  /** The agreed amount after — the commitment being defended. */
  agreedAgorot: number;
  /** When that was documented. */
  agreedAt: Date;
}

export interface DefenseVerdict {
  counterparty: string;
  /** What they are charging now. */
  currentAgorot: number;
  /** How much of the won saving has been given back, in agorot per month. */
  erodedAgorot: number;
  /** Share of the original saving that has been lost, 0–1. */
  erodedShare: number;
  /**
   * True when the erosion is large enough, and clear enough, to act on. The
   * only field a caller should gate a re-open on.
   */
  actionable: boolean;
  /**
   * Why it is not actionable, when it isn't — so the UI can say something
   * true rather than showing nothing and looking broken.
   */
  reason: "eroded" | "held" | "improved" | "too_small" | "above_original";
}

/**
 * Compare an agreed saving against what is actually being charged now.
 *
 * `currentAgorot` should be a settled figure — the median of recent charges,
 * not a single line — because one unusual month is not a price change.
 */
export function assessDefense(
  saving: DefendedSaving,
  currentAgorot: number,
): DefenseVerdict {
  const wonAgorot = Math.max(0, saving.originalAgorot - saving.agreedAgorot);
  const erodedAgorot = Math.max(0, Math.round(currentAgorot - saving.agreedAgorot));
  const erodedShare = wonAgorot > 0 ? Math.min(1, erodedAgorot / wonAgorot) : 0;

  const base = {
    counterparty: saving.counterparty,
    currentAgorot: Math.round(currentAgorot),
    erodedAgorot,
    erodedShare,
  };

  // They are charging less than agreed. Nothing to defend, and saying
  // "eroded" here would be plainly wrong.
  if (currentAgorot < saving.agreedAgorot) {
    return { ...base, erodedAgorot: 0, erodedShare: 0, actionable: false, reason: "improved" };
  }

  if (erodedAgorot === 0) {
    return { ...base, actionable: false, reason: "held" };
  }

  /**
   * Back above what they charged BEFORE Zakai ever acted. That is not erosion
   * of a discount, it is a fresh increase on top of one, and it is reported
   * separately because the letter it justifies is a different letter.
   */
  if (currentAgorot > saving.originalAgorot) {
    return { ...base, actionable: true, reason: "above_original" };
  }

  const meaningful = erodedAgorot >= DEFENSE_MIN_AGOROT && erodedShare >= DEFENSE_MIN_SHARE;
  return meaningful
    ? { ...base, actionable: true, reason: "eroded" }
    : { ...base, actionable: false, reason: "too_small" };
}

/**
 * Annual value of re-winning this, in agorot — what the defense is worth if
 * it fully succeeds. Twelve months, matching `documentedRecoveryMinor`'s
 * treatment of a monthly saving, so a defended saving and an original one are
 * measured the same way.
 */
export function defenseValueAgorot(verdict: DefenseVerdict): number {
  return verdict.actionable ? verdict.erodedAgorot * 12 : 0;
}

/** Every saving worth re-opening, largest erosion first. */
export function actionableDefenses(verdicts: readonly DefenseVerdict[]): DefenseVerdict[] {
  return verdicts
    .filter((v) => v.actionable)
    .sort((a, b) => b.erodedAgorot - a.erodedAgorot);
}

/**
 * A saving is only worth defending once it has had a chance to lapse. Checking
 * the week after it was agreed finds nothing and trains people to ignore the
 * feature.
 */
export const DEFENSE_CHECK_AFTER_DAYS = 60;

export function dueForCheck(saving: DefendedSaving, now: Date = new Date()): boolean {
  const age = (now.getTime() - saving.agreedAt.getTime()) / 86_400_000;
  return age >= DEFENSE_CHECK_AFTER_DAYS;
}

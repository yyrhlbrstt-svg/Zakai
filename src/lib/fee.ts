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

import type { FeeBasis } from "@/lib/verticals/types";
import { documentedSavingMinor } from "@/lib/verificationDepth";

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

export interface RecoveryFeeResult {
  /** One-time recovered amount in agorot (always >= 0). */
  recoveredAgorot: number;
  rateBps: number;
  amount: number;
  chargeable: boolean;
}

/**
 * Success fee on a documented one-time recovery (deposit returned, insurance
 * payout, etc.) — same rate basis as monthly savings, separate entry point so
 * callers never fake a "monthly" saving from a lump sum.
 */
/**
 * Single entry for case settlement: monthly negotiations vs lump recoveries
 * share one SavingsProof row; lump stores documented recovery in `savingMonthly`.
 */
export function computeCaseSuccessFee(
  originalAgorot: number,
  newAgorot: number,
  basis: FeeBasis,
  rateBps: number = FEE_RATE_BPS,
): FeeResult {
  if (basis === "lump") {
    const recovered = monthlySaving(originalAgorot, newAgorot);
    const recovery = computeRecoveryFee(recovered, rateBps);
    return {
      savingMonthly: recovery.recoveredAgorot,
      rateBps: recovery.rateBps,
      amount: recovery.amount,
      chargeable: recovery.chargeable,
    };
  }
  return computeFee(originalAgorot, newAgorot, rateBps);
}

/**
 * Trust surface before SavingsProof confirm — shekel preview only.
 * Never charges; user still one-taps record.
 */
export function previewSuccessFeeShekels(
  originalShekels: number,
  newShekels: number,
  basis: FeeBasis,
  rateBps: number = FEE_RATE_BPS,
): { savingShekels: number; feeShekels: number; ratePct: number; chargeable: boolean } {
  const originalAgorot = Math.round(originalShekels * 100);
  const newAgorot = Math.round(newShekels * 100);
  const fee = computeCaseSuccessFee(originalAgorot, newAgorot, basis, rateBps);
  return {
    savingShekels: Math.round(fee.savingMonthly / 100),
    feeShekels: Math.round(fee.amount / 100),
    ratePct: rateBps / 100,
    chargeable: fee.chargeable,
  };
}

/**
 * What the outcome graph is entitled to record for this case.
 *
 * This multiplied a recurring saving by twelve, off a single verified bill.
 * The field is called *documented*, and eleven of those twelve months were
 * never observed by anyone — while `computeFee` charged 18% of exactly one.
 * The graph counted a year and the invoice counted a month, and both cannot be
 * right about the same event.
 *
 * It counts confirmed billing cycles now. `confirmedCycles` defaults to 1,
 * which is what settling a case actually establishes, and rises only when a
 * later bill confirms the saving is still in place — so the number grows on
 * evidence rather than on assumption, and can never claim a full year.
 *
 * This lowers the recorded recovery on recurring cases by up to twelve times
 * against what the old line asserted. That is the correction, not a
 * regression: there are no documented outcomes yet, so nothing already
 * recorded changes, and every future row is one somebody could check.
 */
export function documentedRecoveryMinor(
  savingDocumentedAgorot: number,
  basis: FeeBasis,
  confirmedCycles = 1,
): number {
  return documentedSavingMinor(savingDocumentedAgorot, basis, confirmedCycles);
}

/**
 * Inbound extractors often return a transfer/refund amount on lump cases; recordSaving
 * expects remaining owed (0 = paid in full). Monthly verticals pass through unchanged.
 */
export function inboundProposedRemainingShekels(
  feeBasis: FeeBasis,
  amountOriginalShekels: number,
  extractedShekels: number,
): number {
  if (feeBasis === "monthly") return extractedShekels;
  if (extractedShekels <= 0) return 0;
  if (extractedShekels >= amountOriginalShekels) return 0;
  return Math.max(0, amountOriginalShekels - extractedShekels);
}

export type InboundAmountKind = "monthly" | "remaining" | "refund";

/** Map inbound extract + vertical fee basis to remaining owed for recordSaving. */
export function resolveInboundRecordAmountShekels(
  feeBasis: FeeBasis,
  amountOriginalShekels: number,
  newAmountShekels: number | null,
  amountKind?: InboundAmountKind | null,
): number | null {
  if (newAmountShekels == null) return null;
  if (feeBasis === "monthly") return newAmountShekels;
  if (amountKind === "remaining") return Math.max(0, Math.round(newAmountShekels));
  const kind = amountKind ?? "refund";
  if (kind === "refund") {
    return inboundProposedRemainingShekels(feeBasis, amountOriginalShekels, Math.round(newAmountShekels));
  }
  return inboundProposedRemainingShekels(feeBasis, amountOriginalShekels, Math.round(newAmountShekels));
}

export function computeRecoveryFee(
  recoveredAgorot: number,
  rateBps: number = FEE_RATE_BPS,
): RecoveryFeeResult {
  assertIntAgorot(recoveredAgorot, "recoveredAgorot");
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new Error(`rateBps must be a non-negative integer, got ${rateBps}`);
  }
  const amount = Math.round((recoveredAgorot * rateBps) / BPS_DENOMINATOR);
  return {
    recoveredAgorot,
    rateBps,
    amount,
    chargeable: recoveredAgorot > 0 && amount > 0,
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

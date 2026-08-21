import {
  merchantOf,
  parseAmountToAgorot,
  type OpenBankingTransaction,
} from "./types";
import { detectRecurring, type RecurringCharge, type StatementTxn } from "@/lib/subscriptions";
import { gateScanCharges } from "@/lib/scanClaims";
import { detectPriceIncreases, type PriceIncrease } from "./priceIncrease";

/**
 * From a bank feed to an honest number.
 *
 * THE BRIDGE
 *
 * The detection engine has always taken `StatementTxn` — a date, a merchant
 * and integer agorot — because that is what a pasted statement parses into.
 * A bank feed is richer and messier, so it is narrowed here rather than the
 * detector being widened. One conversion, one place, testable on its own.
 *
 * Two decisions in that narrowing are worth naming:
 *
 *  - **Only outflows.** Berlin Group signs money leaving the account as
 *    negative. Salary and refunds are positive and are dropped: a detector
 *    fed income would happily report that the person has a recurring ₪14,200
 *    "subscription" to their employer.
 *  - **Sign is flipped, not stripped.** `StatementTxn.amountAgorot` is
 *    positive-means-charge by its own definition, so a -89.90 becomes 8990.
 *
 * THE ESTIMATE IS A CLAIM
 *
 * "You may be owed ₪X", shown before anybody asked, is exactly the kind of
 * assertion the silence law governs. So the estimate is built only from
 * charges that pass `gateScanCharges` — the same gate the pasted-statement
 * path uses. A finding the gate declines is still returned, in `heldBack`, so
 * the screen can show the row without asserting anything about it; it is
 * never counted into the headline figure.
 */

/** Berlin Group transactions -> the detector's input. Outflows only. */
export function toStatementTxns(txns: readonly OpenBankingTransaction[]): StatementTxn[] {
  const out: StatementTxn[] = [];
  for (const t of txns) {
    const agorot = parseAmountToAgorot(t.transactionAmount.amount);
    if (agorot === null) continue;
    // Positive = money arriving. Not a charge, not a subscription, not ours.
    if (agorot >= 0) continue;
    const merchant = merchantOf(t);
    if (!merchant) continue;
    const date = new Date(`${t.bookingDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    out.push({ date, merchant, amountAgorot: Math.abs(agorot) });
  }
  return out;
}

export interface FeedEstimate {
  /** Charges Zakai is entitled to make a claim about, richest first. */
  claimable: RecurringCharge[];
  /** Detected, shown, never asserted about. */
  heldBack: RecurringCharge[];
  /**
   * Charges that went up mid-window.
   *
   * Separate from `claimable` on purpose: a price rise is a fact about the
   * person's own statement whether or not we are confident enough to claim
   * anything about it, and the recurring detector cannot find it at all — a
   * stepped amount reads to it as an unsteady one, which lowers its
   * confidence exactly where the finding is most valuable.
   */
  priceIncreases: PriceIncrease[];
  /** Monthly total of the claimable set only, integer agorot. */
  monthlyAgorot: number;
  /** How many transactions were actually read. */
  transactionsRead: number;
  /**
   * False when the figures come from fixture data. Carried on the result so a
   * component cannot render the number without also having been handed the
   * fact that it is not real.
   */
  isLive: boolean;
}

export function estimateFromFeed(
  txns: readonly OpenBankingTransaction[],
  isLive: boolean,
): FeedEstimate {
  const statement = toStatementTxns(txns);
  const recurring = detectRecurring(statement);
  const { claimable, heldBack } = gateScanCharges(recurring);
  return {
    claimable,
    heldBack,
    priceIncreases: detectPriceIncreases(statement),
    monthlyAgorot: claimable.reduce((sum, c) => sum + c.monthlyAgorot, 0),
    transactionsRead: statement.length,
    isLive,
  };
}

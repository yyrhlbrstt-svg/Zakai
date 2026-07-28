/**
 * Turning a calibrated probability into an offer — the bridge from a model to
 * a business.
 *
 * WHAT THIS IS
 *
 * A person is owed ₪4,200 by an authority that will take eleven weeks to pay,
 * if it pays. They would rather have ₪3,400 today. Somebody has to decide what
 * today is worth, and be right about it often enough to stay solvent.
 *
 * That decision is impossible without a calibrated view of whether the claim
 * pays at all — which is why nobody offers this on consumer entitlements, and
 * why the Oracle is the thing that makes it possible rather than reckless.
 * Receivables finance is a multi-trillion industry built on exactly this trade
 * in commercial invoices; the consumer side of it does not exist because the
 * data to underwrite it has never existed.
 *
 * WHAT IT REFUSES TO DO
 *
 * Everything about this module is arranged so that the default is "no offer".
 * A funding book does not fail loudly on a bad quote; it fails quietly, over
 * hundreds of slightly-too-generous offers, and looks healthy the whole time.
 * So the refusals are structural rather than advisory:
 *
 *  - No offer at all unless the Oracle says `confident`. An uncalibrated
 *    probability multiplied by a shekel amount is not a price, it is a guess
 *    wearing a decimal point.
 *  - Priced off the **lower bound** of the credible interval, never the mean.
 *    Pricing off the mean is being wrong half the time in the direction that
 *    costs money — and the half that goes the other way does not refund you.
 *  - A hard concentration cap. Books die of correlation, not of individual bad
 *    bets: one municipality changing policy turns a thousand independent-looking
 *    claims into one.
 *
 * This module computes an offer. It does not make one. Actually advancing money
 * against consumer claims is a regulated activity in every market Zakai
 * operates in, and the decision to do it is the founder's and a lawyer's, not
 * a function's.
 */

import type { Prediction } from "../oracle/predict";

export interface AdvanceInput {
  prediction: Prediction;
  /** Face value of the claim, in minor units — what the person is owed. */
  faceValueMinor: number;
  /** Success fee we would have taken anyway, in basis points (1800 = 18%). */
  feeRateBps: number;
  /** Already advanced against this counterparty, in minor units. */
  counterpartyExposureMinor?: number;
  /** Total capital available to advance, in minor units. */
  bookSizeMinor?: number;
}

export type RefusalReason =
  | "not_confident"
  | "no_expected_amount"
  | "concentration_limit"
  | "uneconomic"
  | "invalid_input";

export type AdvanceOffer =
  | {
      offered: true;
      /** What we would pay today, in minor units. */
      advanceMinor: number;
      /** Advance as a fraction of face value. */
      advanceRate: number;
      /** What we keep if it pays: face - advance, plus the fee we'd take anyway. */
      grossMarginMinor: number;
      /** Probability-weighted loss across the book, in minor units. */
      expectedLossMinor: number;
      /** Expected profit after that loss. Negative offers are never made. */
      expectedProfitMinor: number;
      /** The conservative probability the price was built on. */
      pricedAtProbability: number;
      daysToExpectedPayment: number;
    }
  | { offered: false; reason: RefusalReason; explanation: string };

/**
 * Annual cost of the money being advanced, in basis points. Not a profit
 * target — the floor below which we are lending for free and calling it a
 * business.
 */
const COST_OF_CAPITAL_BPS = 1200;

/**
 * Margin held back on top of the conservative probability. The interval covers
 * statistical uncertainty; this covers the rest — a counterparty changing
 * policy, a rule being reinterpreted, a claimant going quiet.
 */
const RISK_MARGIN_BPS = 800;

/** No more than this fraction of the book against any single counterparty. */
const MAX_COUNTERPARTY_SHARE = 0.1;

/** Below this the operational cost of the transfer exceeds the margin. */
const MIN_ADVANCE_MINOR = 20_000;

function refuse(reason: RefusalReason, explanation: string): AdvanceOffer {
  return { offered: false, reason, explanation };
}

/**
 * Price an advance against a claim.
 *
 * The order of the checks is the risk policy, so it is worth reading as one:
 * refuse what cannot be priced, refuse what would concentrate the book, then —
 * and only then — work out a number, and refuse that too if it does not clear
 * the cost of the money.
 */
export function priceAdvance(input: AdvanceInput): AdvanceOffer {
  const { prediction, faceValueMinor, feeRateBps } = input;

  if (!Number.isFinite(faceValueMinor) || faceValueMinor <= 0) {
    return refuse("invalid_input", "The claim has no face value to advance against.");
  }
  if (!Number.isInteger(faceValueMinor)) {
    // Money is integer minor units everywhere in this codebase. A fractional
    // agora here is a rounding bug that compounds across a book.
    return refuse("invalid_input", "Face value must be an integer number of minor units.");
  }

  if (!prediction.confident) {
    return refuse(
      "not_confident",
      `The Oracle has ${prediction.evidence.trials} settled claims at the ${prediction.evidence.level} level — not enough to price against. No offer.`,
    );
  }
  if (prediction.expectedAmountMinor <= 0) {
    return refuse("no_expected_amount", "No observed payout for this kind of claim. No offer.");
  }

  // Concentration before arithmetic: a good price on a claim we should not be
  // taking at all is still a mistake, and checking it afterwards invites the
  // temptation to make an exception for an attractive number.
  const book = input.bookSizeMinor ?? 0;
  const exposure = input.counterpartyExposureMinor ?? 0;
  if (book > 0) {
    const cap = book * MAX_COUNTERPARTY_SHARE;
    if (exposure >= cap) {
      return refuse(
        "concentration_limit",
        `Already holding ${Math.round((exposure / book) * 100)}% of the book against this counterparty, at the ${Math.round(MAX_COUNTERPARTY_SHARE * 100)}% limit. Books die of correlation, not of individual bad bets.`,
      );
    }
  }

  // Price off the pessimistic end of what we believe, not the middle of it.
  const conservativeProbability = prediction.interval[0];
  const riskAdjusted = conservativeProbability * (1 - RISK_MARGIN_BPS / 10_000);

  // Time value over the expected wait.
  const days = Math.max(1, prediction.expectedDays || 30);
  const timeDiscount = 1 - (COST_OF_CAPITAL_BPS / 10_000) * (days / 365);

  // The fee is earned only if the claim pays, so it belongs on the same side of
  // the probability as everything else.
  const feeShare = feeRateBps / 10_000;
  const netToClaimant = faceValueMinor * (1 - feeShare);

  const advanceMinor = Math.floor(netToClaimant * riskAdjusted * Math.max(0, timeDiscount));

  if (advanceMinor < MIN_ADVANCE_MINOR) {
    return refuse(
      "uneconomic",
      `A responsible advance here is ${advanceMinor} minor units, below the ${MIN_ADVANCE_MINOR} floor where the cost of moving the money exceeds the margin.`,
    );
  }

  // Expected economics, stated in full so the number is auditable rather than
  // asserted. If it pays we recover the face value and keep the fee; if not, we
  // lose what we advanced.
  const recoveredIfPaid = faceValueMinor;
  const p = prediction.paidProbability;
  const expectedLossMinor = Math.round((1 - p) * advanceMinor);
  const expectedProfitMinor = Math.round(p * (recoveredIfPaid - advanceMinor) - expectedLossMinor);

  if (expectedProfitMinor <= 0) {
    return refuse(
      "uneconomic",
      "The expected profit on this claim is not positive after expected losses. No offer.",
    );
  }

  return {
    offered: true,
    advanceMinor,
    advanceRate: advanceMinor / faceValueMinor,
    grossMarginMinor: recoveredIfPaid - advanceMinor,
    expectedLossMinor,
    expectedProfitMinor,
    pricedAtProbability: conservativeProbability,
    daysToExpectedPayment: days,
  };
}

/**
 * What the whole book is expected to do.
 *
 * Reported separately because a set of individually sound offers can still be a
 * bad book — the per-claim view cannot see correlation, and the aggregate is
 * where an underwriter actually finds out whether the model is working.
 */
export function bookPosition(offers: readonly AdvanceOffer[]) {
  const live = offers.filter((o): o is Extract<AdvanceOffer, { offered: true }> => o.offered);
  return {
    count: live.length,
    advancedMinor: live.reduce((s, o) => s + o.advanceMinor, 0),
    expectedLossMinor: live.reduce((s, o) => s + o.expectedLossMinor, 0),
    expectedProfitMinor: live.reduce((s, o) => s + o.expectedProfitMinor, 0),
    refused: offers.length - live.length,
  };
}

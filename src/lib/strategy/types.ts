/**
 * The Strategy Engine — closing the loop that is currently open.
 *
 * THE GAP THIS FILLS
 *
 * `recoveryGraph.ts` already calls itself "Zakai's one genuinely defensible
 * moat (a data network effect)", and it is right about the asset. But it is
 * consumed by exactly two pages — /companies and /founder — both of which only
 * *display* it. Outcomes flow in and stop. The draft that goes to a
 * counterparty is written once and stored; nothing about the next claim is
 * informed by how the last ten thousand went.
 *
 * A dataset that is reported is a dashboard. A dataset that *chooses the next
 * action* is a flywheel. Google's advantage was never that it collected click
 * data — it was that it ranked with it. The equivalent here: every claim Zakai
 * files should be phrased the way that has actually been getting paid, by that
 * counterparty, in that jurisdiction, for that kind of right.
 *
 * That is the only compounding advantage available in this business. Rights
 * catalogues can be copied in a week — the law is public. Letter templates can
 * be copied by receiving one letter. What cannot be copied is ten thousand
 * observations of *which* letter got paid, because a competitor starting today
 * has none and can only get them by doing the work at scale. It is also the
 * honest answer to "why would a bank or an employer route through Zakai rather
 * than build this": not because the code is hard, but because the evidence is
 * ours.
 *
 * TWO DESIGN DECISIONS THAT MATTER
 *
 *  1. **Optimise expected recovery, not win rate.** An approach that succeeds
 *     90% of the time for ₪20 is worse for the customer than one that succeeds
 *     50% of the time for ₪200. Ranking on win rate is the intuitive mistake,
 *     and it quietly optimises the product toward small, easy, low-value wins.
 *  2. **The ledger carries no personal data — by construction, from the first
 *     commit.** Every observation is (market, vertical, counterparty class,
 *     variant, paid, days, amount). No user id, no case id, no free text. This
 *     is not only a privacy position: it is what allows the aggregate to be
 *     published, sold to a regulator, or shared with an institution later
 *     without a rewrite. Privacy retrofitted onto a dataset that has already
 *     absorbed identifiers is a project; privacy designed in is a type.
 */

/** Where a claim is filed, so evidence from one country never leaks into another. */
export interface StrategyContext {
  /** ISO-3166 alpha-2. */
  market: string;
  /** Vertical key — "telecom", "bank-fees", "arnona", ... */
  vertical: string;
  /**
   * The counterparty, normalised to a stable key. Never a free-text company
   * name: evidence has to aggregate, and "Cellcom" / "סלקום" / "cellcom ltd"
   * would fragment it into three useless buckets.
   */
  counterparty: string;
}

/**
 * The dimensions along which one approach to a claim differs from another.
 *
 * Deliberately a small, enumerable space rather than free-form prompt text.
 * Free text cannot be aggregated over — with a thousand unique drafts every
 * bucket has one observation and nothing is ever learned. A handful of
 * dimensions with a few levels each is what makes the evidence add up, and it
 * is also what makes the system explainable to a regulator asking why a
 * particular customer got a particular letter.
 */
export interface StrategyVariant {
  id: string;
  /** How the request is framed. */
  posture: "cooperative" | "firm" | "formal_legal";
  /** Whether the letter cites the statute the right rests on. */
  citesStatute: boolean;
  /** Whether it names a deadline for a reply. */
  setsDeadline: boolean;
  /** Whether it names the next step if refused (ombudsman, small claims). */
  namesEscalation: boolean;
  /**
   * Whether it opens with a specific number or asks the counterparty to
   * calculate. Anchoring is the classic negotiation lever and it is genuinely
   * unclear a priori which way it cuts against an automated back office —
   * exactly the kind of question that should be settled by evidence.
   */
  anchorsAmount: boolean;
}

/** One completed claim, reduced to what can be learned from without identifying anyone. */
export interface Observation {
  context: StrategyContext;
  variantId: string;
  /** Did money actually come back? Sourced from the savings ledger, never self-reported. */
  paid: boolean;
  /** Amount recovered in the market's minor units. Zero when not paid. */
  recoveredMinor: number;
  /** Calendar days from send to resolution — the customer-experience dimension. */
  days: number;
}

/** Posterior belief about one variant in one context. */
export interface VariantPosterior {
  variantId: string;
  /** Beta parameters over the payout probability. */
  alpha: number;
  beta: number;
  /** Shrunk estimate of the amount recovered when the claim does succeed. */
  expectedRecoveredMinor: number;
  /** Observations at the most specific level available. */
  directTrials: number;
  /** Which level of the hierarchy the evidence came from. */
  evidenceLevel: EvidenceLevel;
}

/**
 * How specific the evidence backing a choice is. Surfaced rather than hidden,
 * because "we have 400 observations against this exact counterparty" and "we
 * are falling back to a global prior" are very different claims, and the second
 * one must never be presented as the first.
 */
export type EvidenceLevel = "counterparty" | "vertical" | "market" | "prior";

export interface Selection {
  variant: StrategyVariant;
  evidenceLevel: EvidenceLevel;
  /** Trials backing the selection at that level. */
  trials: number;
  /** True when this draw was exploratory rather than the current best guess. */
  exploring: boolean;
}

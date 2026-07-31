/**
 * The self-improvement engine — the product changing itself.
 *
 * WHAT THIS GENERALISES
 *
 * `src/lib/strategy/` already learns one thing: which stance to file a claim
 * in. It works, and it proved the shape — decide, observe, update, decide
 * better. But it is hard-wired to claims. Every *other* decision in the
 * product is still a constant somebody typed once and nobody ever revisited:
 * which right to show first, which words go on the button people do not press,
 * how long to wait before chasing a counterparty, when to ask for the account.
 *
 * A team improves an app by noticing those, arguing, shipping a change, and
 * watching a number. This layer does that loop without the team — and, more
 * importantly, without ever waiting for someone to notice.
 *
 * THE PART THAT MATTERS MORE THAN THE LEARNING
 *
 * A system that can change itself can also break itself, and it will do so
 * faster than anyone can read a dashboard. So the interesting engineering here
 * is not the optimiser — that is a solved problem — it is the boundary.
 *
 * Three rules, enforced in types rather than in a document:
 *
 *  1. **Only over things with a measurable outcome and a safe rollback.**
 *     Ranking and wording qualify. Fee rates, legal text, consent copy,
 *     security thresholds and anything a regulator reads do not, and are
 *     marked `humanOnly` so the engine refuses to touch them. An optimiser
 *     pointed at a fee rate will discover that charging more earns more; that
 *     is not an improvement, it is a different company.
 *
 *  2. **Guardrails are veto, not weights.** A change that raises the target
 *     metric while damaging a protected one is rejected outright, never traded
 *     off. Otherwise the system learns to buy conversion with trust, which is
 *     exactly the failure mode of every growth team that ever optimised a
 *     funnel into the ground.
 *
 *  3. **Promotion requires evidence, not a lead.** Most differences are noise.
 *     A change is adopted only when the sample is large enough, the effect is
 *     big enough to matter, and the posteriors have actually separated. A
 *     system that promotes on a lucky streak degrades on its own, and does it
 *     while reporting that it is learning.
 *
 * And everything it does is legible: each decision records which experiment,
 * which arm, and which version produced it, so "why does the app behave this
 * way today" has an answer that is not a shrug.
 */

/** What kind of decision an experiment governs. */
export type Surface =
  | "ranking" // which of several true things to show first
  | "wording" // how something is phrased
  | "timing" // how long to wait before acting
  | "threshold" // a numeric cutoff with no legal meaning
  | "strategy"; // how to approach a counterparty

/**
 * One option the engine may choose. `payload` is opaque here on purpose: the
 * engine optimises over identifiers and never interprets what an arm means,
 * which is what keeps it usable for any decision in the product.
 */
export interface Arm<T = unknown> {
  id: string;
  payload: T;
  /**
   * The arm the product used before this experiment existed. Exactly one arm
   * per experiment must be the baseline: without a defined "what we do today",
   * a rollback has nowhere to go.
   */
  baseline?: boolean;
}

/** A metric the engine reads. Higher is better unless `lowerIsBetter`. */
export interface MetricDef {
  key: string;
  lowerIsBetter?: boolean;
}

/**
 * A metric that must not get worse, whatever happens to the target.
 *
 * `maxRelativeDrop` is the tolerance — 0.02 means "a 2% decline is noise we
 * accept, more is a veto". Zero tolerance sounds safer and is not: it makes
 * every experiment fail on sampling jitter, and a guardrail that always trips
 * is a guardrail everybody switches off.
 */
export interface Guardrail {
  metric: MetricDef;
  maxRelativeDrop: number;
}

export interface Experiment<T = unknown> {
  id: string;
  surface: Surface;
  /** What this is trying to improve. */
  target: MetricDef;
  /** What it must not damage while doing so. */
  guardrails: Guardrail[];
  arms: Arm<T>[];
  /**
   * True for decisions a machine must never make on its own: pricing, fees,
   * legal and consent copy, security limits, anything a regulator reads. The
   * engine refuses to run these, and there is a test for it.
   */
  humanOnly?: boolean;
  /** Minimum observations per arm before promotion is even considered. */
  minSamplesPerArm: number;
  /**
   * Smallest relative improvement worth adopting. A 0.3% lift that is real is
   * still not worth the risk and complexity of a change.
   */
  minRelativeLift: number;
}

/** One decision the engine made, and what happened. */
export interface Trial {
  experimentId: string;
  armId: string;
  /** Target metric value observed for this trial. */
  value: number;
  /** Guardrail metric values, keyed by metric key. */
  guardrailValues?: Record<string, number>;
  /** Whether the trial reached a conclusion at all. */
  converted: boolean;
}

export type Verdict =
  | { kind: "insufficient_data"; needPerArm: number; havePerArm: Record<string, number> }
  | { kind: "no_winner"; reason: "within_noise" | "below_min_lift" }
  | { kind: "guardrail_veto"; armId: string; metric: string; observedDrop: number; allowed: number }
  | { kind: "promote"; armId: string; relativeLift: number; samples: number }
  | { kind: "refused"; reason: "human_only" | "no_baseline" | "no_arms" };

export interface ArmSummary {
  armId: string;
  samples: number;
  conversions: number;
  meanValue: number;
  /** Beta posterior over the conversion rate. */
  alpha: number;
  beta: number;
}

export interface Review {
  experimentId: string;
  verdict: Verdict;
  arms: ArmSummary[];
  baselineArmId: string | null;
  /** One sentence, in plain language, for the weekly digest a human reads. */
  explanation: string;
}

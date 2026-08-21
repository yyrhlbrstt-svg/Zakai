/**
 * Alert-to-outcome — the ratio that catches a drifting detector before a
 * single person complains.
 *
 * THE NUMBER
 *
 * Of everything Zakai announced unprompted ("you have an overcharge here"),
 * how much became a real case, and how much of that was ever proved in money?
 *
 *     surfaced ──► case created ──► proved in money
 *
 * Two ratios fall out, and they fail in different directions, which is the
 * point of keeping them apart:
 *
 *  - **surfaced → case** collapsing means people are not believing us, or the
 *    thing we found had no usable next step. That is a product failure and it
 *    shows up within days.
 *  - **case → proved** collapsing means people believed us and we were wrong.
 *    That is a detector failure, it is much more expensive, and it shows up
 *    weeks later — which is exactly why it has to be watched rather than
 *    waited for.
 *
 * A healthy first ratio with a dying second one is the specific shape of "we
 * are getting very good at convincing people of things that are not true", and
 * no single number would have separated it.
 *
 * WHY IT IS COMPUTED FROM THE SPINE AND NOT FROM CASE ROWS
 *
 * Case rows only know about claims that became cases. The denominator here —
 * what we said out loud and nobody acted on — exists nowhere else. It is only
 * recordable at the moment the claim gate says speak, which is why
 * `claim.surfaced` was added to the event set rather than derived afterwards.
 *
 * HONESTY GATE
 *
 * Below MIN_SAMPLE surfaced claims the ratios are `null`, not zero and not a
 * percentage. The same rule the fairness scores use, for the same reason: a
 * ratio over three events is noise wearing a percentage sign, and this is an
 * internal steering number — steering on noise is worse than not steering.
 */

import { MIN_SAMPLE } from "@/lib/companyScore";

/** One counted row, already reduced to what the ratio needs. */
export interface AlertOutcomeCounts {
  /** claim.surfaced — Zakai said it, unprompted. */
  surfaced: number;
  /** claim.created — it became a real case. */
  cases: number;
  /**
   * outcome.recorded with a won/partial status AND money on it.
   *
   * "Won with no amount" is not proof. Every other part of this codebase
   * refuses to call a saving documented without a figure, and a metric that
   * graded itself more generously than the product does would be the first
   * thing to start lying.
   */
  proved: number;
  /** Money actually proved, integer agorot. */
  provedAgorot: number;
}

export interface AlertToOutcome extends AlertOutcomeCounts {
  /** cases / surfaced — did anyone act on what we said? null below MIN_SAMPLE. */
  surfacedToCase: number | null;
  /** proved / cases — were we right? null below MIN_SAMPLE cases. */
  caseToProved: number | null;
  /** proved / surfaced — the whole funnel. null below MIN_SAMPLE. */
  surfacedToProved: number | null;
  /** True while any ratio is withheld, so a caller cannot mistake null for 0. */
  belowSample: boolean;
  minSample: number;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator < MIN_SAMPLE) return null;
  return Number((numerator / denominator).toFixed(3));
}

/** Pure: the counting lives here, the querying lives in the caller. */
export function computeAlertToOutcome(counts: AlertOutcomeCounts): AlertToOutcome {
  const surfaced = Math.max(0, Math.trunc(counts.surfaced));
  const cases = Math.max(0, Math.trunc(counts.cases));
  const proved = Math.max(0, Math.trunc(counts.proved));
  const provedAgorot = Math.max(0, Math.trunc(counts.provedAgorot));

  return {
    surfaced,
    cases,
    proved,
    provedAgorot,
    surfacedToCase: ratio(cases, surfaced),
    caseToProved: ratio(proved, cases),
    surfacedToProved: ratio(proved, surfaced),
    belowSample: surfaced < MIN_SAMPLE || cases < MIN_SAMPLE,
    minSample: MIN_SAMPLE,
  };
}

/**
 * What the ratio is telling you, in one word, or nothing at all.
 *
 * Thresholds are stated here rather than scattered through a dashboard, and
 * they are read as "worth a look", never as an alarm — there is no volume yet
 * to calibrate them against, and pretending otherwise would be the same sin
 * this whole module exists to catch. They will be re-derived from real data,
 * and this comment is the reminder that they must be.
 */
export type AlertHealth = "unknown" | "healthy" | "watch" | "investigate";

export function readAlertHealth(m: AlertToOutcome): AlertHealth {
  if (m.surfacedToCase === null || m.caseToProved === null) return "unknown";
  // Being wrong is the expensive failure, so it dominates the reading.
  if (m.caseToProved < 0.2) return "investigate";
  if (m.surfacedToCase < 0.1) return "investigate";
  if (m.caseToProved < 0.4 || m.surfacedToCase < 0.25) return "watch";
  return "healthy";
}

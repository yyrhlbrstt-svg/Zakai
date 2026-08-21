/**
 * The gate that decides whether Zakai says anything at all.
 *
 * WHY THIS EXISTS
 *
 * `rightForLetter()` already refuses to let unverified law reach a letter: if
 * a right is draft, every letter built on it structurally stops existing. That
 * gate points outward — at institutions — and it was the right instinct
 * pointed in only one direction. The thing a person actually experiences first
 * is not a letter. It is a screen saying "you are being overcharged here",
 * which is an assertion about their money that they did not ask for, made
 * before anyone has checked anything on their behalf.
 *
 * An institution that receives a weak letter answers it, or does not. A person
 * who is told three times that money is waiting, and three times finds nothing
 * at the end of it, stops believing the fourth — and the fourth is the true
 * one. The asymmetry is the whole argument: a missed detection costs one
 * claim, a wrong detection costs every future claim with that person.
 *
 * THE RULE
 *
 * Zakai speaks only when BOTH are true:
 *
 *   1. Confidence is high — measured, not asserted.
 *   2. There is an immediate way to act on it, in-app, right now.
 *
 * Fail either and the answer is SILENCE, not a hedge. "You may possibly be
 * owed something, we are not sure, and there is nothing you can do about it
 * here" is worse than saying nothing: it transfers our uncertainty to somebody
 * with less information than us and no way to resolve it, and it costs the
 * same trust as being wrong.
 *
 * WHY AN ACTION PATH IS PART OF *CONFIDENCE*, NOT A SEPARATE UI CONCERN
 *
 * A finding with no next step cannot be confirmed or refuted — it never
 * becomes a case, so it never produces an outcome, so nothing ever tells us
 * whether we were right. Alerts with no action path are the ones that quietly
 * rot: they are unfalsifiable by construction. Requiring the path is what
 * keeps the detector honest over time, which is also why every gate decision
 * here is countable (see `alertToOutcome.ts`).
 *
 * PURE ON PURPOSE
 *
 * No imports from the database or the server. The recurring-charge scan runs
 * in the browser so a bank statement never leaves the device, and the gate has
 * to run in the same place as the thing it is gating.
 */

/**
 * The bar for speaking unprompted.
 *
 * Deliberately above the 0.6 used by `inboundDecision` and `proposedSaving`.
 * Those two gate a *proposal the person then confirms* — the human is the
 * check, and 0.6 is a sensible bar for "worth putting in front of them". This
 * gates an assertion made before anyone asked, with no human in the loop
 * before it appears on screen, so it needs the margin.
 */
export const CLAIM_SPEAK_THRESHOLD = 0.7;

export type ClaimSilenceReason =
  /** Below the bar. We may well be right; we are not sure enough to say so. */
  | "low_confidence"
  /** The right it rests on is draft, or does not exist. Same rule as letters. */
  | "unverified_right"
  /** Nothing the person can do about it here, right now. */
  | "no_immediate_action";

export interface ClaimCandidate {
  /** What we think we found. Short, closed-vocabulary, for counting later. */
  kind: string;
  /** 0..1. Must come from a measurement, never from a model's self-report. */
  confidence: number;
  /**
   * The Rights Graph right this rests on, when it rests on one. A detection
   * that is arithmetic over the person's own statement (this charge repeats,
   * that one doubled) rests on no legal claim and passes `null` honestly
   * rather than naming a right it does not use.
   */
  rightId?: string | null;
  /** Where tapping it goes. In-app path; an empty string is no action. */
  actionHref?: string | null;
  /** Estimated value in integer agorot, or null when we genuinely cannot say. */
  estimatedValueAgorot?: number | null;
}

export type ClaimVerdict =
  | {
      speak: true;
      kind: string;
      confidence: number;
      rightId: string | null;
      actionHref: string;
      estimatedValueAgorot: number | null;
    }
  | { speak: false; kind: string; confidence: number; reason: ClaimSilenceReason };

/**
 * Resolve a right the same way letters do.
 *
 * Injected rather than imported so this module stays pure and testable, and so
 * the caller decides which registry applies. Callers in the app pass the real
 * one; there is deliberately no default that silently permits everything.
 */
export type RightVerifier = (rightId: string) => boolean;

export function decideClaim(
  candidate: ClaimCandidate,
  isRightVerified: RightVerifier,
): ClaimVerdict {
  const kind = candidate.kind;
  const confidence = Number.isFinite(candidate.confidence) ? candidate.confidence : 0;

  if (confidence < CLAIM_SPEAK_THRESHOLD) {
    return { speak: false, kind, confidence, reason: "low_confidence" };
  }

  const rightId = candidate.rightId ?? null;
  if (rightId !== null && !isRightVerified(rightId)) {
    return { speak: false, kind, confidence, reason: "unverified_right" };
  }

  const actionHref = (candidate.actionHref ?? "").trim();
  if (!actionHref) {
    return { speak: false, kind, confidence, reason: "no_immediate_action" };
  }

  return {
    speak: true,
    kind,
    confidence,
    rightId,
    actionHref,
    estimatedValueAgorot: candidate.estimatedValueAgorot ?? null,
  };
}

/**
 * Split a batch into what may be shown and what must not, keeping the reasons.
 *
 * The silenced half is not thrown away: it is the numerator of "how often do
 * we nearly say something", which is the first number that moves when a
 * detector starts drifting.
 */
export function partitionClaims(
  candidates: readonly ClaimCandidate[],
  isRightVerified: RightVerifier,
): {
  speak: Extract<ClaimVerdict, { speak: true }>[];
  silent: Extract<ClaimVerdict, { speak: false }>[];
} {
  const speak: Extract<ClaimVerdict, { speak: true }>[] = [];
  const silent: Extract<ClaimVerdict, { speak: false }>[] = [];
  for (const c of candidates) {
    const verdict = decideClaim(c, isRightVerified);
    if (verdict.speak) speak.push(verdict);
    else silent.push(verdict);
  }
  return { speak, silent };
}

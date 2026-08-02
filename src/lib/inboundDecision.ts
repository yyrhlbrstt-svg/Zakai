/**
 * Decide whether an inbound provider email should trigger the "confirm your
 * saving in one click" notification to the user.
 *
 * The subtlety this exists for: extraction confidence and match strength are
 * two different things. An email matched by an exact ZK- authorization code
 * is bound to one case cryptographically-random-code-strong — the extractor's
 * self-reported confidence adds nothing to that. Gating code-matched emails
 * on `confidence >= 0.6` silently broke the closed loop whenever the app ran
 * without an AI key, because the deterministic fallback extractor caps its
 * confidence at 0.55 by design. A provider reply carrying the exact code and
 * an explicit amount was logged and then never surfaced to anyone.
 *
 * Rules:
 *  - No amount extracted → never notify (nothing actionable to confirm).
 *  - Matched by exact authorization code → notify. The code is the evidence.
 *  - Matched only by sender email (fuzzy) → require confidence >= 0.6, since
 *    both the match and the amount are guesses.
 *  - No match → never notify.
 *
 * Notifying is a proposal, never a charge: the user still confirms (or
 * ignores) in the dashboard, and only that confirmation records the saving.
 */

export type InboundMatchMethod = "code" | "email" | null;

export const EMAIL_MATCH_MIN_CONFIDENCE = 0.6;

export interface InboundNotifyInput {
  matchMethod: InboundMatchMethod;
  found: boolean;
  newAmountShekels: number | null;
  confidence: number;
}

export function shouldNotifyInbound(input: InboundNotifyInput): boolean {
  if (!input.found || input.newAmountShekels == null || input.newAmountShekels < 0) {
    return false;
  }
  if (input.matchMethod === "code") return true;
  if (input.matchMethod === "email") return input.confidence >= EMAIL_MATCH_MIN_CONFIDENCE;
  return false;
}

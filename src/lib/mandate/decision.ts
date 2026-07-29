/**
 * The decision point — the thing an institution actually wants.
 *
 * WHY VERIFICATION IS NOT THE PRODUCT
 *
 * `verifyMandate` answers "is this token authentic and unexpired". That is a
 * necessary question and an unhelpful one, because it leaves the institution
 * holding the hard part: given a set of scopes, a subject, a market and an
 * expiry, may this agent do *this specific act*, right now?
 *
 * Every bank that answers that question for itself writes the same fifty lines,
 * writes them slightly differently, and gets one of them wrong. The one they
 * get wrong is usually the same one: they check that the scope string appears
 * and forget that holding "may cancel my subscriptions" is not agreement to
 * cancel *this* subscription today.
 *
 * So this file answers the whole question in one call and returns a decision,
 * not evidence. That is the difference between a format somebody has to
 * implement and infrastructure somebody adopts. An integration that is five
 * lines and never needs authorization logic is one that does not get rewritten
 * later, and the reason to give the hard part away is that the hard part is
 * what makes leaving expensive.
 *
 * THE THREE RULES THAT MAKE IT SAFE TO ADOPT
 *
 * 1. Deny by default. Every path that is not an explicit permit is a deny with
 *    a machine-readable reason. There is no "unknown" that a caller might treat
 *    as permissive, and no exception that returns permit on error.
 *
 * 2. A forbidden scope can never be permitted, regardless of what the token
 *    says. If a mandate somehow carries `payment:initiate` — a bug, a stolen
 *    key, a future version we did not anticipate — the answer is still deny.
 *    The categorical limit that money never flows outward is enforced at the
 *    decision point too, not only at issuance, because issuance is the side an
 *    attacker would control.
 *
 * 3. Per-act scopes require evidence of this act. Holding the scope is
 *    necessary and not sufficient, and the obligation is returned so the
 *    institution knows what to ask for rather than having to know already.
 *
 * WHAT A CALLER MUST STILL DO
 *
 * Check revocation. This function is pure and offline by construction so it can
 * run inside a request path with no network, which means it cannot know that a
 * mandate was revoked thirty seconds ago. The caller passes what it knows; if
 * it knows nothing, it says so, and the decision reflects that honestly rather
 * than assuming the convenient answer.
 */

import type { MandateClaims } from "./mandate";
import { FORBIDDEN_SCOPES, requiresPerActConfirmation, scopeDef } from "./scopes";

/**
 * What the caller knows about revocation. `unknown` is a real state and is
 * treated as a soft deny — an institution that cannot check must not be
 * silently told everything is fine.
 */
export type RevocationState = "active" | "revoked" | "unknown";

export interface DecisionRequest {
  /** The verified claims. Verification is a precondition, not part of this step. */
  claims: MandateClaims;
  /** The act being attempted, as a scope string. */
  action: string;
  /** Who is asking. Must match the mandate's audience. */
  audience: string;
  /** The person the act concerns, if the caller knows it. */
  subject?: string;
  /** The market the act takes place in, if the caller enforces one. */
  market?: string;
  /** What the caller knows about revocation. Defaults to unknown, not active. */
  revocation?: RevocationState;
  /**
   * Evidence that the principal confirmed this specific act — a reference the
   * institution can log. Required for per-act scopes and ignored otherwise.
   */
  actConfirmation?: string;
  /** Evaluation time. Injected so a decision is reproducible in a test and an audit. */
  now?: Date;
}

/**
 * Deny reasons are a closed set on purpose. A free-text reason is a string an
 * institution will pattern-match on, and the day we reword it their integration
 * breaks. These are part of the interface and change only with the version.
 */
export type DenyReason =
  | "expired"
  | "not_yet_valid"
  | "audience_mismatch"
  | "subject_mismatch"
  | "market_mismatch"
  | "scope_not_granted"
  | "scope_unknown"
  | "scope_forbidden"
  | "act_confirmation_required"
  | "revoked"
  | "revocation_unknown"
  /** A required claim is absent or of the wrong type. Never treated as permissive. */
  | "malformed_claims";

export interface Decision {
  decision: "permit" | "deny";
  /** Present on every deny. Absent on permit. */
  reason?: DenyReason;
  /** What the caller must do or record. Present on permit where relevant. */
  obligations: string[];
  /** Echoed so an audit log has the decision and its inputs in one record. */
  jti: string;
  action: string;
  /** Seconds until the mandate expires, at evaluation time. Never negative. */
  expiresInSeconds: number;
}

function deny(reason: DenyReason, claims: MandateClaims, action: string, exp: number): Decision {
  return { decision: "deny", reason, obligations: [], jti: claims.jti, action, expiresInSeconds: exp };
}

/**
 * May this agent do this, now?
 *
 * Pure, offline, and total: every input produces a decision, and no input
 * produces a throw. An authorization function that can throw is one that some
 * caller will wrap in a try/catch whose catch block permits, and that caller
 * will be a bank.
 */
export function decide(req: DecisionRequest): Decision {
  const { claims, action, audience } = req;
  const now = req.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const expiresInSeconds = Math.max(0, (claims.exp ?? 0) - nowSec);

  // Order matters only for the quality of the reason returned, not the outcome:
  // any single failure denies. Structural mismatches are reported before scope
  // problems because "you sent this to the wrong institution" is more useful to
  // an integrator than "that scope is missing".
  if (claims.aud !== audience) return deny("audience_mismatch", claims, action, expiresInSeconds);
  if (req.subject && claims.sub !== req.subject) {
    return deny("subject_mismatch", claims, action, expiresInSeconds);
  }
  if (req.market && claims.market && claims.market !== req.market) {
    return deny("market_mismatch", claims, action, expiresInSeconds);
  }

  // Checked before anything temporal, and deliberately. Enforced here as well
  // as at issuance because issuance is the side an attacker controls: a mandate
  // carrying an outward-money scope is not one we merely decline to have
  // issued, it is one no verifier honours.
  //
  // It comes first among the token's own faults because it is not a routine
  // one. An *expired* token bearing `payment:initiate` still means somebody is
  // issuing forbidden mandates, which is a registry-level incident rather than
  // a stale credential — and reporting "expired" would hide the incident behind
  // the lesser fault. A published vector pins this ordering; our own
  // implementation failed it, which is what the vectors are for.
  if (FORBIDDEN_SCOPES.includes(action)) {
    return deny("scope_forbidden", claims, action, expiresInSeconds);
  }
  if (claims.scopes.some((s) => FORBIDDEN_SCOPES.includes(s))) {
    return deny("scope_forbidden", claims, action, expiresInSeconds);
  }

  // Both temporal claims are required, and their absence is reported as what it
  // is rather than folded into "expired". Treating a missing `exp` as "no
  // expiry" would turn a malformed token into an eternal one — the strongest
  // possible mandate arriving through the weakest possible path. The first
  // version of this function had exactly that hole, and the test that feeds it
  // a claim set with the field removed is what found it.
  if (typeof claims.exp !== "number" || typeof claims.nbf !== "number") {
    return deny("malformed_claims", claims, action, expiresInSeconds);
  }
  if (nowSec < claims.nbf) return deny("not_yet_valid", claims, action, expiresInSeconds);
  if (nowSec >= claims.exp) return deny("expired", claims, action, expiresInSeconds);

  if (!scopeDef(action)) return deny("scope_unknown", claims, action, expiresInSeconds);
  if (!claims.scopes.includes(action)) {
    return deny("scope_not_granted", claims, action, expiresInSeconds);
  }

  // Holding "may cancel my subscriptions" is not agreement to cancel this one.
  if (requiresPerActConfirmation(action) && !req.actConfirmation?.trim()) {
    return deny("act_confirmation_required", claims, action, expiresInSeconds);
  }

  const revocation = req.revocation ?? "unknown";
  if (revocation === "revoked") return deny("revoked", claims, action, expiresInSeconds);
  if (revocation === "unknown") {
    // Not a permit with a warning. An institution that cannot establish
    // revocation status has not established authority, and softening this is
    // how a revoked mandate keeps working for the one caller who never checks.
    return deny("revocation_unknown", claims, action, expiresInSeconds);
  }

  const obligations: string[] = [
    `record:${claims.jti}`,
    `notify_principal:${action}`,
  ];
  if (req.actConfirmation?.trim()) obligations.push(`retain_confirmation:${req.actConfirmation.trim()}`);

  return { decision: "permit", obligations, jti: claims.jti, action, expiresInSeconds };
}

/**
 * Everything this mandate could authorise at this institution right now.
 *
 * Offered because the first thing an integrator does is ask what a token is
 * good for, and the alternative — calling `decide` once per scope and inferring
 * — is a loop everyone writes and someone writes wrong.
 */
export function permittedActions(
  req: Omit<DecisionRequest, "action" | "actConfirmation">,
): string[] {
  return req.claims.scopes.filter((scope) => {
    const d = decide({
      ...req,
      action: scope,
      // Per-act scopes are reported as available; whether this particular act is
      // confirmed is a question about an act that does not exist yet.
      actConfirmation: requiresPerActConfirmation(scope) ? "probe" : undefined,
    });
    return d.decision === "permit";
  });
}

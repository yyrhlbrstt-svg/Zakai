/**
 * The decision point — ported verbatim from the production app's
 * src/lib/mandate/decision.ts. "May this agent do this, right now?" answered
 * in one pure, offline, total function: every input produces a decision, and
 * no input produces a throw. Verification is a precondition, not part of
 * this step — call `verifyMandate` first.
 */

import type { MandateClaims } from "./mandate.js";
import { isForbiddenAnywhere } from "./domains.js";
import { requiresPerActConfirmation, scopeDef } from "./scopes.js";

export type RevocationState = "active" | "revoked" | "unknown";

export interface DecisionRequest {
  claims: MandateClaims;
  action: string;
  audience: string;
  subject?: string;
  market?: string;
  /** Defaults to "unknown", not "active" — an institution that has not checked has not established authority. */
  revocation?: RevocationState;
  actConfirmation?: string;
  now?: Date;
}

/**
 * Deny reasons are a closed set on purpose — a free-text reason is a string
 * an integration will pattern-match on, and rewording it breaks them.
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
  | "malformed_claims";

export interface Decision {
  decision: "permit" | "deny";
  reason?: DenyReason;
  obligations: string[];
  jti: string;
  action: string;
  expiresInSeconds: number;
}

function deny(reason: DenyReason, claims: MandateClaims, action: string, exp: number): Decision {
  return { decision: "deny", reason, obligations: [], jti: claims.jti, action, expiresInSeconds: exp };
}

export function decide(req: DecisionRequest): Decision {
  const { claims, action, audience } = req;
  const now = req.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const expiresInSeconds = Math.max(0, (claims.exp ?? 0) - nowSec);

  if (claims.aud !== audience) return deny("audience_mismatch", claims, action, expiresInSeconds);
  if (req.subject && claims.sub !== req.subject) {
    return deny("subject_mismatch", claims, action, expiresInSeconds);
  }
  if (req.market && claims.market && claims.market !== req.market) {
    return deny("market_mismatch", claims, action, expiresInSeconds);
  }

  // Enforced here as well as at issuance, and checked before anything
  // temporal: an expired token carrying a forbidden scope still means
  // someone is issuing forbidden mandates, which is a registry-level
  // incident, not a stale credential.
  if (isForbiddenAnywhere(action)) return deny("scope_forbidden", claims, action, expiresInSeconds);
  if (claims.scopes.some((s: string) => isForbiddenAnywhere(s))) {
    return deny("scope_forbidden", claims, action, expiresInSeconds);
  }

  if (typeof claims.exp !== "number" || typeof claims.nbf !== "number") {
    return deny("malformed_claims", claims, action, expiresInSeconds);
  }
  if (nowSec < claims.nbf) return deny("not_yet_valid", claims, action, expiresInSeconds);
  if (nowSec >= claims.exp) return deny("expired", claims, action, expiresInSeconds);

  if (!scopeDef(action)) return deny("scope_unknown", claims, action, expiresInSeconds);
  if (!claims.scopes.includes(action)) return deny("scope_not_granted", claims, action, expiresInSeconds);

  // Holding "may cancel my subscriptions" is not agreement to cancel this one.
  if (requiresPerActConfirmation(action) && !req.actConfirmation?.trim()) {
    return deny("act_confirmation_required", claims, action, expiresInSeconds);
  }

  const revocation = req.revocation ?? "unknown";
  if (revocation === "revoked") return deny("revoked", claims, action, expiresInSeconds);
  if (revocation === "unknown") {
    // Not a permit with a warning. Softening this is how a revoked mandate
    // keeps working for the one caller who never checks.
    return deny("revocation_unknown", claims, action, expiresInSeconds);
  }

  const obligations: string[] = [`record:${claims.jti}`, `notify_principal:${action}`];
  if (req.actConfirmation?.trim()) obligations.push(`retain_confirmation:${req.actConfirmation.trim()}`);

  return { decision: "permit", obligations, jti: claims.jti, action, expiresInSeconds };
}

/**
 * Everything this mandate could authorise at this institution right now —
 * the loop every integrator would otherwise write themselves, and the one
 * most likely to get written wrong.
 */
export function permittedActions(req: Omit<DecisionRequest, "action" | "actConfirmation">): string[] {
  return req.claims.scopes.filter((scope: string) => {
    const d = decide({
      ...req,
      action: scope,
      actConfirmation: requiresPerActConfirmation(scope) ? "probe" : undefined,
    });
    return d.decision === "permit";
  });
}

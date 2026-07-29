/**
 * Letting other agents issue — the move that turns competitors into traffic.
 *
 * THE STRATEGIC PROBLEM THIS SOLVES
 *
 * Within a few years every consumer will have an agent, and every one of those
 * agents will be able to draft a claim as well as this one does. That is not a
 * threat to the letter-writing half of this product; it is the end of it as
 * anything defensible. A model that writes a better letter arrives every six
 * months and costs nothing.
 *
 * What does not commoditise is the other side. When every consumer has an
 * agent, institutions get flooded, and the bottleneck stops being *who writes
 * the letter* and becomes *whose letter an institution will accept*. They will
 * filter on exactly two questions: is this agent verifiably authorised, and is
 * there a record I can point at afterwards.
 *
 * That is the mandate layer. So the agent explosion is not the thing that kills
 * this company — it is the demand curve for its infrastructure. Which means the
 * correct posture toward a rival consumer agent is not to out-build it. It is
 * to want it issuing mandates in this format, because every one that does makes
 * the format harder to displace and none of that traffic has to be ours.
 *
 * Until now that was impossible. Issuance was gated by a single shared secret —
 * ours — so a third party could not adopt the format even if it wanted to, and
 * the rail had one train and no way to add another.
 *
 * TWO PATHS, AND THIS IS THE SMALLER ONE
 *
 * An agent that runs its own key infrastructure belongs in the trust registry
 * with its own JWKS, its own status list, and conformance evidence. It needs no
 * API from us at all, and that is the path that scales — a registry whose
 * operator must be called before anybody can join is a queue, not a standard.
 *
 * This is for agents that do not want to run cryptography. We sign, they act,
 * and it comes with one non-negotiable condition.
 *
 * THE CONDITION
 *
 * The mandate says so. `on_behalf_of` names the delegating agent inside the
 * token, so an institution can tell "Zakai's own user consented to this" from
 * "Zakai signed this for an agent whose user verification we did not perform".
 * Those are different assurances and pricing them the same would be this
 * company vouching for something it never did — which is the failure that ends
 * a trust network, and it ends it permanently.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { FORBIDDEN_SCOPES, isKnownScope } from "./scopes";
import { isForbiddenAnywhere } from "./domains";

/** Only the hash is ever stored, exactly as the reset and verification flows do. */
export function hashIssuerKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * A new credential. Returned once, at creation, and never recoverable.
 *
 * Prefixed so a key that leaks into a log or a repository is greppable by
 * anybody scanning for secrets — including us, and including the automated
 * scanners that find these before an attacker does.
 */
export function generateIssuerKey(): string {
  return `zkid_${randomBytes(32).toString("base64url")}`;
}

/** Constant-time comparison, so a mismatch reveals nothing by how long it took. */
export function issuerKeyMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashIssuerKey(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface DelegationCheck {
  slug: string;
  allowedScopes: readonly string[];
  status: string;
}

export type DelegationRefusal =
  | "unknown_issuer"
  | "suspended"
  | "scope_not_permitted"
  | "scope_forbidden"
  | "scope_unknown"
  | "no_scopes";

export type DelegationResult =
  | { ok: true; scopes: string[] }
  | { ok: false; reason: DelegationRefusal; scope?: string };

/**
 * May this agent have a mandate issued with these scopes?
 *
 * Pure, so it is testable without a database and so the rule lives in one place
 * rather than inside a route handler where the next route will reimplement it
 * slightly differently.
 *
 * The subset rule is the whole point. An issuer that could exceed its grant
 * simply by asking for more is not constrained — it is trusted, and a registry
 * built on trusting its members is a mailing list.
 */
export function checkDelegation(
  issuer: DelegationCheck | null,
  requested: readonly string[],
): DelegationResult {
  if (!issuer) return { ok: false, reason: "unknown_issuer" };

  // Suspension is immediate and needs no key rotation, which matters because
  // the moment you need to suspend somebody is the moment you cannot afford a
  // deployment.
  if (issuer.status !== "active") return { ok: false, reason: "suspended" };

  if (requested.length === 0) return { ok: false, reason: "no_scopes" };

  const allowed = new Set(issuer.allowedScopes);
  for (const scope of requested) {
    // Checked first and separately from "not permitted": a delegated issuer
    // asking for an act no mandate may ever carry is a different event from one
    // asking for something outside its own grant, and an operator reading the
    // logs needs to be able to tell them apart.
    if (isForbiddenAnywhere(scope) || FORBIDDEN_SCOPES.includes(scope)) {
      return { ok: false, reason: "scope_forbidden", scope };
    }
    if (!isKnownScope(scope)) return { ok: false, reason: "scope_unknown", scope };
    if (!allowed.has(scope)) return { ok: false, reason: "scope_not_permitted", scope };
  }

  return { ok: true, scopes: [...requested] };
}

/**
 * What goes into the token so the delegation is visible.
 *
 * An institution reading a mandate must be able to see, without asking anyone,
 * that the user verification behind it was performed by somebody else. Hiding
 * that would make every delegated mandate indistinguishable from a first-party
 * one, which is precisely the confusion an attacker would pay for.
 */
export function delegationClaim(slug: string, name: string) {
  return {
    on_behalf_of: { agent: slug, name },
    // Spelled out rather than implied by the presence of the field, because the
    // reader who most needs this sentence is a compliance officer skimming a
    // decoded token for the first time.
    note:
      "Issued by Zakai on behalf of the named agent. The principal's identity was verified by that agent, not by Zakai.",
  };
}

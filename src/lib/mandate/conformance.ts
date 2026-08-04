/**
 * The conformance suite — how a standard grows without us in the loop.
 *
 * A registry with one issuer is a JSON file. All of the value is in issuer
 * number two, and the thing that decides whether there is ever a number two is
 * not sales: it is whether a stranger can implement this correctly, prove it,
 * and join without a meeting.
 *
 * That is how standards actually spread. Let's Encrypt did not grow ACME by
 * signing partnerships; it published a specification and a way to check your
 * implementation against it. OpenID has a conformance programme. Every protocol
 * that won did the same thing, and every one that lost had a partnership team.
 *
 * So this module is the admission test, and it is deliberately hostile. It does
 * not check that a candidate issuer can produce something that looks like a
 * mandate — that is easy and proves nothing. It checks that they *refuse*
 * correctly: that they reject a forged signature, honour the audience binding,
 * expire what should be expired, and will not issue a scope no issuer may ever
 * hold. An implementation that accepts everything passes a naive test suite and
 * is worse than useless in a trust network, because every other participant is
 * relying on it to say no.
 *
 * Pure and dependency-free on purpose: an issuer runs this against their own
 * endpoints, gets a signed-off result, and the registry admits them on the
 * evidence. Nobody at Zakai has to read their code.
 */

import { FORBIDDEN_SCOPES } from "./scopes";

export type CheckId =
  | "issues_valid_jwt"
  | "registered_claims_present"
  | "scope_is_oauth_shaped"
  | "rejects_forged_signature"
  | "enforces_audience"
  | "enforces_expiry"
  | "refuses_forbidden_scope"
  | "publishes_jwks"
  | "publishes_status_list"
  | "revocation_takes_effect";

export type Severity = "must" | "should";

export interface CheckDef {
  id: CheckId;
  severity: Severity;
  /** What is being asserted, in the words an implementer needs. */
  requirement: string;
  /** Why it matters to everyone else in the network, not just to them. */
  rationale: string;
}

/**
 * The checks, in the order an implementer will hit them.
 *
 * `must` failures block admission. `should` failures are published on the
 * registry entry rather than hidden — an institution deciding whether to honour
 * an issuer's mandates deserves to see that it does not, say, publish a status
 * list, even if it is otherwise sound.
 */
export const CHECKS: readonly CheckDef[] = [
  {
    id: "issues_valid_jwt",
    severity: "must",
    requirement: "Mandates verify as a standard JWT with alg EdDSA and typ JWT.",
    rationale:
      "Every verifier uses the JWT library it already has. A bespoke envelope pushes each of them onto low-level JOSE and hand-written checks, which is where audience and expiry get skipped.",
  },
  {
    id: "registered_claims_present",
    severity: "must",
    requirement: "iss, aud, sub, jti, iat, nbf and exp are all present as registered claims.",
    rationale:
      "Registered claims are enforced by standard validators. Moving any of them into a private namespace means every verifier has to remember to check it by hand, and some will not.",
  },
  {
    id: "scope_is_oauth_shaped",
    severity: "should",
    requirement: "The grant is a space-delimited `scope` string.",
    rationale:
      "Gateways and authorisation servers that already speak OAuth then read the grant with no bespoke code. A structured array works but costs every integrator a mapping layer.",
  },
  {
    id: "rejects_forged_signature",
    severity: "must",
    requirement: "A mandate whose payload was altered after signing is rejected.",
    rationale:
      "The single assumption every other participant makes about you. An issuer that accepts tampered tokens turns the whole registry into a list of people who might be lying.",
  },
  {
    id: "enforces_audience",
    severity: "must",
    requirement: "A mandate issued for one audience is refused when presented to another.",
    rationale:
      "Without audience binding a leaked mandate is a skeleton key across every institution in the network, not just the one it was meant for.",
  },
  {
    id: "enforces_expiry",
    severity: "must",
    requirement: "An expired mandate is refused, with clock skew tolerance no greater than 300s.",
    rationale:
      "Expiry is half of revocation. A generous skew window is a quiet extension of every credential you have ever issued.",
  },
  {
    id: "refuses_forbidden_scope",
    severity: "must",
    requirement: `A mandate is never issued carrying any of: ${FORBIDDEN_SCOPES.join(", ")}.`,
    rationale:
      "This is the promise that lets an institution accept a mandate without underwriting the issuer's payment stack. One issuer breaking it devalues every mandate in the network, including the ones that kept the rule.",
  },
  {
    id: "publishes_jwks",
    severity: "must",
    requirement: "Public keys are served over HTTPS at a stable URL, with no private components.",
    rationale:
      "Offline verification is the whole design. An issuer whose keys cannot be fetched and cached forces every verifier into a live dependency on them.",
  },
  {
    id: "publishes_status_list",
    severity: "should",
    requirement:
      "Issued mandates embed zkm.status { idx, uri } pointing at a signed status list (refreshed at least hourly).",
    rationale:
      "Without it, revocation requires a live per-mandate call — which is the availability dependency and the query trail this protocol exists to remove.",
  },
  {
    id: "revocation_takes_effect",
    severity: "must",
    requirement:
      "A mandate revoked by its holder is reflected as revoked within one status-list refresh.",
    rationale:
      "A revocation that does not land means a person withdrew authority and the network kept acting on it. Everything else here is decoration if this fails.",
  },
];

export interface CheckResult {
  id: CheckId;
  passed: boolean;
  /** What the candidate actually did, when it failed. */
  detail?: string;
}

export type ConformanceVerdict = "conformant" | "conformant_with_notes" | "not_conformant";

export interface ConformanceReport {
  verdict: ConformanceVerdict;
  /** Failures that block admission. */
  blocking: CheckDef[];
  /** Failures published on the registry entry rather than hidden. */
  notes: CheckDef[];
  /** Checks the candidate never ran. Treated as failures — see below. */
  missing: CheckId[];
  summary: string;
}

/**
 * Grade a candidate.
 *
 * A check that was not run counts as failed, at its declared severity. The
 * alternative — treating silence as a pass — means an incomplete run looks
 * identical to a clean one, and the first issuer to discover that will submit
 * exactly the subset it can pass. Absence of evidence is not evidence here; it
 * is the most common way a conformance programme becomes theatre.
 */
export function assessConformance(results: readonly CheckResult[]): ConformanceReport {
  const byId = new Map(results.map((r) => [r.id, r]));
  const missing: CheckId[] = [];
  const blocking: CheckDef[] = [];
  const notes: CheckDef[] = [];

  for (const check of CHECKS) {
    const result = byId.get(check.id);
    if (!result) missing.push(check.id);
    if (result?.passed) continue;
    if (check.severity === "must") blocking.push(check);
    else notes.push(check);
  }

  const verdict: ConformanceVerdict =
    blocking.length > 0
      ? "not_conformant"
      : notes.length > 0
        ? "conformant_with_notes"
        : "conformant";

  const summary =
    verdict === "conformant"
      ? `All ${CHECKS.length} checks pass. This implementation can be admitted to the registry.`
      : verdict === "conformant_with_notes"
        ? `Required checks pass; ${notes.length} recommended one(s) do not. Admissible, and the gaps are published on the registry entry so institutions can see them.`
        : `${blocking.length} required check(s) fail: ${blocking.map((c) => c.id).join(", ")}. Not admissible — every other participant relies on these.`;

  return { verdict, blocking, notes, missing, summary };
}

/** The suite as a candidate fetches it, before writing any code. */
export function conformanceDocument() {
  return {
    version: 1,
    profile: "zakai-mandate-1",
    checks: CHECKS.map((c) => ({
      id: c.id,
      severity: c.severity,
      requirement: c.requirement,
      rationale: c.rationale,
    })),
    /**
     * Stated up front rather than discovered on rejection. An implementer who
     * learns on submission that unrun checks count against them has already
     * wasted the effort, and will assume the rest of the rules are also hidden.
     */
    rules: [
      "A check that was not run counts as failed at its declared severity.",
      "All `must` checks are required for admission.",
      "Failed `should` checks are published on the registry entry, not hidden.",
      "Admission is on evidence, not review: nobody reads your source.",
    ],
  };
}

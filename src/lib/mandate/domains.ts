/**
 * The ceiling, raised.
 *
 * WHAT WAS ACTUALLY LIMITING THIS
 *
 * The authority and settlement layers are general. The *vocabulary* was not:
 * every scope named a financial act, so the largest honest description of the
 * addressable surface was "consumer money", and the natural comparison was a
 * payments network. Payments networks are worth hundreds of billions and stop
 * there, because payments is a bounded market.
 *
 * The companies that got past that all share one property, and it is not
 * excellence. It is that their layer applies to *everything*, so their revenue
 * grows with other people's activity rather than with their own market. An
 * operating system is not a market. A search index is not a market. A GPU is
 * not a market. Each is a thing every other market has to pass through.
 *
 * WHAT THE PRIMITIVE ACTUALLY IS
 *
 * Strip the finance vocabulary away and the underlying object is:
 *
 *   person P authorises agent A to perform act X against institution I —
 *   verifiably, revocably, within a stated limit, leaving a settlement record
 *   nobody can unilaterally write.
 *
 * Nothing in that sentence is about money. It is about **an institution
 * accepting an instruction from software acting for a human**, which is a
 * problem that exists identically in healthcare, government, employment,
 * housing and education, and is unsolved in every one of them. In each, the
 * current answer is the same as it was in finance: a person on a phone reading
 * a scanned form.
 *
 * So this file makes the vocabulary extensible by domain while the core stays
 * single. Money recovery becomes the wedge that proves the layer, not the
 * market that bounds it.
 *
 * THE PATTERN THAT MAKES ADOPTION POSSIBLE, GENERALISED
 *
 * `FORBIDDEN_SCOPES` was never a safety feature bolted on. It is the reason a
 * bank's risk committee can say yes: an agent that provably cannot move money
 * outward is a categorically different object from one that can, so the worst
 * case of a compromise is unwanted correspondence rather than theft.
 *
 * Every domain needs its own version of that sentence, and the ones here are
 * not decorative. An agent that cannot consent to treatment. One that cannot
 * waive a legal right or plead on your behalf. One that cannot resign your job
 * or sign a tenancy. Each limit is what lets the counterparty in that sector
 * accept the credential at all, and each is enforced globally rather than only
 * within its own domain — a finance mandate can no more carry
 * `treatment:consent` than a health one can carry `payment:initiate`.
 */

import { FORBIDDEN_SCOPES, SCOPES, type ScopeDef } from "./scopes";

export type Domain = "finance" | "health" | "government" | "employment" | "housing" | "education";

export interface DomainDef {
  id: Domain;
  /**
   * The categorical limit, in the words a risk committee needs. Stated as what
   * the agent *cannot* do, because that is the sentence that gets a yes.
   */
  limit: string;
  /**
   * Acts no mandate may ever authorise in this domain, enforced rather than
   * merely unimplemented — and enforced across every domain, not only this one.
   */
  forbidden: readonly string[];
  /** Whether the vocabulary is ready to issue against, or reserved. */
  status: "live" | "reserved";
}

/**
 * Only finance is live. The rest are reserved with their limits already fixed,
 * which is the point of writing them now: a categorical limit decided after a
 * sector's first customer asks for an exception is not a limit, it is a
 * negotiating position. Deciding them while nothing is at stake is the only
 * time the decision is honest.
 */
export const DOMAINS: readonly DomainDef[] = [
  {
    id: "finance",
    limit: "An agent may never move money outward. Money flows only toward the principal.",
    forbidden: FORBIDDEN_SCOPES,
    status: "live",
  },
  {
    id: "health",
    limit:
      "An agent may never consent to treatment, refuse care, or alter a clinical record. It may request, correct and dispute — never decide.",
    forbidden: [
      "treatment:consent",
      "treatment:refuse",
      "record:alter",
      "prescription:request",
      "directive:amend",
    ],
    status: "reserved",
  },
  {
    id: "government",
    limit:
      "An agent may never waive a right, enter a plea, accept a settlement that extinguishes a claim, or surrender a status.",
    forbidden: ["right:waive", "plea:enter", "claim:withdraw", "status:surrender", "appeal:abandon"],
    status: "reserved",
  },
  {
    id: "employment",
    limit:
      "An agent may never resign, accept termination, or sign a binding term of employment. It may ask, verify and dispute.",
    forbidden: ["employment:resign", "termination:accept", "contract:sign", "grievance:withdraw"],
    status: "reserved",
  },
  {
    id: "housing",
    limit:
      "An agent may never sign, surrender or terminate a tenancy, nor accept a settlement that ends possession.",
    forbidden: ["tenancy:sign", "tenancy:surrender", "possession:concede", "deposit:forfeit"],
    status: "reserved",
  },
  {
    id: "education",
    limit:
      "An agent may never withdraw an enrolment, accept an academic sanction, or alter a record of attainment.",
    forbidden: ["enrolment:withdraw", "sanction:accept", "attainment:alter"],
    status: "reserved",
  },
];

/**
 * Every forbidden act across every domain, enforced globally.
 *
 * A finance mandate can no more carry `treatment:consent` than a health one can
 * carry `payment:initiate`. Scoping the prohibitions per domain would mean an
 * issuer could reach a forbidden act simply by declaring itself to be in a
 * different sector, which is not a limit — it is a formality.
 */
export const ALL_FORBIDDEN: readonly string[] = Array.from(
  new Set(DOMAINS.flatMap((d) => d.forbidden)),
);

export function domainDef(id: string): DomainDef | undefined {
  return DOMAINS.find((d) => d.id === id);
}

export function liveDomains(): DomainDef[] {
  return DOMAINS.filter((d) => d.status === "live");
}

/**
 * Which domain a scope belongs to.
 *
 * Every scope in the live vocabulary is financial, and the existing strings
 * carry no domain prefix — deliberately, because changing them would break
 * every mandate already issued and every implementation already conformant, in
 * exchange for tidiness. New domains carry theirs explicitly.
 */
export function domainOf(scope: string): Domain | undefined {
  const prefixed = DOMAINS.find((d) => scope.startsWith(`${d.id}/`));
  if (prefixed) return prefixed.id;
  const known: ScopeDef | undefined = SCOPES.find((s) => s.scope === scope);
  return known ? "finance" : undefined;
}

/**
 * Is this act categorically refused, whatever domain claims it?
 *
 * Checks the bare act as well as any domain-prefixed form, so
 * `health/treatment:consent` is refused exactly as `treatment:consent` is.
 * A prohibition a caller can step around by adding a prefix is not one.
 */
export function isForbiddenAnywhere(scope: string): boolean {
  if (ALL_FORBIDDEN.includes(scope)) return true;
  const slash = scope.indexOf("/");
  return slash > 0 && ALL_FORBIDDEN.includes(scope.slice(slash + 1));
}

/**
 * The published statement of what agents may never do, per sector.
 *
 * Worth publishing before any of these sectors exists as a customer. The limits
 * are the part a counterparty evaluates, and a limit that appears at the same
 * time as the sales conversation reads as something invented for it.
 */
export function domainDocument() {
  return {
    spec: "zakai-mandate-domains",
    version: 1,
    principle:
      "A mandate authorises correspondence and claims. It never authorises the acts that cannot be undone.",
    domains: DOMAINS.map((d) => ({
      id: d.id,
      status: d.status,
      limit: d.limit,
      never: d.forbidden,
    })),
    enforced_globally: ALL_FORBIDDEN,
    note: "Prohibitions apply across every domain. An issuer cannot reach a forbidden act by declaring itself to be in another sector.",
  };
}

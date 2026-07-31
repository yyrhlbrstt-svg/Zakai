/**
 * Domain-scoped forbidden acts — ported verbatim from the Zakai production
 * app (src/lib/mandate/domains.ts).
 *
 * The vocabulary in scopes.ts is finance-shaped, but the underlying primitive
 * is not: "person authorises agent to perform act X against institution I —
 * verifiably, revocably, within a stated limit" applies identically in
 * health, government, employment, housing and education. Only finance is
 * live; the rest are reserved with their categorical limits already fixed —
 * decided before any sector's first customer can ask for an exception.
 */

import { FORBIDDEN_SCOPES } from "./scopes.js";

export type Domain = "finance" | "health" | "government" | "employment" | "housing" | "education";

export interface DomainDef {
  id: Domain;
  /** The categorical limit, stated as what the agent cannot do. */
  limit: string;
  /** Acts no mandate may ever authorise in this domain — enforced globally, not only within it. */
  forbidden: readonly string[];
  status: "live" | "reserved";
}

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
    forbidden: ["treatment:consent", "treatment:refuse", "record:alter", "prescription:request", "directive:amend"],
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
    limit: "An agent may never withdraw an enrolment, accept an academic sanction, or alter a record of attainment.",
    forbidden: ["enrolment:withdraw", "sanction:accept", "attainment:alter"],
    status: "reserved",
  },
];

/**
 * Every forbidden act across every domain, enforced globally. A finance
 * mandate can no more carry `treatment:consent` than a health one can carry
 * `payment:initiate` — scoping prohibitions per domain would let an issuer
 * reach a forbidden act just by declaring itself to be in a different sector.
 */
export const ALL_FORBIDDEN: readonly string[] = Array.from(new Set(DOMAINS.flatMap((d) => d.forbidden)));

export function domainDef(id: string): DomainDef | undefined {
  return DOMAINS.find((d) => d.id === id);
}

export function isForbiddenAnywhere(scope: string): boolean {
  if (ALL_FORBIDDEN.includes(scope)) return true;
  const slash = scope.indexOf("/");
  return slash > 0 && ALL_FORBIDDEN.includes(scope.slice(slash + 1));
}

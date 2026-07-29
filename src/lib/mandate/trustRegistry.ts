/**
 * The trust registry — the move from vendor API to protocol.
 *
 * WHY THIS EXISTS
 *
 * As long as Zakai is the only party that can issue a mandate, the mandate is
 * an integration with Zakai. Institutions treat it as one vendor's token, price
 * the integration accordingly, and nothing compounds. Adding countries does not
 * change that; adding languages does not change that.
 *
 * What changes it is other people issuing mandates in this format, signed with
 * their own keys, verified by institutions against a registry we maintain. Visa
 * does not issue cards — banks do. Visa runs the network and the rules, and
 * that is the position worth having, because every new issuer makes the format
 * more valuable to every institution and every institution makes it more
 * valuable to every issuer. One integration, four sides, all reinforcing.
 *
 * WHY WE CAN CREDIBLY BE THE REFEREE
 *
 * Every agent vendor — OpenAI, Anthropic, Google, a bank's own assistant —
 * wants to *send* agents. None of them can own the verification standard,
 * because a standard owned by one agent vendor is one no competing vendor will
 * adopt and no institution will trust: the referee cannot also be a player.
 *
 * Zakai is not an agent vendor to the institutions that verify, and — this is
 * the part that actually matters — a Zakai-format mandate is structurally
 * incapable of moving money outward. An institution accepting one is accepting
 * a bounded claim about authority, not underwriting somebody's payment stack.
 * That is a promise no general-purpose agent credential can make.
 *
 * THE RULE THAT KEEPS IT WORTH TRUSTING
 *
 * An issuer's permissions are a subset of the protocol's, never an extension.
 * A registry that let a well-funded issuer negotiate itself a wider scope set
 * would be a registry whose guarantees hold only until someone important asks
 * nicely — which is to say, no guarantees at all. `FORBIDDEN_SCOPES` binds
 * every issuer, permanently, with no override path in the type.
 */

import { FORBIDDEN_SCOPES, isKnownScope } from "./scopes";

export type IssuerStatus = "active" | "suspended" | "withdrawn";

export interface RegisteredIssuer {
  /** The exact `iss` claim its mandates carry. */
  iss: string;
  /** Display name, for consent screens and audit logs. */
  name: string;
  /** Where its public keys live. Institutions fetch and cache this. */
  jwksUri: string;
  /** Where its signed revocation list lives. */
  statusListUri: string;
  /**
   * The scopes this issuer may grant — always a subset of the protocol's.
   * Narrower than the full set is normal: an airline's assistant has no
   * business issuing mandates about someone's pension.
   */
  allowedScopes: string[];
  status: IssuerStatus;
  /** ISO date the issuer was admitted. */
  admittedAt: string;
  /** Why it was suspended or withdrawn, when it was. */
  note?: string;
}

/**
 * The registry as shipped. Zakai is in it as one issuer among the others, on
 * the same terms — a registry whose operator holds privileges it does not
 * grant anyone else is one nobody else will join.
 */
export const ISSUERS: RegisteredIssuer[] = [
  {
    iss: "https://zakai-3uxj.vercel.app",
    name: "Zakai",
    jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
    statusListUri: "https://zakai-3uxj.vercel.app/api/mandate/revocations",
    allowedScopes: [
      "read:accounts",
      "read:transactions",
      "read:credit",
      "read:bills",
      "read:policies",
      "read:payroll",
      "read:tax",
      "claim:submit",
      "claim:appeal",
      "dispute:charge",
      "request:records",
      "negotiate:tariff",
      "contract:cancel",
      "contract:switch",
      "settle:receive",
    ],
    status: "active",
    admittedAt: "2026-07-01",
  },
];

export type AdmissionProblem =
  | { kind: "unknown_scope"; scope: string }
  | { kind: "forbidden_scope"; scope: string }
  | { kind: "insecure_uri"; field: "jwksUri" | "statusListUri" | "iss"; value: string }
  | { kind: "duplicate_iss"; iss: string }
  | { kind: "empty_scopes" };

/**
 * Everything that must be true before an issuer joins.
 *
 * Run at admission and again on every registry publish, because a registry
 * validated once and edited afterwards is a registry that is wrong the first
 * time somebody hand-edits it.
 */
export function validateIssuer(
  candidate: RegisteredIssuer,
  existing: readonly RegisteredIssuer[] = ISSUERS,
): AdmissionProblem[] {
  const problems: AdmissionProblem[] = [];

  // Plain HTTP anywhere in the chain means the keys an institution trusts can
  // be swapped in transit, which defeats every other guarantee here.
  for (const field of ["iss", "jwksUri", "statusListUri"] as const) {
    const value = candidate[field];
    if (!/^https:\/\//i.test(value)) problems.push({ kind: "insecure_uri", field, value });
  }

  if (existing.some((i) => i.iss === candidate.iss)) {
    problems.push({ kind: "duplicate_iss", iss: candidate.iss });
  }
  if (candidate.allowedScopes.length === 0) problems.push({ kind: "empty_scopes" });

  for (const scope of candidate.allowedScopes) {
    if (FORBIDDEN_SCOPES.includes(scope)) {
      problems.push({ kind: "forbidden_scope", scope });
    } else if (!isKnownScope(scope)) {
      problems.push({ kind: "unknown_scope", scope });
    }
  }

  return problems;
}

/**
 * Where a named party's keys actually live.
 *
 * Exists because the whole identity guarantee in the settlement layer rests on
 * one thing a library cannot check for itself: that the keys handed to a
 * verifier genuinely belong to the party being claimed. A caller who resolves
 * one institution's JWKS and then asks "is this signed by the other one" has
 * told the verifier a falsehood about the world, and it will believe them.
 *
 * So the safe path is made the easy one. Given an identity, this returns the
 * one place its keys may be fetched from, or nothing at all — an unregistered
 * or withdrawn issuer has no key location, which is the correct answer and not
 * an error to work around.
 */
export function resolveIssuerKeysUri(iss: string): string | null {
  const issuer = findIssuer(iss);
  if (!issuer || issuer.status !== "active") return null;
  return issuer.jwksUri;
}

export function findIssuer(iss: string): RegisteredIssuer | undefined {
  return ISSUERS.find((i) => i.iss === iss);
}

export type TrustDecision =
  | { trusted: true; issuer: RegisteredIssuer }
  | { trusted: false; reason: "unknown_issuer" | "suspended" | "withdrawn" | "scope_not_granted"; scope?: string };

/**
 * Should this institution honour this mandate?
 *
 * Deliberately separate from signature verification, and ordered after it: a
 * valid signature proves who issued something, not that anyone should act on
 * it. The two questions get confused constantly, and conflating them is how a
 * withdrawn issuer's perfectly-signed credentials keep working.
 */
export function decideTrust(iss: string, scopes: readonly string[]): TrustDecision {
  const issuer = findIssuer(iss);
  if (!issuer) return { trusted: false, reason: "unknown_issuer" };
  if (issuer.status !== "active") return { trusted: false, reason: issuer.status };

  for (const scope of scopes) {
    // An issuer that has gone beyond its grant is not partially trusted for the
    // rest: the mandate as presented is not one it was entitled to write, and
    // honouring the acceptable half would reward overreach.
    if (!issuer.allowedScopes.includes(scope)) {
      return { trusted: false, reason: "scope_not_granted", scope };
    }
  }
  return { trusted: true, issuer };
}

/** The published registry, as institutions fetch it. */
export function registryDocument() {
  return {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    /**
     * Stated in the document itself so an implementer reads it before writing
     * a line: these scopes are refused for every issuer, now and later. It is
     * the reason an institution can bound its risk without auditing us.
     */
    forbiddenScopes: FORBIDDEN_SCOPES,
    issuers: ISSUERS.map((i) => ({
      iss: i.iss,
      name: i.name,
      jwks_uri: i.jwksUri,
      status_list_uri: i.statusListUri,
      allowed_scopes: i.allowedScopes,
      status: i.status,
      admitted_at: i.admittedAt,
      ...(i.note ? { note: i.note } : {}),
    })),
  };
}

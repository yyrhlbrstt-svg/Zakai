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

import "server-only";
import { prisma } from "@/lib/prisma";
import { FORBIDDEN_SCOPES, isKnownScope } from "./scopes";

/**
 * `sandbox` — local/demo federation only. May appear in discovery for
 * evaluation; never counts toward G5 / “second issuer” market control.
 */
export type IssuerStatus = "active" | "suspended" | "withdrawn" | "sandbox";

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

function extraIssuersFromEnv(): RegisteredIssuer[] {
  const raw = process.env.ZAKAI_EXTRA_ISSUERS_JSON;
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RegisteredIssuer[];
  } catch {
    return [];
  }
}

/**
 * Durable, per-row admissions from RegisteredIssuerRow. Fails to an empty
 * list on any DB error — the same "an outage denies rather than permits"
 * posture the revocation check already uses: an unreachable issuer row
 * simply doesn't resolve, which is the correct, safe outcome for a party
 * this registry can no longer confirm the status of. It never affects
 * Zakai's own first-party ISSUERS[0] entry, which carries no DB dependency.
 */
async function dbIssuers(): Promise<RegisteredIssuer[]> {
  try {
    const rows = await prisma.registeredIssuerRow.findMany();
    return rows.map((r) => ({
      iss: r.iss,
      name: r.name,
      jwksUri: r.jwksUri,
      statusListUri: r.statusListUri,
      allowedScopes: r.allowedScopes,
      status: r.status as IssuerStatus,
      admittedAt: r.admittedAt.toISOString().slice(0, 10),
      ...(r.note ? { note: r.note } : {}),
    }));
  } catch {
    return [];
  }
}

/** Core issuers, plus DB admissions, plus validated entries from `ZAKAI_EXTRA_ISSUERS_JSON` (bootstrap/override). */
export async function listRegisteredIssuers(): Promise<RegisteredIssuer[]> {
  const merged: RegisteredIssuer[] = [...ISSUERS];
  for (const candidate of await dbIssuers()) {
    if (merged.some((i) => i.iss === candidate.iss)) continue;
    merged.push(candidate);
  }
  for (const candidate of extraIssuersFromEnv()) {
    // Sandbox rows skip strict admission (duplicate/unknown checks still run for active).
    if (candidate.status === "sandbox") {
      merged.push(candidate);
      continue;
    }
    const problems = validateIssuer(candidate, merged);
    if (problems.length === 0) merged.push(candidate);
  }
  return merged;
}

/** Issuers that count for network control (G5) — never sandbox. */
export async function countActiveNetworkIssuers(): Promise<number> {
  return (await listRegisteredIssuers()).filter((i) => i.status === "active").length;
}

export type RegisterIssuerResult =
  | { ok: true; issuer: RegisteredIssuer }
  | { ok: false; problems: AdmissionProblem[] };

/**
 * Admit a full issuer — the durable counterpart to hand-editing
 * ZAKAI_EXTRA_ISSUERS_JSON. Runs the exact same validateIssuer() checks the
 * env path already ran silently (a malformed env entry was just dropped with
 * no error surfaced to whoever edited it); here a rejection is returned, not
 * swallowed. The trust *decision* is unchanged — this only replaces the
 * error-prone mechanical step of hand-crafting the JSON blob entry.
 */
export async function registerFullIssuer(
  candidate: Omit<RegisteredIssuer, "admittedAt"> & { admittedAt?: string },
): Promise<RegisterIssuerResult> {
  const existing = await listRegisteredIssuers();
  const withDate: RegisteredIssuer = {
    ...candidate,
    admittedAt: candidate.admittedAt ?? new Date().toISOString().slice(0, 10),
  };
  const problems = validateIssuer(withDate, existing);
  if (problems.length > 0) return { ok: false, problems };

  await prisma.registeredIssuerRow.create({
    data: {
      iss: withDate.iss,
      name: withDate.name,
      jwksUri: withDate.jwksUri,
      statusListUri: withDate.statusListUri,
      allowedScopes: withDate.allowedScopes,
      status: withDate.status,
      note: withDate.note ?? "",
    },
  });
  return { ok: true, issuer: withDate };
}

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
export async function resolveIssuerKeysUri(iss: string): Promise<string | null> {
  const issuer = await findIssuer(iss);
  if (!issuer || issuer.status !== "active") return null;
  return issuer.jwksUri;
}

export async function findIssuer(iss: string): Promise<RegisteredIssuer | undefined> {
  return (await listRegisteredIssuers()).find((i) => i.iss === iss);
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
export async function decideTrust(iss: string, scopes: readonly string[]): Promise<TrustDecision> {
  const issuer = await findIssuer(iss);
  if (!issuer) return { trusted: false, reason: "unknown_issuer" };
  // Sandbox is for offline evaluation fixtures — production trust refuses it.
  if (issuer.status === "sandbox") return { trusted: false, reason: "suspended" };
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
export async function registryDocument() {
  return {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    /**
     * Stated in the document itself so an implementer reads it before writing
     * a line: these scopes are refused for every issuer, now and later. It is
     * the reason an institution can bound its risk without auditing us.
     */
    forbiddenScopes: FORBIDDEN_SCOPES,
    /**
     * An agent that would rather not run its own keys does not get its own row
     * here — it never signs anything, so it has no `iss` and no JWKS. Zakai
     * issues on its behalf, `iss` on those mandates is still Zakai's, and the
     * only place the distinction shows up is inside the token: a mandate whose
     * signer is Zakai but whose `zkm.onBehalfOf` is present was verified by the
     * named agent, not by Zakai. That is a narrower assurance, and pricing or
     * logging it identically to a mandate Zakai verified itself would be this
     * registry vouching for a check it did not perform.
     */
    delegatedIssuance: {
      note:
        "Some Zakai-signed mandates act on behalf of a third-party agent that holds no key of its own and therefore has no entry in `issuers`. Check zkm.onBehalfOf on the verified claims, not this list, to find them.",
      claim: "zkm.onBehalfOf",
    },
    admission: {
      delegated_apply: "POST /api/mandate/delegation/apply",
      delegated_roster: "GET /api/mandate/delegation/issuers",
      delegated_admit: "POST /api/mandate/delegation/issuers (admin token)",
      evidence_package: "GET /api/mandate/delegation/evidence",
      evidence_dry_run: "POST /api/mandate/delegation/evidence",
      full_issuer_note:
        "Full issuers with their own JWKS: dry-run a candidate row against validateIssuer via POST /api/mandate/delegation/evidence, then admission is POST /api/mandate/registry/issuers (admin token, after conformance review) or run your own registry fork.",
      full_issuer_admit: "POST /api/mandate/registry/issuers (admin token)",
      env_extra_issuers: "ZAKAI_EXTRA_ISSUERS_JSON (bootstrap/override layer only)",
    },
    issuers: (await listRegisteredIssuers()).map((i) => ({
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

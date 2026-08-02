/**
 * Trust-registry consumption — the client half of the network position.
 *
 * Verifying a signature proves who wrote a token. It does not prove the
 * writer was entitled to write it: that answer lives in the trust registry
 * Zakai publishes at /.well-known/zakai-trust-registry.json — which issuers
 * exist, where their keys live, which scopes each may grant, and whether
 * they are currently suspended. An integration that skips the registry can
 * verify Zakai's own mandates and nothing else, forever; an integration
 * that resolves through it verifies every issuer the network admits, today
 * and later, without shipping a new line of code.
 *
 * The rules mirrored here are ported from the registry's own operator logic
 * (`decideTrust` in the production app), so a verifier and the registry
 * cannot disagree about what admission means:
 *
 *   - an unknown issuer is untrusted (not "unknown", untrusted);
 *   - a suspended or withdrawn issuer's perfectly-signed mandates stop
 *     working immediately;
 *   - an issuer that granted a scope beyond its registry entry is not
 *     partially trusted for the rest — overreach poisons the whole mandate.
 */

import { decodeJwt } from "jose";
import { verifyMandateFromUrl, type MandateClaims } from "./mandate.js";

export const REGISTRY_PATH = "/.well-known/zakai-trust-registry.json";

export type RegistryIssuerStatus = "active" | "suspended" | "withdrawn";

export interface RegistryIssuer {
  iss: string;
  name: string;
  jwksUri: string;
  statusListUri: string;
  allowedScopes: string[];
  status: RegistryIssuerStatus;
  admittedAt: string;
  note?: string;
}

export interface TrustRegistry {
  version: number;
  updated: string;
  forbiddenScopes: string[];
  issuers: RegistryIssuer[];
}

export class RegistryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "REGISTRY_UNAVAILABLE"
      | "REGISTRY_MALFORMED"
      | "UNKNOWN_ISSUER"
      | "ISSUER_SUSPENDED"
      | "ISSUER_WITHDRAWN"
      | "ISSUER_SCOPE_EXCEEDED",
    readonly scope?: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

/** Fetch and normalise the published registry document. */
export async function fetchTrustRegistry(registryUri: string): Promise<TrustRegistry> {
  let res: Response;
  try {
    res = await fetch(registryUri, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new RegistryError(
      `trust registry unreachable: ${err instanceof Error ? err.message : String(err)}`,
      "REGISTRY_UNAVAILABLE",
    );
  }
  if (!res.ok) {
    throw new RegistryError(`trust registry returned ${res.status}`, "REGISTRY_UNAVAILABLE");
  }

  const doc = (await res.json()) as {
    version?: number;
    updated?: string;
    forbiddenScopes?: string[];
    issuers?: {
      iss?: string;
      name?: string;
      jwks_uri?: string;
      status_list_uri?: string;
      allowed_scopes?: string[];
      status?: string;
      admitted_at?: string;
      note?: string;
    }[];
  };

  if (!Array.isArray(doc.issuers)) {
    throw new RegistryError("registry document has no issuers array", "REGISTRY_MALFORMED");
  }

  return {
    version: Number(doc.version ?? 0),
    updated: String(doc.updated ?? ""),
    forbiddenScopes: doc.forbiddenScopes ?? [],
    issuers: doc.issuers.map((i) => ({
      iss: String(i.iss ?? ""),
      name: String(i.name ?? ""),
      jwksUri: String(i.jwks_uri ?? ""),
      statusListUri: String(i.status_list_uri ?? ""),
      allowedScopes: i.allowed_scopes ?? [],
      status: (i.status as RegistryIssuerStatus) ?? "withdrawn",
      admittedAt: String(i.admitted_at ?? ""),
      ...(i.note ? { note: i.note } : {}),
    })),
  };
}

export type TrustDecision =
  | { trusted: true; issuer: RegistryIssuer }
  | {
      trusted: false;
      reason: "unknown_issuer" | "suspended" | "withdrawn" | "scope_not_granted";
      scope?: string;
    };

/**
 * Should a mandate from this issuer, carrying these scopes, be honoured?
 * Ported from the registry operator's own rule so the two cannot drift.
 */
export function decideTrust(
  iss: string,
  scopes: readonly string[],
  issuers: readonly RegistryIssuer[],
): TrustDecision {
  const issuer = issuers.find((i) => i.iss === iss);
  if (!issuer) return { trusted: false, reason: "unknown_issuer" };
  if (issuer.status !== "active") return { trusted: false, reason: issuer.status };

  for (const scope of scopes) {
    if (!issuer.allowedScopes.includes(scope)) {
      return { trusted: false, reason: "scope_not_granted", scope };
    }
  }
  return { trusted: true, issuer };
}

export interface VerifyWithRegistryOptions {
  /** The verifying institution's own id. */
  audience: string;
  /** Where the trust registry lives, e.g. https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json */
  registryUri: string;
  toleranceSeconds?: number;
  now?: Date;
}

/**
 * The full network verification: read the token's `iss`, resolve the issuer
 * through the trust registry, verify the signature against *that issuer's*
 * registered JWKS (never a caller-supplied one), then confirm every granted
 * scope is within the issuer's registry entry.
 *
 * The unverified `iss` read is safe by construction — it only selects which
 * registered key set the signature must then survive. A forged `iss` either
 * names an unregistered issuer (rejected before any crypto) or names a real
 * one whose keys the forger does not hold (rejected by the signature).
 */
export async function verifyMandateWithRegistry(
  token: string,
  options: VerifyWithRegistryOptions,
): Promise<{ claims: MandateClaims; issuer: RegistryIssuer }> {
  const iss = String(decodeJwt(token).iss ?? "");
  const registry = await fetchTrustRegistry(options.registryUri);

  const preTrust = decideTrust(iss, [], registry.issuers);
  if (!preTrust.trusted) {
    if (preTrust.reason === "unknown_issuer") {
      throw new RegistryError(`issuer not in trust registry: ${iss || "(missing iss)"}`, "UNKNOWN_ISSUER");
    }
    throw new RegistryError(
      `issuer ${iss} is ${preTrust.reason}`,
      preTrust.reason === "suspended" ? "ISSUER_SUSPENDED" : "ISSUER_WITHDRAWN",
    );
  }

  const claims = await verifyMandateFromUrl(token, {
    audience: options.audience,
    jwksUri: preTrust.issuer.jwksUri,
    toleranceSeconds: options.toleranceSeconds,
    now: options.now,
  });

  const trust = decideTrust(claims.iss, claims.scopes, registry.issuers);
  if (!trust.trusted) {
    // Signature valid, issuer active — but the mandate grants beyond the
    // issuer's registry entry. Overreach poisons the whole mandate.
    throw new RegistryError(
      `issuer ${claims.iss} exceeded its registered scopes (${trust.scope ?? "?"})`,
      "ISSUER_SCOPE_EXCEEDED",
      trust.scope,
    );
  }

  return { claims, issuer: trust.issuer };
}

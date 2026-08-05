/**
 * Hosted network verification — same rules as the SDK's verifyMandateWithRegistry.
 * Resolves iss → trust registry → issuer JWKS → signature → scope grant.
 *
 * Local Zakai-issued tokens use env signing keys (JWKS URI may point at prod).
 * Delegated issuers always fetch their registered JWKS.
 */

import { decodeJwt, type JWK } from "jose";
import {
  verifyMandate,
  publicJwkFor,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
  type MandateClaims,
  type VerifyOptions,
} from "./mandate";
import {
  ISSUERS,
  decideTrust,
  findIssuer,
  type RegisteredIssuer,
} from "./trustRegistry";

export class RegistryVerifyError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UNKNOWN_ISSUER"
      | "ISSUER_SUSPENDED"
      | "ISSUER_WITHDRAWN"
      | "ISSUER_SCOPE_EXCEEDED"
      | "JWKS_UNAVAILABLE"
      | "JWKS_MALFORMED",
    readonly scope?: string,
  ) {
    super(message);
    this.name = "RegistryVerifyError";
  }
}

/** Map this deployment's MANDATE_ISSUER onto the primary registry row when needed. */
export async function resolveRegisteredIssuer(iss: string): Promise<RegisteredIssuer | undefined> {
  const normalized = iss.replace(/\/+$/, "");
  const direct = (await findIssuer(iss)) ?? (await findIssuer(normalized));
  if (direct) return direct;

  const envIss = (process.env.MANDATE_ISSUER || "").replace(/\/+$/, "");
  if (envIss && normalized === envIss) {
    const primary = ISSUERS[0]!;
    return {
      ...primary,
      iss: envIss,
      jwksUri: `${envIss}/.well-known/zakai-jwks.json`,
      statusListUri: `${envIss}/api/mandate/revocations`,
    };
  }
  return undefined;
}

export async function fetchIssuerPublicJwks(jwksUri: string): Promise<JWK[]> {
  let res: Response;
  try {
    res = await fetch(jwksUri, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new RegistryVerifyError(
      `JWKS unreachable: ${err instanceof Error ? err.message : String(err)}`,
      "JWKS_UNAVAILABLE",
    );
  }
  if (!res.ok) {
    throw new RegistryVerifyError(`JWKS returned ${res.status}`, "JWKS_UNAVAILABLE");
  }
  const doc = (await res.json()) as { keys?: JWK[] };
  if (!Array.isArray(doc.keys) || doc.keys.length === 0) {
    throw new RegistryVerifyError("JWKS document has no keys", "JWKS_MALFORMED");
  }
  return doc.keys;
}

async function publicJwksForIssuer(issuer: RegisteredIssuer): Promise<JWK[]> {
  const primaryIss = ISSUERS[0]!.iss.replace(/\/+$/, "");
  const envIss = (process.env.MANDATE_ISSUER || "").replace(/\/+$/, "");
  const issuerIss = issuer.iss.replace(/\/+$/, "");
  const isLocalZakai =
    issuerIss === primaryIss || (Boolean(envIss) && issuerIss === envIss);

  if (isLocalZakai) {
    try {
      const key = loadSigningKeyFromEnv();
      return [await publicJwkFor(key)];
    } catch (err) {
      if (err instanceof MandateKeyUnavailableError) {
        // Fall through to published JWKS (offline / other processes).
      } else {
        throw err;
      }
    }
  }

  return fetchIssuerPublicJwks(issuer.jwksUri);
}

export async function verifyMandateWithTrustRegistry(
  token: string,
  options: Pick<VerifyOptions, "audience" | "toleranceSeconds" | "now">,
): Promise<{ claims: MandateClaims; issuer: RegisteredIssuer }> {
  let iss = "";
  try {
    iss = String(decodeJwt(token).iss ?? "");
  } catch {
    throw new MandateError("token is not a JWT", "MALFORMED");
  }

  const issuer = await resolveRegisteredIssuer(iss);
  if (!issuer) {
    throw new RegistryVerifyError(
      `issuer not in trust registry: ${iss || "(missing iss)"}`,
      "UNKNOWN_ISSUER",
    );
  }

  const preTrust = await decideTrust(issuer.iss, []);
  // Env-aliased issuer may not match findIssuer inside decideTrust — use row status.
  if (issuer.status === "sandbox" || issuer.status === "suspended") {
    throw new RegistryVerifyError(`issuer ${issuer.iss} is suspended`, "ISSUER_SUSPENDED");
  }
  if (issuer.status === "withdrawn") {
    throw new RegistryVerifyError(`issuer ${issuer.iss} is withdrawn`, "ISSUER_WITHDRAWN");
  }
  if (!preTrust.trusted && (await findIssuer(issuer.iss))) {
    if (preTrust.reason === "suspended") {
      throw new RegistryVerifyError(`issuer ${issuer.iss} is suspended`, "ISSUER_SUSPENDED");
    }
    if (preTrust.reason === "withdrawn") {
      throw new RegistryVerifyError(`issuer ${issuer.iss} is withdrawn`, "ISSUER_WITHDRAWN");
    }
  }

  const publicJwks = await publicJwksForIssuer(issuer);
  const claims = await verifyMandate(token, {
    audience: options.audience,
    publicJwks,
    toleranceSeconds: options.toleranceSeconds,
    now: options.now,
  });

  for (const scope of claims.scopes) {
    if (!issuer.allowedScopes.includes(scope)) {
      throw new RegistryVerifyError(
        `issuer ${claims.iss} exceeded its registered scopes (${scope})`,
        "ISSUER_SCOPE_EXCEEDED",
        scope,
      );
    }
  }

  return { claims, issuer };
}

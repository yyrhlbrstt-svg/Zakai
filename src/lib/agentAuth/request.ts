import { FORBIDDEN_SCOPES, isKnownScope } from "@/lib/mandate/scopes";

/**
 * The front door to Zakai's authority layer.
 *
 * WHAT IS MISSING WITHOUT IT
 *
 * This codebase already contains the hard half of an agent-authority
 * protocol: Ed25519 signing, a public JWKS, a closed scope set with
 * `FORBIDDEN_SCOPES` that can never move money outward, status-list
 * revocation any institution can poll, audience binding, a reference verifier
 * and conformance vectors. All of it works. None of it is reachable by anyone
 * outside this product, because there is no way for a third party to ask.
 *
 * The MCP server exposes four tools and the strongest of them returns a link.
 * So the protocol has no users, and infrastructure with no users is a
 * specification.
 *
 * WHAT THIS OPENS
 *
 * Any AI agent that wants to act for a person needs authority an institution
 * will honour. Today it has two options: ask the person for their bank
 * password, or have nothing. This is the third: the agent asks Zakai for a
 * named, scoped, time-limited authority; the *person* approves it here, in
 * words they can read; the agent receives a signed mandate it can present and
 * the person can revoke in one tap, everywhere, forever.
 *
 * That is the only shape in this building where "everyone goes through us" is
 * a mechanism rather than an ambition — not because we are in the way, but
 * because we are the only place the permission is safe to grant.
 *
 * WHY VALIDATION LIVES HERE, PURE AND SEPARATE
 *
 * Everything below decides what a stranger is allowed to ask a human to
 * approve. It touches no database and no network precisely so it can be
 * tested exhaustively, because the cost of being wrong is a person granting
 * authority they did not understand to somebody who should never have been
 * able to ask.
 */

/** How long a person has to answer before the request goes stale. */
export const REQUEST_TTL_MS = 15 * 60 * 1000;

/** How long an approved mandate lasts unless the agent asks for less. */
export const DEFAULT_GRANT_SECONDS = 30 * 24 * 3600;
export const MAX_GRANT_SECONDS = 180 * 24 * 3600;

/** No agent may request more than this in one go. */
export const MAX_SCOPES_PER_REQUEST = 8;

export interface AuthorizationAsk {
  scopes: readonly string[];
  redirectUri: string;
  /** Plain words shown to the person: why this agent wants it. */
  purpose: string;
  grantSeconds?: number;
}

export interface RegisteredAgent {
  slug: string;
  name: string;
  /** Exact-match allowlist. Never a prefix or a wildcard — see below. */
  redirectUris: readonly string[];
  status: string;
}

export type AskRejection =
  | "agent_not_approved"
  | "unknown_scope"
  | "forbidden_scope"
  | "no_scopes"
  | "too_many_scopes"
  | "redirect_not_registered"
  | "redirect_insecure"
  | "purpose_missing"
  | "grant_too_long";

export type AskCheck =
  | { ok: true; scopes: string[]; grantSeconds: number }
  | { ok: false; reason: AskRejection };

/**
 * Exact match, never a prefix.
 *
 * A prefix or wildcard match on a redirect target is the single most reliably
 * exploited weakness in every authorization protocol that has ever shipped
 * one: an attacker who can steer the redirect anywhere under a registered
 * origin steers the grant to themselves. The registration is a list of exact
 * strings, and this compares strings.
 */
function redirectRegistered(agent: RegisteredAgent, redirectUri: string): boolean {
  return agent.redirectUris.some((u) => u === redirectUri);
}

function redirectTransportOk(redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  // Localhost over http is how every integrator develops. Anything else in
  // clear text would hand the grant to whoever is on the network path.
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export function checkAuthorizationAsk(agent: RegisteredAgent, ask: AuthorizationAsk): AskCheck {
  if (agent.status !== "approved") return { ok: false, reason: "agent_not_approved" };

  if (!ask.purpose || ask.purpose.trim().length < 8) {
    // A person cannot consent to "misc". If an agent cannot say what it wants
    // the authority for, in a sentence, they cannot have it.
    return { ok: false, reason: "purpose_missing" };
  }

  if (!redirectTransportOk(ask.redirectUri)) return { ok: false, reason: "redirect_insecure" };
  if (!redirectRegistered(agent, ask.redirectUri)) {
    return { ok: false, reason: "redirect_not_registered" };
  }

  const scopes = [...new Set(ask.scopes.map((s) => s.trim()).filter(Boolean))];
  if (scopes.length === 0) return { ok: false, reason: "no_scopes" };
  if (scopes.length > MAX_SCOPES_PER_REQUEST) return { ok: false, reason: "too_many_scopes" };

  for (const scope of scopes) {
    /**
     * Forbidden is checked before unknown, deliberately.
     *
     * `payment:transfer` is not in `SCOPES`, so an "unknown scope" answer
     * would be technically true and would tell an integrator to go and get it
     * added. The honest answer is that this protocol will never move money
     * outward on anyone's behalf, and that is a property of the design rather
     * than a gap in a list.
     */
    if (FORBIDDEN_SCOPES.includes(scope)) return { ok: false, reason: "forbidden_scope" };
    if (!isKnownScope(scope)) return { ok: false, reason: "unknown_scope" };
  }

  const grantSeconds = ask.grantSeconds ?? DEFAULT_GRANT_SECONDS;
  if (!Number.isInteger(grantSeconds) || grantSeconds < 60 || grantSeconds > MAX_GRANT_SECONDS) {
    return { ok: false, reason: "grant_too_long" };
  }

  return { ok: true, scopes, grantSeconds };
}

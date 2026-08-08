import { SCOPES, FORBIDDEN_SCOPES } from "./scopes";

/**
 * What is this agent allowed to do, in a sentence a person can act on.
 *
 * THE GAP THIS CLOSES
 *
 * /authority already lets someone revoke an authorisation, and revoke all of
 * them at once. What it never showed was what any of them permitted. So the
 * page offered a decision — keep this or cancel it — while withholding the
 * only fact the decision depends on.
 *
 * The scope catalogue has carried a plain-language `summary` and a
 * `perActConfirmation` flag from the beginning. Neither has ever reached a
 * user. A mandate whose holder cannot see what it grants is, from that
 * person's side, indistinguishable from no mandate at all — the cryptography
 * is excellent and entirely invisible, which is the worst place for trust to
 * live.
 *
 * WHAT IT REFUSES TO DO
 *
 * It never invents a description. An unrecognised scope is reported as
 * unrecognised, loudly, rather than being prettified into something
 * reassuring — an authority nobody can explain is exactly the one a person
 * should be told about, not the one to paper over.
 */

export type ScopeTier = "read" | "act" | "unknown";

export interface ExplainedScope {
  scope: string;
  tier: ScopeTier;
  /** Plain-language description, or null when the scope is not in the catalogue. */
  summary: string | null;
  /** True when this scope requires the person to confirm each individual act. */
  needsConfirmation: boolean;
  /** True when the protocol forbids this outright — should never appear. */
  forbidden: boolean;
  /** False when the scope is not in the catalogue at all. */
  recognised: boolean;
}

export interface AuthoritySummary {
  scopes: ExplainedScope[];
  /** Anything the agent can do without asking again. The headline risk. */
  silentActions: ExplainedScope[];
  /** Present only if something is wrong: unknown or forbidden scopes. */
  problems: ExplainedScope[];
  /** True when this authority only ever reads and never acts. */
  readOnly: boolean;
}

export function explainScope(scope: string): ExplainedScope {
  const clean = scope.trim();
  const def = SCOPES.find((s) => s.scope === clean);

  if (!def) {
    return {
      scope: clean,
      tier: "unknown",
      summary: null,
      // An unrecognised scope is treated as the most dangerous shape it could
      // be, not the least. Guessing downwards here would understate a real
      // grant to the one person entitled to understand it.
      needsConfirmation: true,
      forbidden: (FORBIDDEN_SCOPES as readonly string[]).includes(clean),
      recognised: false,
    };
  }

  return {
    scope: def.scope,
    tier: def.tier === "read" ? "read" : "act",
    summary: def.summary,
    needsConfirmation: def.perActConfirmation,
    forbidden: false,
    recognised: true,
  };
}

export function explainAuthority(scopes: readonly string[]): AuthoritySummary {
  const explained = scopes.map(explainScope);

  return {
    scopes: explained,
    // What the agent can do without coming back to ask. This is the sentence
    // that decides whether someone revokes, so it is computed rather than left
    // for a reader to work out from a list.
    silentActions: explained.filter(
      (s) => s.recognised && s.tier === "act" && !s.needsConfirmation,
    ),
    problems: explained.filter((s) => !s.recognised || s.forbidden),
    readOnly: explained.length > 0 && explained.every((s) => s.recognised && s.tier === "read"),
  };
}

/**
 * Read the scope list out of a mandate's payload without verifying it.
 *
 * Explicitly NOT verification — the caller is displaying an authority the
 * person already holds, not deciding whether to honour one. Naming that here
 * so nobody later mistakes this for a trust decision: never use it to grant
 * anything.
 */
export function scopesFromMandatePayload(jws: string): string[] {
  try {
    const payload = jws.split(".")[1];
    if (!payload) return [];
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { scopes?: unknown };
    return Array.isArray(json.scopes) ? json.scopes.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

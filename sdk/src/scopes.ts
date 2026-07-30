/**
 * The capability vocabulary — ported verbatim from the Zakai production app
 * (src/lib/mandate/scopes.ts). Kept byte-identical in logic on purpose: this
 * SDK exists so a verifier's code and Zakai's own code can never silently
 * disagree about what a scope means.
 *
 * A mandate can never move the principal's money outward. There is no
 * `payment:initiate`, and `FORBIDDEN_SCOPES` exists so that the absence is
 * enforced rather than merely intended.
 */

export type RiskTier = "read" | "correspond" | "commercial" | "inbound_funds";

export interface ScopeDef {
  scope: string;
  tier: RiskTier;
  /** Whether the principal must confirm each individual exercise. */
  perActConfirmation: boolean;
  /** Plain-language description, shown verbatim in a consent screen. */
  summary: string;
}

export const SCOPES: readonly ScopeDef[] = [
  { scope: "read:accounts", tier: "read", perActConfirmation: false, summary: "See the list of your accounts and their balances." },
  { scope: "read:transactions", tier: "read", perActConfirmation: false, summary: "See your transaction history, to find overcharges and forgotten subscriptions." },
  { scope: "read:credit", tier: "read", perActConfirmation: false, summary: "See your credit file and score, to check it for errors." },
  { scope: "read:bills", tier: "read", perActConfirmation: false, summary: "See invoices and statements issued to you by a provider." },
  { scope: "read:policies", tier: "read", perActConfirmation: false, summary: "See your insurance and pension holdings, to find duplicate cover and excess fees." },
  { scope: "read:payroll", tier: "read", perActConfirmation: false, summary: "See your payslips, to check that what you are owed was actually paid." },
  { scope: "read:tax", tier: "read", perActConfirmation: false, summary: "See your tax assessments and filings, to find refunds you are owed." },

  { scope: "claim:submit", tier: "correspond", perActConfirmation: true, summary: "File a claim or application in your name." },
  { scope: "claim:appeal", tier: "correspond", perActConfirmation: true, summary: "Appeal a rejection or ask for a reasoned decision." },
  { scope: "dispute:charge", tier: "correspond", perActConfirmation: true, summary: "Dispute a specific charge you were billed." },
  { scope: "request:records", tier: "correspond", perActConfirmation: false, summary: "Request your own records and statements from an institution." },

  { scope: "negotiate:tariff", tier: "commercial", perActConfirmation: true, summary: "Negotiate the price of a contract you already have." },
  { scope: "contract:cancel", tier: "commercial", perActConfirmation: true, summary: "Cancel a subscription or service on your instruction." },
  { scope: "contract:switch", tier: "commercial", perActConfirmation: true, summary: "Move you to a different provider, once you have approved the offer." },

  { scope: "settle:receive", tier: "inbound_funds", perActConfirmation: true, summary: "Receive a refund or settlement owed to you, and pass it to your account." },
];

/**
 * Scopes that must never exist, enforced rather than assumed. Keeping them
 * impossible — not merely unimplemented — is what lets a regulated
 * counterparty accept a mandate without underwriting the issuer's own
 * security posture.
 */
export const FORBIDDEN_SCOPES: readonly string[] = [
  "payment:initiate",
  "payment:transfer",
  "credit:borrow",
  "account:open",
  "account:close",
  "investment:trade",
];

const BY_NAME = new Map(SCOPES.map((s) => [s.scope, s]));

export function scopeDef(scope: string): ScopeDef | undefined {
  return BY_NAME.get(scope);
}

export function isKnownScope(scope: string): boolean {
  return BY_NAME.has(scope);
}

export function requiresPerActConfirmation(scope: string): boolean {
  return BY_NAME.get(scope)?.perActConfirmation ?? true;
}

/** Highest risk tier present in a set of scopes; used to pick the consent UI. */
export function highestTier(scopes: readonly string[]): RiskTier {
  const order: RiskTier[] = ["read", "correspond", "commercial", "inbound_funds"];
  let best = 0;
  for (const s of scopes) {
    const def = BY_NAME.get(s);
    if (def) best = Math.max(best, order.indexOf(def.tier));
  }
  return order[best];
}

/**
 * Validate a requested scope set. Returns the problems, empty when acceptable.
 * Unknown scopes are rejected rather than ignored: silently dropping a scope
 * an institution asked for would let the two sides disagree about what was
 * granted, which is the one failure this whole design exists to prevent.
 */
export function validateScopes(scopes: readonly string[]): string[] {
  const problems: string[] = [];
  if (scopes.length === 0) problems.push("a mandate must grant at least one scope");
  const seen = new Set<string>();
  for (const s of scopes) {
    if (seen.has(s)) problems.push(`duplicate scope "${s}"`);
    seen.add(s);
    if (FORBIDDEN_SCOPES.includes(s)) {
      problems.push(`scope "${s}" can never be granted: a mandate must not move money outward`);
    } else if (!BY_NAME.has(s)) {
      problems.push(`unknown scope "${s}"`);
    }
  }
  return problems;
}

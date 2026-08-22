/**
 * The capability taxonomy — the verbs of consumer agency.
 *
 * This file is the most strategically loaded one in the codebase, so it is
 * worth being explicit about why it exists in this shape.
 *
 * WHY NOT "ACCESS TO YOUR DATA"
 *
 * Reading someone's accounts is a commodity. Plaid, TrueLayer, Tink, the PSD2
 * APIs in Europe and the Financial Information Service licence regime in
 * Israel all do it, and any of them can be swapped for another in a sprint.
 * Building the moat on data access means competing with infrastructure that is
 * already free at the margin.
 *
 * What nobody has built is the other side of the pipe: **the standard by which
 * an institution verifies that a consumer's agent genuinely holds authority,
 * for exactly which acts, until when — and settles against it machine to
 * machine.** Today that verification is a human at a call centre reading a
 * scanned power of attorney. That is why a bank will integrate against this:
 * not to give Zakai access, but to stop paying people to read PDFs.
 *
 * THE DESIGN CONSTRAINT THAT MAKES IT ADOPTABLE
 *
 * A mandate can never move the principal's money outward. There is no
 * `payment:initiate`, and `FORBIDDEN_SCOPES` exists so that the absence is
 * enforced rather than merely intended. Money only ever flows *toward* the
 * consumer.
 *
 * This is not caution for its own sake. An agent that cannot spend is a
 * categorically different risk object from one that can: it cannot be used to
 * drain an account, so the worst case of a compromised mandate is unwanted
 * correspondence rather than theft. That categorical limit is the entire
 * reason a regulated institution can accept these mandates at scale, and it is
 * worth far more than the features it gives up.
 *
 * Scopes are also the unit of consent shown to the user, the unit an
 * institution checks, and the unit the audit log records. One vocabulary for
 * all three, so what the user agreed to and what the bank enforced cannot
 * drift apart.
 */

export type RiskTier = "read" | "correspond" | "commercial" | "inbound_funds";

export interface ScopeDef {
  scope: string;
  tier: RiskTier;
  /**
   * Whether the principal must confirm each individual exercise, not merely
   * grant the scope once. Granting "may cancel my subscriptions" is not the
   * same as agreeing to cancel *this* one.
   */
  perActConfirmation: boolean;
  /** Plain-language description, shown verbatim in the consent screen. */
  summary: string;
}

export const SCOPES: readonly ScopeDef[] = [
  // ---- Read -----------------------------------------------------------------
  {
    scope: "read:accounts",
    tier: "read",
    perActConfirmation: false,
    summary: "See the list of your accounts and their balances.",
  },
  {
    scope: "read:transactions",
    tier: "read",
    perActConfirmation: false,
    summary: "See your transaction history, to find overcharges and forgotten subscriptions.",
  },
  /**
   * The bank feed, and why it is its own scope rather than the two above.
   *
   * `read:accounts` and `read:transactions` describe WHAT is read.
   * This describes HOW: through a third company, licensed under Israel's
   * Financial Information Service Law, 2021, which holds the connection to
   * the bank and sees the data on the way past.
   *
   * A person agreeing to "Zakai may see my transactions" has not thereby
   * agreed to "a company I have never heard of holds a standing connection to
   * my bank account". Those are different facts, one of them is the one people
   * actually care about, and folding the second into the first would be
   * burying the material term inside the innocuous one. Scopes are the unit of
   * consent in this protocol precisely so that cannot happen.
   *
   * `perActConfirmation` is false because a feed is by nature standing rather
   * than per-act — which is exactly why the consent screen has to state that
   * it is revocable at any time, and why revocation must actually sever it.
   */
  {
    scope: "read:bank_feed",
    tier: "read",
    perActConfirmation: false,
    summary:
      "Read-only access to your bank balance and transaction history, through a " +
      "licensed financial-information provider. Revocable at any time. Never used " +
      "to move money.",
  },
  {
    scope: "read:credit",
    tier: "read",
    perActConfirmation: false,
    summary: "See your credit file and score, to check it for errors.",
  },
  {
    scope: "read:bills",
    tier: "read",
    perActConfirmation: false,
    summary: "See invoices and statements issued to you by a provider.",
  },
  {
    scope: "read:policies",
    tier: "read",
    perActConfirmation: false,
    summary: "See your insurance and pension holdings, to find duplicate cover and excess fees.",
  },
  {
    scope: "read:payroll",
    tier: "read",
    perActConfirmation: false,
    summary: "See your payslips, to check that what you are owed was actually paid.",
  },
  {
    scope: "read:tax",
    tier: "read",
    perActConfirmation: false,
    summary: "See your tax assessments and filings, to find refunds you are owed.",
  },

  // ---- Correspondence -------------------------------------------------------
  {
    scope: "claim:submit",
    tier: "correspond",
    perActConfirmation: true,
    summary: "File a claim or application in your name.",
  },
  {
    scope: "claim:appeal",
    tier: "correspond",
    perActConfirmation: true,
    summary: "Appeal a rejection or ask for a reasoned decision.",
  },
  {
    scope: "dispute:charge",
    tier: "correspond",
    perActConfirmation: true,
    summary: "Dispute a specific charge you were billed.",
  },
  {
    scope: "request:records",
    tier: "correspond",
    perActConfirmation: false,
    summary: "Request your own records and statements from an institution.",
  },

  // ---- Commercial changes ---------------------------------------------------
  {
    scope: "negotiate:tariff",
    tier: "commercial",
    perActConfirmation: true,
    summary: "Negotiate the price of a contract you already have.",
  },
  {
    scope: "contract:cancel",
    tier: "commercial",
    perActConfirmation: true,
    summary: "Cancel a subscription or service on your instruction.",
  },
  {
    scope: "contract:switch",
    tier: "commercial",
    perActConfirmation: true,
    summary: "Move you to a different provider, once you have approved the offer.",
  },

  // ---- Funds, inbound only --------------------------------------------------
  {
    scope: "settle:receive",
    tier: "inbound_funds",
    perActConfirmation: true,
    summary: "Receive a refund or settlement owed to you, and pass it to your account.",
  },
];

/**
 * Scopes that must never exist, enforced rather than assumed.
 *
 * `payment:initiate` and friends are the difference between an agent that can
 * be abused into unwanted letters and one that can be abused into an emptied
 * account. Keeping them impossible — not merely unimplemented — is what lets a
 * regulated counterparty accept a mandate without underwriting Zakai's own
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

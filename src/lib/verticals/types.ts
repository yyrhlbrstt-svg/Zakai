/**
 * The generic full-service engine, expressed as configuration.
 *
 * Zakai's one full-service vertical (telecom, Israel) proved the six-stage
 * loop: input → eligibility → drafting → authorization → execution → verified
 * payment. To turn other tools into full services — and to add countries as
 * configuration rather than rewrites — that loop is generalised here, and each
 * (vertical × country) becomes a self-contained **rule pack**.
 *
 * The core flow (case creation, authorization, sending, fee) never hard-codes a
 * vertical or a country: it reads the active rule pack. Adding "bank fees in the
 * UK" must be a new pack file, never an edit to the core. If it isn't, the
 * abstraction is wrong and must be fixed before adding more.
 */

/** ISO-3166 alpha-2. Israel today; the type is open for expansion. */
export type CountryCode = "IL" | "UK" | "US" | "DE";

/** How a vertical's outreach reaches the counterparty (stage 5, execution). */
export type ServiceChannel = "email" | "web_form" | "gov_portal" | "phone";

/**
 * How we prove the money actually came back BEFORE charging a fee (stage 6).
 * This is the most error-prone stage and is deliberately per-vertical — never
 * assumed uniform.
 */
export type VerificationMethod =
  | "before_after_bill" // telecom / electricity: the next bill shows a lower amount
  | "statement_line_gone" // bank fees / subscriptions: the charge disappears
  | "decision_letter" // arnona / benefits: an authority's written decision
  | "transfer_confirmation" // a refund actually lands
  | "manual"; // human-reviewed evidence

/**
 * Service maturity. ONLY `full` verticals act on the user's behalf and charge a
 * success fee. `assisted` drafts + guides but the user sends; `calculator` is a
 * check only. This is the honest, enforceable gate the site promises ("more
 * categories are added only after the current path proves itself").
 */
export type ServiceLevel = "full" | "assisted" | "calculator";

export interface VerificationSpec {
  method: VerificationMethod;
  /** Plain description of what proves the money came back (shown to the user). */
  proofDescription: string;
}

export interface VerticalRulePack {
  /** Vertical key, e.g. "telecom", "bank-fees". */
  key: string;
  /** Market this pack governs. */
  country: CountryCode;
  /** Human label (Hebrew for IL packs). */
  label: string;
  /** Maturity — only "full" packs may act + charge. */
  level: ServiceLevel;
  /**
   * Vertical-specific success-fee override in basis points. `null` means "use
   * the user's plan rate" (telecom: the subscription buys the fee down). A
   * number pins the rate for this vertical regardless of plan.
   */
  feeRateBps: number | null;
  /** Stage 5 — how outreach is delivered. */
  channel: ServiceChannel;
  /** Stage 6 — how a real saving is proven before any charge. */
  verification: VerificationSpec;
  /**
   * The legal gate: true if going full-service here is close to regulated
   * representation/advice (e.g. arnona appeals) and needs a lawyer's sign-off
   * before it may be set to `level: "full"`.
   */
  regulated: boolean;
  /** Counterparties in this market (provider keys / authority names). */
  counterparties: readonly string[];
}

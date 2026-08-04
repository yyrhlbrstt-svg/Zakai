/**
 * Keep StrategyOutcome keys aligned with Case.vertical / provider keys.
 * Underscore aliases and non-catalog variant ids fragment Thompson buckets.
 */

import { variantById, VARIANTS } from "./variants";

/**
 * De-identified settle signal when Case.strategyVariant was never latched
 * (stance no-op / legacy cases). Included in cohort win-rate / fairness /
 * EV ranking; excluded from Thompson `chooseStance` via isCatalogVariantId.
 * Safe for client + server (no server-only import).
 */
export const UNATTRIBUTED_VARIANT_ID = "baseline_unattributed";

const VERTICAL_ALIASES: Record<string, string> = {
  transport_fine: "transport-fine",
  late_payment: "late-payment",
  bank_fees: "bank-fees",
  refund_chase: "refund-chase",
  car_insurance_refund: "car-insurance-refund",
  duplicate_insurance: "duplicate-insurance",
};

/** Map self-report / legacy keys onto Case.vertical keys. */
export function normalizeOutcomeVertical(raw: string): string {
  const v = raw.trim().toLowerCase();
  return VERTICAL_ALIASES[v] ?? v;
}

/** Only the six measurable stances accumulate evidence. */
export function normalizeOutcomeVariantId(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  if (variantById(id)) return id;
  // Common letter-path aliases → nearest measurable stance
  if (id === "standard" || id === "default") return "firm_statutory";
  return null;
}

export function isCatalogVariantId(id: string): boolean {
  return VARIANTS.some((v) => v.id === id);
}

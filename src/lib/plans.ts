/**
 * Product tiers — the single source of truth for what each plan grants.
 *
 * Pricing rationale (see GROWTH.md for the full research):
 *  - RiseUp, the Israeli willingness-to-pay benchmark for a money app, charges
 *    ~₪45–55/mo. Zakai Pro at ₪14.90 undercuts it decisively while doing
 *    something RiseUp doesn't: acting on your behalf.
 *  - Rocket Money (US) charges a 35–60% success fee on first-year savings.
 *    Zakai Free stays at 18% of the documented monthly saving — dramatically
 *    cheaper — and the paid tiers cut it further (Pro 9%, Max 0%): the
 *    subscription buys down the fee, so heavy savers upgrade themselves.
 *
 * Billing collection (PSP) is a later stage; the entitlements are enforced in
 * code NOW so tiers are real product behavior, not marketing copy.
 */

export type PlanId = "FREE" | "PRO" | "MAX";

export interface PlanConfig {
  id: PlanId;
  /** Monthly price in agorot. 0 = free. (Charged once billing goes live.) */
  priceAgorot: number;
  /** Success-fee rate in basis points applied to documented savings. */
  feeRateBps: number;
  /** Max concurrently open (non-settled) cases; null = unlimited. */
  maxActiveCases: number | null;
  /** Full recurring-charges scan results (Free sees a top-3 preview). */
  fullScan: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  FREE: { id: "FREE", priceAgorot: 0, feeRateBps: 1800, maxActiveCases: 1, fullScan: false },
  PRO: { id: "PRO", priceAgorot: 1490, feeRateBps: 900, maxActiveCases: 5, fullScan: true },
  MAX: { id: "MAX", priceAgorot: 2990, feeRateBps: 0, maxActiveCases: null, fullScan: true },
};

export const PLAN_IDS: PlanId[] = ["FREE", "PRO", "MAX"];

export function isPlanId(v: string): v is PlanId {
  return v === "FREE" || v === "PRO" || v === "MAX";
}

export function planConfig(plan: string | null | undefined): PlanConfig {
  return isPlanId(plan ?? "") ? PLANS[plan as PlanId] : PLANS.FREE;
}

/** Case statuses that count against the active-case allowance. */
export const ACTIVE_CASE_STATUSES = ["ANALYZED", "APPROVED", "VERIFIED", "SENT"] as const;

/** May this plan open another case, given how many are currently active? */
export function canOpenCase(plan: string | null | undefined, activeCount: number): boolean {
  const limit = planConfig(plan).maxActiveCases;
  return limit === null || activeCount < limit;
}

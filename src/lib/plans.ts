/**
 * Product tiers — the single source of truth for what each plan grants.
 *
 * Pricing rationale (see GROWTH.md for the full research):
 *  - RiseUp, the Israeli willingness-to-pay benchmark for a money app, charges
 *    ~₪45–55/mo. Zakai Pro at ₪19.90 undercuts it decisively while doing
 *    something RiseUp doesn't: acting on your behalf.
 *  - Rocket Money (US) charges a 35–60% success fee on first-year savings.
 *    Zakai Free stays at 18% of the documented monthly saving — dramatically
 *    cheaper — and the paid tiers cut it further (Pro 9%, Max 0%): the
 *    subscription buys down the fee, so heavy savers upgrade themselves.
 *  - Max was priced at ₪49.90 when it covered fewer full-service verticals.
 *    The catalog has since grown to 10 (telecom, bank fees, subscriptions,
 *    airlines, refunds, parking, transport fines, electricity, late-payment,
 *    deposits), each at 0% fee under Max regardless of the saving's size —
 *    so a heavy user recovering a large sum now costs the company real
 *    forgone fee revenue the original price didn't account for. Raised to
 *    ₪59.90, still at the top of RiseUp's ₪45–55 band rather than above it —
 *    Max's job is the trust anchor ("all your savings, no cut"), not the
 *    main revenue line; Pro is expected to carry most of that.
 *  - Business (₪200/mo) is priced for a different budget line entirely — a
 *    small business or self-employed person's own accounting/bookkeeping
 *    spend, not a personal finance app. Same "no cut" trust anchor as Max
 *    (0% fee): the case FOR paying ₪200/mo has to be the tools themselves
 *    (unlimited receipt scans, bulk vendor sweeps, the monthly deductible-
 *    expense digest to the accountant) actually saving more than that in
 *    duplicate charges and unclaimed VAT-eligible spend, not a fee discount
 *    nobody on a business tier is paying anyway.
 *
 * Billing collection (PSP) is a later stage; the entitlements are enforced in
 * code NOW so tiers are real product behavior, not marketing copy.
 */

export type PlanId = "FREE" | "PRO" | "MAX" | "BUSINESS";

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
  PRO: { id: "PRO", priceAgorot: 1990, feeRateBps: 900, maxActiveCases: 5, fullScan: true },
  MAX: { id: "MAX", priceAgorot: 5990, feeRateBps: 0, maxActiveCases: null, fullScan: true },
  BUSINESS: {
    id: "BUSINESS",
    priceAgorot: 20000,
    feeRateBps: 0,
    maxActiveCases: null,
    fullScan: true,
  },
};

export const PLAN_IDS: PlanId[] = ["FREE", "PRO", "MAX", "BUSINESS"];

export function isPlanId(v: string): v is PlanId {
  return v === "FREE" || v === "PRO" || v === "MAX" || v === "BUSINESS";
}

export function planConfig(plan: string | null | undefined): PlanConfig {
  return isPlanId(plan ?? "") ? PLANS[plan as PlanId] : PLANS.FREE;
}

/**
 * True when switching from `current` to `next` moves to a higher-priced tier
 * and therefore must be PAID before it takes effect. Downgrades and same-tier
 * switches are free and immediate. This is the guard that stops the account
 * endpoint from handing out a paid plan (and its lower success-fee / higher
 * limits) for nothing — without it, subscription revenue is impossible.
 */
export function upgradeRequiresPayment(
  current: string | null | undefined,
  next: PlanId,
): boolean {
  return PLANS[next].priceAgorot > planConfig(current).priceAgorot;
}

/**
 * The documented monthly saving at which Pro's lower fee rate (9% vs Free's
 * 18%) pays for itself — the ~₪220/mo breakeven point GROWTH.md's pricing
 * section derives by hand. Computed from PLANS so it can never drift out of
 * sync with the actual price/rate numbers above.
 */
export function proBreakevenSavingAgorot(): number {
  const rateDeltaBps = PLANS.FREE.feeRateBps - PLANS.PRO.feeRateBps;
  if (rateDeltaBps <= 0) return Infinity;
  return Math.round((PLANS.PRO.priceAgorot / rateDeltaBps) * 10000);
}

/**
 * Documented monthly saving at which Max's 0% fee pays for the subscription vs
 * staying on Free (18%) or Pro (9%).
 */
export function maxBreakevenSavingAgorot(fromPlan: "FREE" | "PRO" = "FREE"): number {
  const rateDeltaBps = fromPlan === "FREE" ? PLANS.FREE.feeRateBps : PLANS.PRO.feeRateBps;
  if (rateDeltaBps <= 0) return Infinity;
  return Math.round((PLANS.MAX.priceAgorot / rateDeltaBps) * 10000);
}

/** Case statuses that count against the active-case allowance. */
export const ACTIVE_CASE_STATUSES = ["ANALYZED", "APPROVED", "VERIFIED", "SENT"] as const;

/** May this plan open another case, given how many are currently active? */
export function canOpenCase(plan: string | null | undefined, activeCount: number): boolean {
  const limit = planConfig(plan).maxActiveCases;
  return limit === null || activeCount < limit;
}

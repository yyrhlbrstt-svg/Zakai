/**
 * Electricity plan comparison — Zakai's second consumer vertical.
 *
 * Since July 2024 every Israeli household can switch electricity SUPPLIER
 * (billing stays physical with IEC; switching is digital via Noga). Private
 * suppliers offer either a flat discount (works with any meter) or deep
 * hourly-window discounts (requires a smart meter).
 *
 * This module is a deterministic comparison calculator: given the household's
 * monthly bill and a coarse usage profile, it ranks plans by estimated
 * saving. It does NOT perform the switch (Noga API integration is in the
 * BACKLOG) and the rates table is a dated snapshot the user must verify with
 * the supplier — stated in the UI.
 *
 * All money in agorot. Estimates are floored to whole agorot.
 */

export type PlanWindow = "day" | "night" | "evening" | "night_all_week" | "flat";

export interface ElectricityPlan {
  id: string;
  /** i18n key under electricity.providers.* */
  providerKey: string;
  /** i18n key under electricity.planNames.* */
  nameKey: string;
  discountPct: number; // e.g. 21 for 21%
  window: PlanWindow;
  requiresSmartMeter: boolean;
}

/** Rates snapshot — July 2026, from public supplier price lists. Verify before switching. */
export const ELECTRICITY_PLANS: ElectricityPlan[] = [
  { id: "electra-night", providerKey: "electra", nameKey: "nightPlus", discountPct: 21, window: "night", requiresSmartMeter: true },
  { id: "electra-day", providerKey: "electra", nameKey: "day", discountPct: 21, window: "day", requiresSmartMeter: true },
  { id: "cellcom-day", providerKey: "cellcomEnergy", nameKey: "daySaver", discountPct: 20, window: "day", requiresSmartMeter: true },
  { id: "bezeq-night", providerKey: "bezeqEnergy", nameKey: "night", discountPct: 20, window: "night", requiresSmartMeter: true },
  { id: "partner-night", providerKey: "partnerPower", nameKey: "nightOwls", discountPct: 20, window: "night", requiresSmartMeter: true },
  { id: "cellcom-family", providerKey: "cellcomEnergy", nameKey: "familyEvening", discountPct: 18, window: "evening", requiresSmartMeter: true },
  { id: "cellcom-night-all", providerKey: "cellcomEnergy", nameKey: "nightAllWeek", discountPct: 15, window: "night_all_week", requiresSmartMeter: true },
  { id: "electra-flat", providerKey: "electra", nameKey: "flat", discountPct: 6.5, window: "flat", requiresSmartMeter: false },
  { id: "bezeq-flat", providerKey: "bezeqEnergy", nameKey: "flat", discountPct: 6, window: "flat", requiresSmartMeter: false },
  { id: "partner-flat", providerKey: "partnerPower", nameKey: "flatTiered", discountPct: 5, window: "flat", requiresSmartMeter: false },
];

export type UsageProfile = "day_home" | "evening_family" | "ev_night" | "spread";

/**
 * Estimated share of a household's consumption falling inside each discount
 * window, per coarse profile. Deliberately conservative round numbers — the
 * UI presents results as estimates, and the profile question is one tap.
 */
const WINDOW_SHARE: Record<UsageProfile, Record<Exclude<PlanWindow, "flat">, number>> = {
  //            day(07-17) night(23-07) evening(20-02) night_all_week
  day_home: { day: 0.5, night: 0.2, evening: 0.2, night_all_week: 0.2 },
  evening_family: { day: 0.25, night: 0.3, evening: 0.45, night_all_week: 0.3 },
  ev_night: { day: 0.2, night: 0.55, evening: 0.35, night_all_week: 0.55 },
  spread: { day: 0.35, night: 0.3, evening: 0.3, night_all_week: 0.3 },
};

/** Sun-Thu windows only apply ~5 of 7 days; all-week/flat apply every day. */
const WEEKDAY_FACTOR: Record<PlanWindow, number> = {
  day: 5 / 7,
  night: 5 / 7,
  evening: 5 / 7,
  night_all_week: 1,
  flat: 1,
};

export interface PlanEstimate {
  plan: ElectricityPlan;
  monthlySavingAgorot: number;
  yearlySavingAgorot: number;
  /** Effective % off the whole bill (after window share + weekday factors). */
  effectivePct: number;
}

/**
 * Rank plans by estimated monthly saving for a bill and profile.
 * Households without a smart meter only see flat plans (the real constraint).
 */
export function estimatePlans(
  monthlyBillAgorot: number,
  profile: UsageProfile,
  hasSmartMeter: boolean,
): PlanEstimate[] {
  const bill = Math.max(0, Math.trunc(monthlyBillAgorot));
  return ELECTRICITY_PLANS.filter((p) => hasSmartMeter || !p.requiresSmartMeter)
    .map((plan) => {
      const share = plan.window === "flat" ? 1 : WINDOW_SHARE[profile][plan.window];
      const effective = (plan.discountPct / 100) * share * WEEKDAY_FACTOR[plan.window];
      const monthly = Math.floor(bill * effective);
      return {
        plan,
        monthlySavingAgorot: monthly,
        yearlySavingAgorot: monthly * 12,
        effectivePct: Math.round(effective * 1000) / 10,
      };
    })
    .sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot);
}

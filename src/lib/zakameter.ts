/**
 * The Zakameter — Zakai's answer to "why come here at all?".
 *
 * One number, computed in ~30 seconds with no signup: how much money is
 * plausibly waiting for this household across every vertical Zakai covers.
 * Google can't answer it; a bank won't. Each line reuses the same tested
 * engines the product itself runs on, with deliberately conservative
 * assumptions (documented per line). Estimates, and labeled as such.
 *
 * All money in agorot; results are yearly.
 */

import { estimatePlans } from "./electricity";
import { COMPENSATION_AGOROT } from "./flightRights";
import { FEE_RATE_BPS } from "./fee";

export interface ZakameterInput {
  /** Monthly mobile bill (household total), agorot. */
  mobileMonthlyAgorot: number;
  /** Monthly electricity bill, agorot. */
  electricityMonthlyAgorot: number;
  /** Flights cancelled or 8h+ delayed in the last few years. */
  disruptedFlights: number;
  /** Subscriptions the household pays for but isn't sure it uses. */
  unusedSubscriptions: number;
}

export interface ZakameterResult {
  mobileYearlyAgorot: number;
  electricityYearlyAgorot: number;
  flightsAgorot: number;
  subscriptionsYearlyAgorot: number;
  totalAgorot: number;
}

/**
 * Mobile: Zakai's own recommendation engine targets ~18% off the current
 * bill (the same figure the product's template uses).
 */
const MOBILE_SAVING_RATE_BPS = FEE_RATE_BPS; // 1800 = 18%

/** A typical unused digital subscription runs ~₪35/month — conservative. */
const SUB_WASTE_MONTHLY_AGOROT = 3_500;

export function computeZakameter(input: ZakameterInput): ZakameterResult {
  const clamp = (n: number) => Math.max(0, Math.trunc(n));

  const mobileYearlyAgorot = Math.round(
    (clamp(input.mobileMonthlyAgorot) * MOBILE_SAVING_RATE_BPS * 12) / 10_000,
  );

  // Electricity: best FLAT plan (spread profile, no smart meter assumed) —
  // the floor every household can reach with zero hardware. Same engine as
  // the /electricity comparison, which then shows the bigger hourly savings.
  const elecBill = clamp(input.electricityMonthlyAgorot);
  const plans = elecBill > 0 ? estimatePlans(elecBill, "spread", false) : [];
  const electricityYearlyAgorot = plans.length > 0 ? plans[0].yearlySavingAgorot : 0;

  // Flights: statutory compensation at the SHORT-distance tier per disrupted
  // flight — the lowest tier in the law, so the estimate under-promises.
  const flightsAgorot = clamp(input.disruptedFlights) * COMPENSATION_AGOROT.short;

  const subscriptionsYearlyAgorot =
    clamp(input.unusedSubscriptions) * SUB_WASTE_MONTHLY_AGOROT * 12;

  return {
    mobileYearlyAgorot,
    electricityYearlyAgorot,
    flightsAgorot,
    subscriptionsYearlyAgorot,
    totalAgorot:
      mobileYearlyAgorot + electricityYearlyAgorot + flightsAgorot + subscriptionsYearlyAgorot,
  };
}

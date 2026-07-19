/**
 * Maternity-allowance engine — "דמי לידה".
 *
 * Bituach Leumi pays maternity allowance based on the mother's average daily
 * wage in the 3 months before stopping work (= quarterly income / 90, which
 * equals monthly salary / 30), for a number of days set by the qualifying
 * period, capped by the maximum income liable for contributions.
 *
 * Verified July 2026:
 *  - Full: 105 days (15 weeks) — paid 10/14 or 15/22 qualifying months.
 *  - Partial: 56 days (8 weeks) — paid 6/14 qualifying months.
 *  - Daily cap = max monthly liable income (₪51,910, 2026) / 30 = ₪1,730.33.
 * Sources: btl.gov.il, Kol-Zchut, Malam Payroll.
 */

export const MATERNITY_DAILY_CAP_AGOROT = 173_033; // ₪1,730.33 (₪51,910 / 30)
export const MATERNITY_FULL_DAYS = 105;
export const MATERNITY_PARTIAL_DAYS = 56;

export type MaternityEligibility = "full" | "partial";

export interface MaternityInput {
  /** Gross monthly salary (the daily base is this / 30), in agorot. */
  monthlyAgorot: number;
  eligibility: MaternityEligibility;
}

export interface MaternityResult {
  dailyAgorot: number;
  days: number;
  totalAgorot: number;
  /** True when the daily wage exceeded the statutory cap (benefit is limited). */
  capped: boolean;
}

export function computeMaternity(input: MaternityInput): MaternityResult {
  const monthly = Math.max(0, input.monthlyAgorot);
  const dailyRaw = Math.round(monthly / 30); // (monthly × 3) / 90
  const capped = dailyRaw > MATERNITY_DAILY_CAP_AGOROT;
  const dailyAgorot = capped ? MATERNITY_DAILY_CAP_AGOROT : dailyRaw;
  const days = input.eligibility === "full" ? MATERNITY_FULL_DAYS : MATERNITY_PARTIAL_DAYS;

  return { dailyAgorot, days, totalAgorot: dailyAgorot * days, capped };
}

/**
 * Unemployment-benefit estimator — "דמי אבטלה".
 *
 * The real benefit is a regressive, capped function of the average daily wage
 * (tiers of 80% / 50% / 45% / 30% of the average wage in the economy, +20
 * points under age 28), which needs the economy's average-wage constant to
 * compute to the shekel. Rather than fake that precision, we return an honest
 * DAILY RANGE bounded by the top and bottom tier rates and the statutory cap,
 * plus the well-defined entitlement-days-by-age, and point to the official
 * Bituach Leumi calculator for the exact figure.
 *
 * Verified 2026: daily cap ₪550.76 (first 125 days), ₪367.17 after; the
 * average daily wage ≈ 6-month income / 150 (≈ monthly / 25).
 * Sources: btl.gov.il, Kol-Zchut.
 */

export const UNEMPLOYMENT_CAP_FIRST_AGOROT = 55_076; // ₪550.76/day, first 125 days
export const UNEMPLOYMENT_CAP_AFTER_AGOROT = 36_717; // ₪367.17/day, from day 126

/** Entitlement days by age (general case; dependents can add more). */
export function unemploymentDays(age: number): number {
  const a = Math.max(0, Math.floor(age));
  if (a < 25) return 50;
  if (a < 28) return 67;
  if (a < 35) return 100;
  if (a < 45) return 138;
  return 175;
}

export interface UnemploymentInput {
  /** Gross monthly salary (average of the last 6 months), in agorot. */
  monthlyAgorot: number;
  age: number;
}

export interface UnemploymentResult {
  dailyLowAgorot: number;
  dailyHighAgorot: number;
  days: number;
  /** First-period totals (capped at 125 days), a low–high range in agorot. */
  totalLowAgorot: number;
  totalHighAgorot: number;
  /** True when the high end is limited by the statutory cap. */
  capped: boolean;
}

export function estimateUnemployment(input: UnemploymentInput): UnemploymentResult {
  const monthly = Math.max(0, input.monthlyAgorot);
  const dailyWage = Math.round(monthly / 25); // ≈ 6-month income / 150
  const young = input.age < 28;

  // Tier bounds: lowest applicable rate → highest, +20 points when under 28.
  const lowRate = young ? 0.7 : 0.5;
  const highRate = young ? 1.0 : 0.8;

  const cap = UNEMPLOYMENT_CAP_FIRST_AGOROT;
  const dailyLowAgorot = Math.min(Math.round(dailyWage * lowRate), cap);
  const dailyHighAgorot = Math.min(Math.round(dailyWage * highRate), cap);
  const capped = Math.round(dailyWage * highRate) > cap;

  const days = unemploymentDays(input.age);
  const paidDays = Math.min(days, 125); // first-period cap applies to first 125

  return {
    dailyLowAgorot,
    dailyHighAgorot,
    days,
    totalLowAgorot: dailyLowAgorot * paidDays,
    totalHighAgorot: dailyHighAgorot * paidDays,
    capped,
  };
}

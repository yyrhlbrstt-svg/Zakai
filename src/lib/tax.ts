/**
 * Income-tax refund estimator — "החזר מס".
 *
 * Targets the single most common, cleanly-computable refund case in Israel:
 * you worked only PART of the year. Monthly tax is withheld as if you'd earn
 * that salary for all 12 months, but your real annual income is lower — so you
 * fall into lower brackets AND keep a full year's credit points. The gap comes
 * back as a refund.
 *
 * Figures 2026 (brackets and the credit-point value were frozen, = 2025):
 *  - Annual brackets: 10% ≤84,120 · 14% ≤120,720 · 20% ≤193,800 · 31% ≤269,280
 *    · 35% ≤560,280 · 47% ≤721,560 · 50% above.
 *  - Credit point: ₪2,904/year (₪242/month). Base 2.25 points (2.75 for women).
 * Sources: Kol-Zchut, taxes-refund.co.il. Money in agorot.
 */

/** Annual brackets as [ceiling_agorot, rate]. Last ceiling is Infinity. */
const BRACKETS: Array<[number, number]> = [
  [8_412_000, 0.1], // ≤ ₪84,120
  [12_072_000, 0.14], // ≤ ₪120,720
  [19_380_000, 0.2], // ≤ ₪193,800
  [26_928_000, 0.31], // ≤ ₪269,280
  [56_028_000, 0.35], // ≤ ₪560,280
  [72_156_000, 0.47], // ≤ ₪721,560
  [Infinity, 0.5], // above (incl. surtax)
];

export const CREDIT_POINT_ANNUAL_AGOROT = 290_400; // ₪2,904
export const CREDIT_POINT_MONTHLY_AGOROT = 24_200; // ₪242
export const DEFAULT_CREDIT_POINTS = 2.25;

/** Progressive annual income tax on a gross income (agorot), before credits. */
export function annualTaxAgorot(incomeAgorot: number): number {
  let income = Math.max(0, incomeAgorot);
  let tax = 0;
  let lower = 0;
  for (const [ceiling, rate] of BRACKETS) {
    if (income <= lower) break;
    const taxable = Math.min(income, ceiling) - lower;
    tax += taxable * rate;
    lower = ceiling;
    if (income <= ceiling) break;
  }
  return Math.round(tax);
}

export interface RefundInput {
  /** Gross monthly salary while working, in agorot. */
  monthlyAgorot: number;
  /** Number of months actually worked in the tax year (1–12). */
  monthsWorked: number;
  /** Credit points the employee is entitled to (default 2.25). */
  creditPoints?: number;
}

export interface RefundResult {
  refundAgorot: number;
  withheldAgorot: number;
  actualDueAgorot: number;
}

/**
 * Estimate the refund for partial-year employment. Monthly withholding assumes
 * a full year at this salary and applies monthly credit points; the true tax is
 * on the part-year income against the full annual credit points.
 */
export function estimatePartialYearRefund(input: RefundInput): RefundResult {
  const monthly = Math.max(0, input.monthlyAgorot);
  const months = Math.min(12, Math.max(0, input.monthsWorked));
  const points = Math.max(0, input.creditPoints ?? DEFAULT_CREDIT_POINTS);

  // What was withheld each worked month: annualized tax / 12 minus this month's
  // credit points, never below zero; summed over the worked months.
  const monthlyGrossTax = annualTaxAgorot(monthly * 12) / 12;
  const monthlyWithheld = Math.max(0, monthlyGrossTax - points * CREDIT_POINT_MONTHLY_AGOROT);
  const withheldAgorot = Math.round(monthlyWithheld * months);

  // What is actually due: tax on the real part-year income, less a FULL year of
  // credit points (they accrue for every month of residency, not just worked).
  const actualDueAgorot = Math.max(
    0,
    annualTaxAgorot(monthly * months) - points * CREDIT_POINT_ANNUAL_AGOROT,
  );

  return {
    refundAgorot: Math.max(0, withheldAgorot - actualDueAgorot),
    withheldAgorot,
    actualDueAgorot,
  };
}

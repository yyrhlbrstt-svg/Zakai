/**
 * Severance-pay engine — "פיצויי פיטורים".
 *
 * Israeli law (חוק פיצויי פיטורים, התשכ"ג-1963): an employee dismissed after
 * at least one year is entitled to severance of one month's (last) salary per
 * year of employment, pro-rated for partial years. Deterministic and exact;
 * money in agorot.
 *
 * Section 14 (סעיף 14): where the employer's ongoing 6% severance deposits to
 * the pension fully cover the obligation, those deposits are the severance and
 * are usually released to the employee even on resignation. We surface the
 * computed entitlement either way and explain the distinction in the UI.
 */

export interface SeveranceInput {
  /** Last monthly salary (the base for the calculation), in agorot. */
  lastMonthlyAgorot: number;
  /** Full years of employment. */
  years: number;
  /** Additional months beyond the full years (0–11). */
  months: number;
}

export interface SeveranceResult {
  severanceAgorot: number;
  /** Total tenure expressed in years (e.g. 3.5). */
  totalYears: number;
  /** True once the one-year eligibility threshold is met. */
  eligible: boolean;
}

export function computeSeverance(input: SeveranceInput): SeveranceResult {
  const salary = Math.max(0, input.lastMonthlyAgorot);
  const years = Math.max(0, Math.floor(input.years));
  const months = Math.min(11, Math.max(0, Math.floor(input.months)));
  const totalYears = years + months / 12;

  // One month's salary per year, pro-rated for the partial year.
  const severanceAgorot = Math.round(salary * totalYears);

  return {
    severanceAgorot,
    totalYears,
    eligible: totalYears >= 1,
  };
}

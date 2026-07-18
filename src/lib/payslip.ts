/**
 * Payslip audit engine — "בדיקת תלוש".
 *
 * A deterministic check of the three most common (and most quantifiable)
 * shortfalls on an Israeli payslip: minimum wage, mandatory pension, and
 * convalescence pay (דמי הבראה). Everything is computed from a handful of
 * numbers a worker can read straight off the slip — no document upload, no
 * storage. Amounts are conservative estimates for orientation, never a
 * promise, and the UI says so. Money in agorot (integers).
 *
 * Figures verified July 2026:
 *  - Minimum wage (from 1.4.2026): ₪6,443.85/mo, ₪35.40/hr.
 *  - Mandatory pension (since 2017): 18.5% total — 6% employee, 12.5% employer
 *    (6.5% benefits + 6% severance).
 *  - Convalescence (private sector, 2026): ₪451.5/day, days by seniority.
 * Sources: Kol-Zchut, Malam Payroll, btl.gov.il.
 */

export const MIN_WAGE_MONTHLY_AGOROT = 644_385; // ₪6,443.85
export const MIN_WAGE_HOURLY_AGOROT = 3_540; // ₪35.40
export const HAVRAA_DAY_AGOROT = 45_150; // ₪451.5 (private sector)
export const PENSION_EMPLOYER_BPS = 1_250; // 12.5% employer (benefits + severance)

/** Convalescence days by full years of seniority (private-sector default table). */
export function havraaDays(seniorityYears: number): number {
  const y = Math.max(0, Math.floor(seniorityYears));
  if (y <= 0) return 0; // entitlement begins after the first full year
  if (y === 1) return 5;
  if (y <= 3) return 6;
  if (y <= 10) return 7;
  if (y <= 15) return 8;
  if (y <= 19) return 9;
  return 10;
}

export type FindingStatus = "ok" | "shortfall" | "missing" | "unknown";

export interface Finding {
  id: "minWage" | "pension" | "havraa";
  status: FindingStatus;
  /** Monthly gap in agorot (minWage, pension), when a shortfall exists. */
  monthlyAgorot?: number;
  /** Annual gap in agorot (havraa), when a shortfall exists. */
  annualAgorot?: number;
  expectedAgorot: number;
  actualAgorot: number;
}

export interface PayslipInput {
  /** Employment fraction 0–1 (1 = full-time). Scales monthly expectations. */
  scope: number;
  /** Monthly base pay (שכר בסיס) in agorot. */
  monthlyBaseAgorot: number;
  /** Whether pension contributions appear on the slip at all. */
  pensionShown: boolean;
  /** Employer pension contribution shown on the slip, in agorot (benefits +
   *  severance combined). Ignored when pensionShown is false. */
  employerPensionAgorot: number;
  /** Full years at this employer. */
  seniorityYears: number;
  /** Whether convalescence pay was received in the last 12 months. */
  havraaPaid: boolean;
  /** Convalescence amount received in the last 12 months, in agorot. */
  havraaPaidAgorot: number;
}

export interface PayslipAudit {
  findings: Finding[];
  /** Total quantified monthly gap (minWage + pension), agorot. */
  monthlyGapAgorot: number;
  /** Total quantified annual gap (monthly×12 + havraa), agorot. */
  annualGapAgorot: number;
  /** Count of findings that flagged a shortfall or missing item. */
  flagged: number;
}

const round = Math.round;

export function auditPayslip(input: PayslipInput): PayslipAudit {
  const scope = Math.min(1, Math.max(0, input.scope || 0));
  const findings: Finding[] = [];

  // --- Minimum wage: base pay vs pro-rated monthly minimum. ---
  const minExpected = round(MIN_WAGE_MONTHLY_AGOROT * scope);
  const base = Math.max(0, input.monthlyBaseAgorot);
  {
    // 2% tolerance so ordinary rounding on the slip doesn't false-positive.
    const shortfall = minExpected - base;
    const status: FindingStatus =
      base <= 0 ? "unknown" : shortfall > round(minExpected * 0.02) ? "shortfall" : "ok";
    findings.push({
      id: "minWage",
      status,
      expectedAgorot: minExpected,
      actualAgorot: base,
      ...(status === "shortfall" ? { monthlyAgorot: shortfall } : {}),
    });
  }

  // --- Pension: employer contribution vs 12.5% of base. ---
  const pensionExpected = round((base * PENSION_EMPLOYER_BPS) / 10_000);
  {
    let status: FindingStatus;
    let actual = 0;
    if (base <= 0) {
      status = "unknown";
    } else if (!input.pensionShown) {
      status = "missing";
    } else {
      actual = Math.max(0, input.employerPensionAgorot);
      status = pensionExpected - actual > round(pensionExpected * 0.05) ? "shortfall" : "ok";
    }
    const gap = pensionExpected - actual;
    findings.push({
      id: "pension",
      status,
      expectedAgorot: pensionExpected,
      actualAgorot: actual,
      ...(status === "shortfall" || status === "missing"
        ? { monthlyAgorot: Math.max(0, gap) }
        : {}),
    });
  }

  // --- Convalescence pay: annual entitlement vs what was received. ---
  const days = havraaDays(input.seniorityYears);
  const havraaExpected = round(days * HAVRAA_DAY_AGOROT * scope);
  {
    let status: FindingStatus;
    let actual = 0;
    if (days <= 0) {
      status = "ok"; // no entitlement yet (under one year)
    } else if (!input.havraaPaid) {
      status = "missing";
    } else {
      actual = Math.max(0, input.havraaPaidAgorot);
      status = havraaExpected - actual > round(havraaExpected * 0.05) ? "shortfall" : "ok";
    }
    const gap = havraaExpected - actual;
    findings.push({
      id: "havraa",
      status,
      expectedAgorot: havraaExpected,
      actualAgorot: actual,
      ...(status === "shortfall" || status === "missing"
        ? { annualAgorot: Math.max(0, gap) }
        : {}),
    });
  }

  const monthlyGapAgorot = findings.reduce((s, f) => s + (f.monthlyAgorot ?? 0), 0);
  const annualGapAgorot =
    monthlyGapAgorot * 12 + findings.reduce((s, f) => s + (f.annualAgorot ?? 0), 0);
  const flagged = findings.filter((f) => f.status === "shortfall" || f.status === "missing").length;

  return { findings, monthlyGapAgorot, annualGapAgorot, flagged };
}

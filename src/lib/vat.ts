/**
 * VAT return engine — "דו"ח מע"מ תקופתי" for Israeli businesses (עוסק מורשה).
 *
 * Deterministic and exact: every amount is an integer in agorot, every ratio is
 * an integer fraction, and nothing here touches the network. The engine answers
 * three questions a business actually has:
 *
 *   1. What do I owe (or get back) this period?
 *   2. Which input VAT am I about to lose, and why?
 *   3. When is it due, and do I file monthly or bi-monthly?
 *
 * (2) is the part that finds money. Most small businesses either over-deduct
 * (audit exposure) or silently under-deduct (cash left on the table). Each
 * adjustment the engine makes is surfaced as a `VatFinding` with the exact
 * agorot at stake, so the UI can show the reasoning instead of a bare number.
 *
 * ── Legal basis (verified 2026-07) ──────────────────────────────────────────
 * Rate            18% since 2025-01-01 (חוק מס ערך מוסף).
 * תקנה 14         Input VAT on the purchase/import/lease of a private passenger
 *                 car is not deductible at all, unless the car is used
 *                 exclusively for a listed trade (driving school, car rental,
 *                 passenger transport, field tours).
 * תקנה 14 (אחזקה) Running costs of such a car (fuel, service) — ⅔ deductible.
 * תקנה 15א        Input VAT on hospitality/entertainment (כיבוד ואירוח) is not
 *                 deductible, even where income tax allows part of the expense.
 * תקנה 18         Mixed business/private inputs: ⅔ deductible where the input
 *                 mainly serves the business, ¼ where it mainly serves private
 *                 use. Does not override the specific bar in תקנה 14.
 * חשבונית ישראל   From 2026-06-01 a tax invoice over ₪5,000 (before VAT)
 *                 between עוסקים מורשים requires a Tax Authority allocation
 *                 number; without it the recipient cannot deduct the input VAT.
 *                 Zero-rated and exempt transactions are outside the rule.
 * Filing period   Bi-monthly by default; monthly once annual turnover exceeds
 *                 ₪500,000, and always monthly for filers of the detailed
 *                 PCN874 report.
 * Due date        The 15th of the month following the period. If that falls on
 *                 the weekly rest day it moves to the next business day.
 *
 * This module computes; it does not advise. Nothing here is a substitute for a
 * licensed accountant, and the UI says so.
 */

/** VAT rate as an integer percent. 18% from 2025-01-01. */
export const VAT_RATE_PERCENT = 18;

/** Annual turnover above which filing becomes monthly: ₪500,000. */
export const MONTHLY_FILING_THRESHOLD_AGOROT = 50_000_000;

/** עוסק פטור annual turnover ceiling for 2026: ₪122,833. */
export const OSEK_PATUR_CEILING_AGOROT = 12_283_300;

/**
 * Allocation-number threshold (חשבונית ישראל): ₪5,000 before VAT, in force
 * from 2026-06-01. Invoices above this need a 9-digit allocation number for the
 * recipient to deduct input VAT.
 */
export const ALLOCATION_NUMBER_THRESHOLD_AGOROT = 500_000;

/** Date the ₪5,000 allocation-number threshold took effect. */
export const ALLOCATION_RULE_START = "2026-06-01";

/** How a sale is treated for output VAT. */
export type SaleCategory =
  /** Ordinary domestic sale — output VAT at the standard rate. */
  | "standard"
  /** Zero-rated (export, eligible tourism): in turnover, no output VAT. */
  | "zeroRated"
  /** Exempt (עסקה פטורה): no output VAT, and no input VAT on its costs. */
  | "exempt";

/** How an input (purchase) is treated for deduction. */
export type InputCategory =
  /** Ordinary business purchase — fully deductible. */
  | "standard"
  /** Capital equipment (תשומות ציוד) — fully deductible, reported separately. */
  | "equipment"
  /** Mixed use, mainly business (תקנה 18) — ⅔ deductible. */
  | "mixedBusiness"
  /** Mixed use, mainly private (תקנה 18) — ¼ deductible. */
  | "mixedPrivate"
  /** Running costs of a private passenger car — ⅔ deductible. */
  | "vehicleUpkeep"
  /** Purchase/lease of a private passenger car (תקנה 14) — not deductible. */
  | "vehiclePurchase"
  /** Hospitality and entertainment (תקנה 15א) — not deductible. */
  | "hospitality";

/** An exact deduction ratio, kept as a fraction so the math stays integral. */
interface Ratio {
  readonly num: number;
  readonly den: number;
}

/** Deductible share of input VAT per category, and its legal reference. */
export const INPUT_RULES: Record<
  InputCategory,
  { ratio: Ratio; reference: string; bucket: "equipment" | "other" }
> = {
  standard: { ratio: { num: 1, den: 1 }, reference: "", bucket: "other" },
  equipment: { ratio: { num: 1, den: 1 }, reference: "", bucket: "equipment" },
  mixedBusiness: { ratio: { num: 2, den: 3 }, reference: "תקנה 18", bucket: "other" },
  mixedPrivate: { ratio: { num: 1, den: 4 }, reference: "תקנה 18", bucket: "other" },
  vehicleUpkeep: { ratio: { num: 2, den: 3 }, reference: "תקנה 14", bucket: "other" },
  vehiclePurchase: { ratio: { num: 0, den: 1 }, reference: "תקנה 14", bucket: "equipment" },
  hospitality: { ratio: { num: 0, den: 1 }, reference: "תקנה 15א", bucket: "other" },
};

export interface VatSaleLine {
  id: string;
  label: string;
  /** Amount before VAT, in agorot. */
  netAgorot: number;
  category: SaleCategory;
}

export interface VatInputLine {
  id: string;
  label: string;
  /** Amount before VAT, in agorot. */
  netAgorot: number;
  category: InputCategory;
  /**
   * Whether a valid tax invoice (חשבונית מס) is on file. Without one there is
   * nothing to deduct, regardless of category. Defaults to true.
   */
  hasTaxInvoice?: boolean;
  /**
   * Whether the invoice carries a Tax Authority allocation number. Only
   * consulted for invoices above the threshold. Defaults to true.
   */
  hasAllocationNumber?: boolean;
}

export type FindingSeverity =
  /** Deduction fully denied — the whole VAT amount is lost. */
  | "blocked"
  /** Deduction partially denied by regulation. */
  | "reduced"
  /** Recoverable with an action (get the allocation number / the invoice). */
  | "recoverable"
  /** Neutral context worth showing. */
  | "info";

export interface VatFinding {
  /** Stable machine key, so the UI can translate without parsing prose. */
  code:
    | "missingInvoice"
    | "missingAllocationNumber"
    | "vehiclePurchaseBlocked"
    | "hospitalityBlocked"
    | "partialDeduction"
    | "refundPosition"
    | "belowPaturCeiling";
  severity: FindingSeverity;
  /** The input line this refers to, when line-specific. */
  lineId?: string;
  lineLabel?: string;
  /** Input VAT affected by this finding, in agorot. */
  amountAgorot: number;
  /** Legal reference, when there is one. */
  reference?: string;
}

export type FilingFrequency = "monthly" | "biMonthly";

export interface VatReportInput {
  sales: VatSaleLine[];
  inputs: VatInputLine[];
  /**
   * Annual turnover in agorot, used only to derive the filing frequency. When
   * omitted it is extrapolated from this period's turnover.
   */
  annualTurnoverAgorot?: number;
  /** Forces monthly filing (PCN874 filers must file monthly). */
  detailedReport?: boolean;
  /** Period being reported, used for the due date. Month is 1-12. */
  period?: { year: number; month: number };
}

export interface VatReportResult {
  ratePercent: number;
  sales: {
    taxableNetAgorot: number;
    zeroRatedNetAgorot: number;
    exemptNetAgorot: number;
    /** Total turnover across all categories. */
    totalNetAgorot: number;
    outputVatAgorot: number;
  };
  inputs: {
    /** Deductible input VAT on capital equipment (תשומות ציוד). */
    equipmentVatAgorot: number;
    /** Deductible input VAT on everything else (תשומות אחרות). */
    otherVatAgorot: number;
    /** equipment + other. */
    deductibleVatAgorot: number;
    /** VAT actually paid to suppliers this period. */
    paidVatAgorot: number;
    /** Paid but not deductible. */
    disallowedVatAgorot: number;
    /** Disallowed only for a fixable reason — real money still on the table. */
    recoverableVatAgorot: number;
  };
  /** Output minus deductible input. Positive = payable, negative = refund. */
  netAgorot: number;
  direction: "payable" | "refund" | "nil";
  findings: VatFinding[];
  filing: {
    frequency: FilingFrequency;
    /** ISO date (YYYY-MM-DD) the return is due, when a period was given. */
    dueDate?: string;
  };
}

/** VAT on a net amount at the standard rate, rounded to the agora. */
export function vatOn(netAgorot: number): number {
  return Math.round((Math.max(0, netAgorot) * VAT_RATE_PERCENT) / 100);
}

/** Strip VAT out of a gross (VAT-inclusive) amount. */
export function netFromGross(grossAgorot: number): number {
  return Math.round((Math.max(0, grossAgorot) * 100) / (100 + VAT_RATE_PERCENT));
}

/** VAT contained in a gross (VAT-inclusive) amount. */
export function vatFromGross(grossAgorot: number): number {
  const gross = Math.max(0, grossAgorot);
  return gross - netFromGross(gross);
}

/**
 * Due date for a period: the 15th of the following month, pushed to the next
 * business day when it lands on Friday or Saturday (Sunday is a workday in
 * Israel). Returns an ISO `YYYY-MM-DD` string.
 */
export function dueDateFor(year: number, month: number): string {
  // The 15th of the month *after* the period. `Date.UTC` handles the December
  // rollover into the next year on its own.
  const d = new Date(Date.UTC(year, month, 15));
  const day = d.getUTCDay(); // 0 = Sunday … 5 = Friday, 6 = Saturday
  if (day === 5) d.setUTCDate(d.getUTCDate() + 2);
  else if (day === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Filing frequency from annual turnover, with the PCN874 override. */
export function filingFrequency(
  annualTurnoverAgorot: number,
  detailedReport = false,
): FilingFrequency {
  if (detailedReport) return "monthly";
  return annualTurnoverAgorot > MONTHLY_FILING_THRESHOLD_AGOROT ? "monthly" : "biMonthly";
}

/**
 * Whether a line needs an allocation number to be deductible. Only standard
 * VAT-bearing purchases above the threshold are in scope.
 */
export function needsAllocationNumber(netAgorot: number): boolean {
  return netAgorot > ALLOCATION_NUMBER_THRESHOLD_AGOROT;
}

/** Compute a full periodic VAT return. Pure: same input, same output, always. */
export function computeVatReport(input: VatReportInput): VatReportResult {
  // ── Output VAT ────────────────────────────────────────────────────────────
  let taxableNet = 0;
  let zeroRatedNet = 0;
  let exemptNet = 0;

  for (const sale of input.sales) {
    const net = Math.max(0, Math.round(sale.netAgorot));
    if (sale.category === "standard") taxableNet += net;
    else if (sale.category === "zeroRated") zeroRatedNet += net;
    else exemptNet += net;
  }

  const outputVat = vatOn(taxableNet);
  const totalNet = taxableNet + zeroRatedNet + exemptNet;

  // ── Input VAT ─────────────────────────────────────────────────────────────
  let equipmentVat = 0;
  let otherVat = 0;
  let paidVat = 0;
  let recoverableVat = 0;
  const findings: VatFinding[] = [];

  for (const line of input.inputs) {
    const net = Math.max(0, Math.round(line.netAgorot));
    const rule = INPUT_RULES[line.category];
    const lineVat = vatOn(net);
    paidVat += lineVat;

    if (lineVat === 0) continue;

    const hasInvoice = line.hasTaxInvoice !== false;
    const hasAllocation = line.hasAllocationNumber !== false;

    // No invoice: nothing is deductible, but it is recoverable — the business
    // can still obtain the document from the supplier before filing.
    if (!hasInvoice) {
      findings.push({
        code: "missingInvoice",
        severity: "recoverable",
        lineId: line.id,
        lineLabel: line.label,
        amountAgorot: lineVat,
      });
      recoverableVat += lineVat;
      continue;
    }

    // Above the threshold without an allocation number the deduction is barred,
    // but the supplier can still issue a compliant invoice — so it is money the
    // business can get back by acting, not money that is gone.
    if (needsAllocationNumber(net) && !hasAllocation) {
      findings.push({
        code: "missingAllocationNumber",
        severity: "recoverable",
        lineId: line.id,
        lineLabel: line.label,
        amountAgorot: lineVat,
        reference: "חשבונית ישראל",
      });
      recoverableVat += lineVat;
      continue;
    }

    const deductible = Math.round((lineVat * rule.ratio.num) / rule.ratio.den);
    const lost = lineVat - deductible;

    if (deductible > 0) {
      if (rule.bucket === "equipment") equipmentVat += deductible;
      else otherVat += deductible;
    }

    if (lost > 0) {
      const code =
        line.category === "vehiclePurchase"
          ? "vehiclePurchaseBlocked"
          : line.category === "hospitality"
            ? "hospitalityBlocked"
            : "partialDeduction";
      findings.push({
        code,
        severity: deductible === 0 ? "blocked" : "reduced",
        lineId: line.id,
        lineLabel: line.label,
        amountAgorot: lost,
        reference: rule.reference || undefined,
      });
    }
  }

  const deductibleVat = equipmentVat + otherVat;
  const netAgorot = outputVat - deductibleVat;

  // ── Position and filing ───────────────────────────────────────────────────
  // A refund position is worth flagging: it is legitimate (heavy equipment
  // period, exporter) but it is also the single most audited filing there is.
  if (netAgorot < 0) {
    findings.push({
      code: "refundPosition",
      severity: "info",
      amountAgorot: Math.abs(netAgorot),
    });
  }

  // Extrapolate an annual figure when none was given: this period's turnover
  // scaled by the number of like periods in a year.
  const annualTurnover =
    input.annualTurnoverAgorot ?? totalNet * (input.detailedReport ? 12 : 6);

  if (annualTurnover > 0 && annualTurnover <= OSEK_PATUR_CEILING_AGOROT) {
    findings.push({
      code: "belowPaturCeiling",
      severity: "info",
      amountAgorot: OSEK_PATUR_CEILING_AGOROT - annualTurnover,
    });
  }

  return {
    ratePercent: VAT_RATE_PERCENT,
    sales: {
      taxableNetAgorot: taxableNet,
      zeroRatedNetAgorot: zeroRatedNet,
      exemptNetAgorot: exemptNet,
      totalNetAgorot: totalNet,
      outputVatAgorot: outputVat,
    },
    inputs: {
      equipmentVatAgorot: equipmentVat,
      otherVatAgorot: otherVat,
      deductibleVatAgorot: deductibleVat,
      paidVatAgorot: paidVat,
      disallowedVatAgorot: paidVat - deductibleVat,
      recoverableVatAgorot: recoverableVat,
    },
    netAgorot,
    direction: netAgorot > 0 ? "payable" : netAgorot < 0 ? "refund" : "nil",
    findings,
    filing: {
      frequency: filingFrequency(annualTurnover, input.detailedReport),
      dueDate: input.period
        ? dueDateFor(input.period.year, input.period.month)
        : undefined,
    },
  };
}

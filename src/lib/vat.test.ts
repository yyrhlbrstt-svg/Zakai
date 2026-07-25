import { describe, it, expect } from "vitest";
import {
  computeVatReport,
  dueDateFor,
  filingFrequency,
  needsAllocationNumber,
  netFromGross,
  vatFromGross,
  vatOn,
  ALLOCATION_NUMBER_THRESHOLD_AGOROT,
  MONTHLY_FILING_THRESHOLD_AGOROT,
  OSEK_PATUR_CEILING_AGOROT,
  type VatInputLine,
  type VatSaleLine,
} from "./vat";

/** ₪ -> agorot, for readable fixtures. */
const s = (shekels: number) => shekels * 100;

const sale = (netShekels: number, category: VatSaleLine["category"] = "standard"): VatSaleLine => ({
  id: `s-${netShekels}-${category}`,
  label: "sale",
  netAgorot: s(netShekels),
  category,
});

const purchase = (
  netShekels: number,
  category: VatInputLine["category"] = "standard",
  extra: Partial<VatInputLine> = {},
): VatInputLine => ({
  id: `p-${netShekels}-${category}`,
  label: "purchase",
  netAgorot: s(netShekels),
  category,
  ...extra,
});

describe("vatOn / gross helpers", () => {
  it("applies 18% and rounds to the agora", () => {
    expect(vatOn(s(10_000))).toBe(s(1_800));
    // 1 agora at 18% rounds to 0; 3 agorot rounds to 1.
    expect(vatOn(1)).toBe(0);
    expect(vatOn(3)).toBe(1);
  });

  it("never returns VAT on a negative amount", () => {
    expect(vatOn(-500)).toBe(0);
  });

  it("splits a gross amount back into net + VAT exactly", () => {
    const gross = s(11_800);
    expect(netFromGross(gross)).toBe(s(10_000));
    expect(vatFromGross(gross)).toBe(s(1_800));
    // The two parts always reconstitute the gross, with no lost agora.
    expect(netFromGross(gross) + vatFromGross(gross)).toBe(gross);
  });

  it("keeps net + VAT === gross for awkward amounts", () => {
    for (const gross of [1, 7, 99, 12_345, 999_999]) {
      expect(netFromGross(gross) + vatFromGross(gross)).toBe(gross);
    }
  });
});

describe("computeVatReport — output VAT", () => {
  it("charges VAT on standard sales only", () => {
    const r = computeVatReport({
      sales: [sale(100_000), sale(40_000, "zeroRated"), sale(10_000, "exempt")],
      inputs: [],
    });
    expect(r.sales.taxableNetAgorot).toBe(s(100_000));
    expect(r.sales.zeroRatedNetAgorot).toBe(s(40_000));
    expect(r.sales.exemptNetAgorot).toBe(s(10_000));
    // Output VAT is charged on the taxable turnover alone.
    expect(r.sales.outputVatAgorot).toBe(s(18_000));
    // Turnover still counts every category.
    expect(r.sales.totalNetAgorot).toBe(s(150_000));
  });

  it("is payable when output exceeds deductible input", () => {
    const r = computeVatReport({ sales: [sale(50_000)], inputs: [purchase(10_000)] });
    expect(r.sales.outputVatAgorot).toBe(s(9_000));
    expect(r.inputs.deductibleVatAgorot).toBe(s(1_800));
    expect(r.netAgorot).toBe(s(7_200));
    expect(r.direction).toBe("payable");
  });

  it("is a refund position when input exceeds output, and flags it", () => {
    const r = computeVatReport({ sales: [sale(10_000)], inputs: [purchase(60_000, "equipment")] });
    expect(r.netAgorot).toBe(s(1_800) - s(10_800));
    expect(r.direction).toBe("refund");
    const flag = r.findings.find((f) => f.code === "refundPosition");
    expect(flag?.amountAgorot).toBe(s(9_000));
  });

  it("reports nil when output and input cancel out", () => {
    const r = computeVatReport({ sales: [sale(10_000)], inputs: [purchase(10_000)] });
    expect(r.netAgorot).toBe(0);
    expect(r.direction).toBe("nil");
  });
});

describe("computeVatReport — deduction regulations", () => {
  it("splits equipment input VAT from other input VAT", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [purchase(20_000, "equipment"), purchase(5_000, "standard")],
    });
    expect(r.inputs.equipmentVatAgorot).toBe(s(3_600));
    expect(r.inputs.otherVatAgorot).toBe(s(900));
    expect(r.inputs.deductibleVatAgorot).toBe(s(4_500));
  });

  it("blocks input VAT on a private car purchase (תקנה 14)", () => {
    const r = computeVatReport({ sales: [], inputs: [purchase(100_000, "vehiclePurchase")] });
    expect(r.inputs.deductibleVatAgorot).toBe(0);
    const f = r.findings.find((x) => x.code === "vehiclePurchaseBlocked");
    expect(f?.severity).toBe("blocked");
    expect(f?.amountAgorot).toBe(s(18_000));
    expect(f?.reference).toBe("תקנה 14");
  });

  it("allows two thirds of car running costs (תקנה 14)", () => {
    const r = computeVatReport({ sales: [], inputs: [purchase(1_500, "vehicleUpkeep")] });
    // VAT ₪270 -> ⅔ = ₪180 deductible, ₪90 lost.
    expect(r.inputs.deductibleVatAgorot).toBe(s(180));
    const f = r.findings.find((x) => x.code === "partialDeduction");
    expect(f?.severity).toBe("reduced");
    expect(f?.amountAgorot).toBe(s(90));
  });

  it("blocks hospitality input VAT entirely (תקנה 15א)", () => {
    const r = computeVatReport({ sales: [], inputs: [purchase(1_000, "hospitality")] });
    expect(r.inputs.deductibleVatAgorot).toBe(0);
    const f = r.findings.find((x) => x.code === "hospitalityBlocked");
    expect(f?.severity).toBe("blocked");
    expect(f?.amountAgorot).toBe(s(180));
    expect(f?.reference).toBe("תקנה 15א");
  });

  it("applies the ⅔ and ¼ mixed-use ratios (תקנה 18)", () => {
    const mainlyBusiness = computeVatReport({ sales: [], inputs: [purchase(3_000, "mixedBusiness")] });
    // VAT ₪540 -> ⅔ = ₪360.
    expect(mainlyBusiness.inputs.deductibleVatAgorot).toBe(s(360));

    const mainlyPrivate = computeVatReport({ sales: [], inputs: [purchase(800, "mixedPrivate")] });
    // VAT ₪144 -> ¼ = ₪36.
    expect(mainlyPrivate.inputs.deductibleVatAgorot).toBe(s(36));
    expect(mainlyPrivate.findings[0]?.reference).toBe("תקנה 18");
  });

  it("accounts for every agora paid: deductible + disallowed === paid", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [
        purchase(10_000, "standard"),
        purchase(3_000, "mixedBusiness"),
        purchase(1_000, "hospitality"),
        purchase(1_500, "vehicleUpkeep"),
      ],
    });
    expect(r.inputs.deductibleVatAgorot + r.inputs.disallowedVatAgorot).toBe(
      r.inputs.paidVatAgorot,
    );
  });
});

describe("computeVatReport — documentation risk", () => {
  it("denies the deduction with no tax invoice, as recoverable", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [purchase(4_000, "standard", { hasTaxInvoice: false })],
    });
    expect(r.inputs.deductibleVatAgorot).toBe(0);
    const f = r.findings.find((x) => x.code === "missingInvoice");
    expect(f?.severity).toBe("recoverable");
    expect(f?.amountAgorot).toBe(s(720));
    // Recoverable money is tracked separately from money that is simply gone.
    expect(r.inputs.recoverableVatAgorot).toBe(s(720));
  });

  it("denies the deduction above ₪5,000 without an allocation number", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [purchase(6_000, "standard", { hasAllocationNumber: false })],
    });
    expect(r.inputs.deductibleVatAgorot).toBe(0);
    const f = r.findings.find((x) => x.code === "missingAllocationNumber");
    expect(f?.severity).toBe("recoverable");
    expect(f?.amountAgorot).toBe(s(1_080));
    expect(f?.reference).toBe("חשבונית ישראל");
  });

  it("ignores the allocation rule at or below the ₪5,000 threshold", () => {
    // The rule bites *above* ₪5,000, so exactly ₪5,000 is still deductible.
    expect(needsAllocationNumber(ALLOCATION_NUMBER_THRESHOLD_AGOROT)).toBe(false);
    expect(needsAllocationNumber(ALLOCATION_NUMBER_THRESHOLD_AGOROT + 1)).toBe(true);

    const r = computeVatReport({
      sales: [],
      inputs: [purchase(5_000, "standard", { hasAllocationNumber: false })],
    });
    expect(r.inputs.deductibleVatAgorot).toBe(s(900));
    expect(r.findings.some((x) => x.code === "missingAllocationNumber")).toBe(false);
  });

  it("treats a missing invoice as fatal before checking the allocation number", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [
        purchase(9_000, "standard", { hasTaxInvoice: false, hasAllocationNumber: false }),
      ],
    });
    // Exactly one finding: the missing document, not both.
    expect(r.findings.filter((f) => f.lineId).length).toBe(1);
    expect(r.findings[0]?.code).toBe("missingInvoice");
  });

  it("carries the line label through to the finding", () => {
    const r = computeVatReport({
      sales: [],
      inputs: [{ id: "x1", label: "ארוחת צוות", netAgorot: s(500), category: "hospitality" }],
    });
    expect(r.findings[0]?.lineId).toBe("x1");
    expect(r.findings[0]?.lineLabel).toBe("ארוחת צוות");
  });
});

describe("filing frequency", () => {
  it("is bi-monthly at or below ₪500,000 of annual turnover", () => {
    expect(filingFrequency(MONTHLY_FILING_THRESHOLD_AGOROT)).toBe("biMonthly");
  });

  it("is monthly above ₪500,000", () => {
    expect(filingFrequency(MONTHLY_FILING_THRESHOLD_AGOROT + 1)).toBe("monthly");
  });

  it("is always monthly for detailed-report (PCN874) filers", () => {
    expect(filingFrequency(s(1_000), true)).toBe("monthly");
  });

  it("uses the supplied annual turnover rather than extrapolating", () => {
    const r = computeVatReport({
      sales: [sale(1_000_000)],
      inputs: [],
      annualTurnoverAgorot: s(200_000),
    });
    expect(r.filing.frequency).toBe("biMonthly");
  });

  it("flags a turnover still under the עוסק פטור ceiling", () => {
    const r = computeVatReport({
      sales: [sale(1_000)],
      inputs: [],
      annualTurnoverAgorot: s(100_000),
    });
    const f = r.findings.find((x) => x.code === "belowPaturCeiling");
    expect(f?.amountAgorot).toBe(OSEK_PATUR_CEILING_AGOROT - s(100_000));
  });

  it("does not flag the ceiling once turnover exceeds it", () => {
    const r = computeVatReport({
      sales: [sale(1_000)],
      inputs: [],
      annualTurnoverAgorot: OSEK_PATUR_CEILING_AGOROT + 1,
    });
    expect(r.findings.some((x) => x.code === "belowPaturCeiling")).toBe(false);
  });
});

describe("dueDateFor", () => {
  it("is the 15th of the following month", () => {
    // June 2026 is reported by 15 July 2026 (a Wednesday).
    expect(dueDateFor(2026, 6)).toBe("2026-07-15");
  });

  it("pushes a Saturday due date to Sunday", () => {
    // 15 August 2026 is a Saturday -> the next business day is Sunday the 16th.
    expect(dueDateFor(2026, 7)).toBe("2026-08-16");
  });

  it("pushes a Friday due date past the weekend", () => {
    // 15 May 2026 is a Friday -> Sunday the 17th.
    expect(dueDateFor(2026, 4)).toBe("2026-05-17");
  });

  it("rolls December over into the next calendar year", () => {
    // December 2026 is reported by 15 January 2027, a Friday -> Sunday the 17th.
    expect(dueDateFor(2026, 12)).toBe("2027-01-17");
  });

  it("is exposed on the report when a period is given", () => {
    const r = computeVatReport({ sales: [], inputs: [], period: { year: 2026, month: 6 } });
    expect(r.filing.dueDate).toBe("2026-07-15");
  });

  it("is omitted when no period is given", () => {
    const r = computeVatReport({ sales: [], inputs: [] });
    expect(r.filing.dueDate).toBeUndefined();
  });
});

describe("computeVatReport — robustness", () => {
  it("returns an all-zero report for no activity", () => {
    const r = computeVatReport({ sales: [], inputs: [] });
    expect(r.sales.outputVatAgorot).toBe(0);
    expect(r.inputs.deductibleVatAgorot).toBe(0);
    expect(r.netAgorot).toBe(0);
    expect(r.direction).toBe("nil");
  });

  it("clamps negative amounts instead of crediting them", () => {
    const r = computeVatReport({
      sales: [sale(-5_000)],
      inputs: [purchase(-5_000)],
    });
    expect(r.sales.taxableNetAgorot).toBe(0);
    expect(r.inputs.paidVatAgorot).toBe(0);
  });

  it("is deterministic across repeated calls", () => {
    const args = {
      sales: [sale(37_777), sale(1_234, "zeroRated")],
      inputs: [purchase(9_876, "mixedBusiness"), purchase(543, "hospitality")],
      period: { year: 2026, month: 3 },
    };
    expect(computeVatReport(args)).toEqual(computeVatReport(args));
  });
});

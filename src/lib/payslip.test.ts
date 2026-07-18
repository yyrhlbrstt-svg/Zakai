import { describe, it, expect } from "vitest";
import {
  auditPayslip,
  havraaDays,
  MIN_WAGE_MONTHLY_AGOROT,
  HAVRAA_DAY_AGOROT,
  type PayslipInput,
} from "./payslip";

const base: PayslipInput = {
  scope: 1,
  monthlyBaseAgorot: MIN_WAGE_MONTHLY_AGOROT, // exactly minimum wage
  pensionShown: true,
  employerPensionAgorot: Math.round((MIN_WAGE_MONTHLY_AGOROT * 1250) / 10000),
  seniorityYears: 2,
  havraaPaid: true,
  havraaPaidAgorot: 6 * HAVRAA_DAY_AGOROT, // 6 days for year 2-3
};

describe("havraaDays", () => {
  it("follows the seniority table", () => {
    expect(havraaDays(0)).toBe(0);
    expect(havraaDays(1)).toBe(5);
    expect(havraaDays(3)).toBe(6);
    expect(havraaDays(4)).toBe(7);
    expect(havraaDays(10)).toBe(7);
    expect(havraaDays(15)).toBe(8);
    expect(havraaDays(20)).toBe(10);
  });
});

describe("auditPayslip", () => {
  it("passes a fully-correct payslip with no flags", () => {
    const out = auditPayslip(base);
    expect(out.flagged).toBe(0);
    expect(out.monthlyGapAgorot).toBe(0);
    expect(out.annualGapAgorot).toBe(0);
    expect(out.findings.every((f) => f.status === "ok")).toBe(true);
  });

  it("flags pay below minimum wage with the monthly gap", () => {
    const out = auditPayslip({ ...base, monthlyBaseAgorot: 600_000 });
    const f = out.findings.find((x) => x.id === "minWage")!;
    expect(f.status).toBe("shortfall");
    expect(f.monthlyAgorot).toBe(MIN_WAGE_MONTHLY_AGOROT - 600_000);
  });

  it("pro-rates the minimum wage by employment scope", () => {
    // Half-time at half the monthly minimum is fine.
    const out = auditPayslip({
      ...base,
      scope: 0.5,
      monthlyBaseAgorot: Math.round(MIN_WAGE_MONTHLY_AGOROT * 0.5),
      employerPensionAgorot: Math.round((MIN_WAGE_MONTHLY_AGOROT * 0.5 * 1250) / 10000),
      havraaPaidAgorot: Math.round(6 * HAVRAA_DAY_AGOROT * 0.5),
    });
    expect(out.findings.find((x) => x.id === "minWage")!.status).toBe("ok");
  });

  it("marks pension as missing when the slip shows none", () => {
    const out = auditPayslip({ ...base, pensionShown: false });
    const f = out.findings.find((x) => x.id === "pension")!;
    expect(f.status).toBe("missing");
    expect(f.monthlyAgorot).toBe(Math.round((MIN_WAGE_MONTHLY_AGOROT * 1250) / 10000));
  });

  it("flags a pension contribution that is too low", () => {
    const out = auditPayslip({ ...base, employerPensionAgorot: 10_000 });
    expect(out.findings.find((x) => x.id === "pension")!.status).toBe("shortfall");
  });

  it("flags missing convalescence pay and sums the annual gap", () => {
    const out = auditPayslip({ ...base, havraaPaid: false });
    const f = out.findings.find((x) => x.id === "havraa")!;
    expect(f.status).toBe("missing");
    expect(f.annualAgorot).toBe(6 * HAVRAA_DAY_AGOROT);
    expect(out.annualGapAgorot).toBe(6 * HAVRAA_DAY_AGOROT);
  });

  it("does not expect convalescence pay under one year of seniority", () => {
    const out = auditPayslip({ ...base, seniorityYears: 0, havraaPaid: false });
    expect(out.findings.find((x) => x.id === "havraa")!.status).toBe("ok");
  });

  it("tolerates tiny rounding differences without flagging", () => {
    const out = auditPayslip({ ...base, monthlyBaseAgorot: MIN_WAGE_MONTHLY_AGOROT - 500 });
    expect(out.findings.find((x) => x.id === "minWage")!.status).toBe("ok");
  });
});

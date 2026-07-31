import { describe, expect, it } from "vitest";
import {
  assessLatePayment,
  buildLatePaymentDemandLetter,
  DEFAULT_PAYMENT_TERM_DAYS,
  LATE_INTEREST_THRESHOLD_DAYS,
} from "./latePaymentClaim";

describe("assessLatePayment", () => {
  it("is not late before the statutory term has elapsed", () => {
    const status = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-01-20"),
    });
    expect(status?.isLate).toBe(false);
    expect(status?.daysLate).toBe(0);
  });

  it("flags as late once the default 45-day term has passed", () => {
    const status = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-03-01"), // 59 days later, past the 45-day term
    });
    expect(status?.termDays).toBe(DEFAULT_PAYMENT_TERM_DAYS);
    expect(status?.isLate).toBe(true);
    expect(status!.daysLate).toBeGreaterThan(0);
  });

  it("respects an explicit agreed term over the statutory default", () => {
    const status = assessLatePayment({
      invoiceDate: "2026-01-01",
      agreedTermDays: 14,
      now: new Date("2026-01-20"), // 19 days later — late against a 14-day term
    });
    expect(status?.termDays).toBe(14);
    expect(status?.isLate).toBe(true);
  });

  it("does not flag statutory interest until the delay exceeds the threshold", () => {
    const justOverDue = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-02-16"), // 46 days — 1 day past the 45-day term, not yet 30 days late
    });
    expect(justOverDue?.isLate).toBe(true);
    expect(justOverDue?.interestApplies).toBe(false);

    const wellOverDue = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-04-01"), // well past both the term and the 30-day interest threshold
    });
    expect(wellOverDue!.daysLate).toBeGreaterThan(LATE_INTEREST_THRESHOLD_DAYS);
    expect(wellOverDue?.interestApplies).toBe(true);
  });

  it("returns null for an unparsable invoice date rather than throwing", () => {
    expect(assessLatePayment({ invoiceDate: "not-a-date" })).toBeNull();
  });
});

describe("buildLatePaymentDemandLetter", () => {
  it("cites the real law and states the days late, without inventing an interest figure", () => {
    const status = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-04-01"),
    })!;
    const letter = buildLatePaymentDemandLetter({
      supplierName: "נועה לוי",
      clientName: "לקוח בע\"מ",
      invoiceNumber: "1042",
      invoiceAmountAgorot: 500_000,
      status,
    });
    expect(letter).toContain("חוק מוסר תשלומים לספקים, תשע\"ז-2017");
    expect(letter).toContain(String(status.daysLate));
    expect(letter).toContain("₪5,000");
    // The actual shekel value of interest/linkage is never computed or stated —
    // only that it applies and that the recipient should calculate it.
    expect(letter).not.toMatch(/ריבית[^.]*₪\d/);
  });

  it("only asserts interest already applies when the assessment says so", () => {
    const notYetInterest = assessLatePayment({
      invoiceDate: "2026-01-01",
      now: new Date("2026-02-16"),
    })!;
    const letter = buildLatePaymentDemandLetter({
      supplierName: "א",
      clientName: "ב",
      invoiceNumber: "1",
      invoiceAmountAgorot: 100_000,
      status: notYetInterest,
    });
    expect(letter).toContain("ככל שהתשלום יתעכב מעבר ל-30 יום");
    expect(letter).not.toContain("מאחר שהפיגור עולה על 30 יום");
  });
});

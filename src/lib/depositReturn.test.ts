import { describe, expect, it } from "vitest";
import {
  assessDepositReturn,
  buildDepositDemandLetter,
  checkDepositCap,
  DEPOSIT_RETURN_DEADLINE_DAYS,
  MAX_DEPOSIT_MONTHS_RENT,
} from "./depositReturn";

describe("assessDepositReturn", () => {
  it("is not late before the 60-day deadline has elapsed", () => {
    const status = assessDepositReturn({
      vacateDate: "2026-01-01",
      now: new Date("2026-01-20"),
    });
    expect(status?.isLate).toBe(false);
    expect(status?.daysLate).toBe(0);
  });

  it("flags as late once the 60-day deadline has passed", () => {
    const status = assessDepositReturn({
      vacateDate: "2026-01-01",
      now: new Date("2026-04-01"), // 90 days later, well past 60
    });
    expect(status?.isLate).toBe(true);
    expect(status!.daysLate).toBeGreaterThan(0);
  });

  it("is exactly on the boundary at day 60 — not yet late", () => {
    const status = assessDepositReturn({
      vacateDate: "2026-01-01",
      now: new Date("2026-03-02"), // 2026-01-01 + 60 days
    });
    expect(status?.isLate).toBe(false);
  });

  it("returns null for an unparsable vacate date rather than throwing", () => {
    expect(assessDepositReturn({ vacateDate: "not-a-date" })).toBeNull();
  });
});

describe("checkDepositCap", () => {
  it("flags a deposit above the 3-months'-rent cap", () => {
    const check = checkDepositCap(400_000, 100_000); // ₪4,000 deposit, ₪1,000 rent
    expect(check?.exceeds).toBe(true);
    expect(check?.capAgorot).toBe(100_000 * MAX_DEPOSIT_MONTHS_RENT);
  });

  it("does not flag a deposit within the cap", () => {
    const check = checkDepositCap(250_000, 100_000); // ₪2,500 deposit, ₪1,000 rent
    expect(check?.exceeds).toBe(false);
  });

  it("returns null without a real monthly rent to compare against", () => {
    expect(checkDepositCap(100_000, 0)).toBeNull();
  });
});

describe("buildDepositDemandLetter", () => {
  it("cites the real law and states the days late, without inventing an interest figure", () => {
    const status = assessDepositReturn({
      vacateDate: "2026-01-01",
      now: new Date("2026-04-01"),
    })!;
    const letter = buildDepositDemandLetter({
      tenantName: "נועה לוי",
      landlordName: "יוסי כהן",
      propertyAddress: "הרצל 10, תל אביב",
      depositAmountAgorot: 500_000,
      status,
    });
    expect(letter).toContain("חוק השכירות והשאילה");
    expect(letter).toContain("שכירות הוגנת");
    expect(letter).toContain(String(DEPOSIT_RETURN_DEADLINE_DAYS));
    expect(letter).toContain(String(status.daysLate));
    expect(letter).toContain("₪5,000");
    expect(letter).not.toMatch(/ריבית[^.]*₪\d/);
  });
});

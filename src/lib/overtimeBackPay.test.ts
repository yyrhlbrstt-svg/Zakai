import { describe, expect, it } from "vitest";
import {
  computeOvertimeBackPay,
  buildOvertimeDemandLetter,
  OVERTIME_TIER1_RATE_BPS,
  OVERTIME_TIER2_RATE_BPS,
  TIER1_DAILY_HOURS,
  LOOKBACK_YEARS_MAX,
} from "./overtimeBackPay";

describe("computeOvertimeBackPay", () => {
  it("pays the first two overtime hours at 125% and the rest at 150%", () => {
    // ₪40/hr, 3 overtime hours/day: 2h @ 125% + 1h @ 150%.
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 3,
      daysPerMonth: 1,
      monthsWorked: 1,
    });
    const tier1 = Math.round((4000 * OVERTIME_TIER1_RATE_BPS) / 10_000); // 5000
    const tier2 = Math.round((4000 * OVERTIME_TIER2_RATE_BPS) / 10_000); // 6000
    expect(result.tier1HoursDaily).toBe(2);
    expect(result.tier2HoursDaily).toBe(1);
    expect(result.dailyPayAgorot).toBe(2 * tier1 + 1 * tier2);
  });

  it("only uses tier 1 when daily overtime is within the first two hours", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1.5,
      daysPerMonth: 1,
      monthsWorked: 1,
    });
    expect(result.tier1HoursDaily).toBe(1.5);
    expect(result.tier2HoursDaily).toBe(0);
  });

  it("multiplies daily pay by days/month and months worked", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1,
      daysPerMonth: 22,
      monthsWorked: 6,
    });
    expect(result.monthlyPayAgorot).toBe(result.dailyPayAgorot * 22);
    expect(result.totalAgorot).toBe(result.monthlyPayAgorot * 6);
    expect(result.capped).toBe(false);
  });

  it("caps the claim at the statutory 7-year lookback and flags it", () => {
    const totalMonths = LOOKBACK_YEARS_MAX * 12;
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1,
      daysPerMonth: 20,
      monthsWorked: totalMonths + 24, // 9 years worked, only 7 claimable
    });
    expect(result.monthsCounted).toBe(totalMonths);
    expect(result.capped).toBe(true);
    expect(result.totalAgorot).toBe(result.monthlyPayAgorot * totalMonths);
  });

  it("does not cap a claim within the lookback window", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1,
      daysPerMonth: 20,
      monthsWorked: 12,
    });
    expect(result.capped).toBe(false);
    expect(result.monthsCounted).toBe(12);
  });

  it("treats negative or missing inputs as zero rather than throwing", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: -100,
      dailyOvertimeHours: -1,
      daysPerMonth: -5,
      monthsWorked: -3,
    });
    expect(result.dailyPayAgorot).toBe(0);
    expect(result.totalAgorot).toBe(0);
    expect(result.monthsCounted).toBe(0);
  });

  it("returns zero for zero overtime hours", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 0,
      daysPerMonth: 22,
      monthsWorked: 12,
    });
    expect(result.dailyPayAgorot).toBe(0);
    expect(result.totalAgorot).toBe(0);
  });
});

describe("buildOvertimeDemandLetter", () => {
  it("cites the real statutory section and includes the computed total", () => {
    const result = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 3,
      daysPerMonth: 20,
      monthsWorked: 12,
    });
    const letter = buildOvertimeDemandLetter({
      employeeName: "דנה כהן",
      employerName: "חברת דוגמה בע\"מ",
      monthsWorked: 12,
      result,
    });
    expect(letter).toContain("סעיף 16 לחוק שעות עבודה ומנוחה");
    expect(letter).toContain("125%");
    expect(letter).toContain("150%");
    expect(letter).toContain("דנה כהן");
    expect(letter).toContain("חברת דוגמה בע\"מ");
    expect(letter).toContain("institutions"); // the footer link, appended once
  });

  it("adds the limitations-period note only when the claim was actually capped", () => {
    const uncapped = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1,
      daysPerMonth: 20,
      monthsWorked: 12,
    });
    const cappedResult = computeOvertimeBackPay({
      hourlyWageAgorot: 4000,
      dailyOvertimeHours: 1,
      daysPerMonth: 20,
      monthsWorked: LOOKBACK_YEARS_MAX * 12 + 24,
    });
    const uncappedLetter = buildOvertimeDemandLetter({
      employeeName: "א",
      employerName: "ב",
      monthsWorked: 12,
      result: uncapped,
    });
    const cappedLetter = buildOvertimeDemandLetter({
      employeeName: "א",
      employerName: "ב",
      monthsWorked: LOOKBACK_YEARS_MAX * 12 + 24,
      result: cappedResult,
    });
    expect(uncappedLetter).not.toContain("חוק ההתיישנות");
    expect(cappedLetter).toContain("חוק ההתיישנות, תשי\"ח-1958, סעיף 5");
  });
});

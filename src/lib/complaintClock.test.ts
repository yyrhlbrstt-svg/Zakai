import { describe, expect, it } from "vitest";
import {
  computeComplaintClock,
  parseComplaintDate,
  DOCUMENTED_WAIT_DAYS,
  BANK_EXTENDED_WAIT_DAYS,
} from "./complaintClock";

const day = (n: number) => new Date(2026, 5, 1 + n); // 1 June 2026 + n

describe("parseComplaintDate", () => {
  it("reads the DD/MM/YYYY the form asks for, and separators people actually type", () => {
    expect(parseComplaintDate("01/03/2026")?.getMonth()).toBe(2);
    expect(parseComplaintDate("1.3.2026")?.getDate()).toBe(1);
    expect(parseComplaintDate("15-11-2025")?.getFullYear()).toBe(2025);
  });

  it("returns null rather than guessing at anything it cannot read", () => {
    for (const bad of ["", "yesterday", "2026-03-01", "31/02/2026", "45/1/2026", "1/13/2026"]) {
      expect(parseComplaintDate(bad), bad).toBeNull();
    }
  });
});

describe("computeComplaintClock", () => {
  it("counts elapsed days and holds the sourced banking period", () => {
    expect(DOCUMENTED_WAIT_DAYS.bank).toBe(45);
    expect(BANK_EXTENDED_WAIT_DAYS).toBe(60);
    const c = computeComplaintClock("bank", day(0), day(10))!;
    expect(c.daysElapsed).toBe(10);
    expect(c.waitDays).toBe(45);
    expect(c.waitPassed).toBe(false);
    expect(c.daysRemaining).toBe(35);
  });

  it("flips exactly on the documented day", () => {
    expect(computeComplaintClock("bank", day(0), day(44))!.waitPassed).toBe(false);
    const on = computeComplaintClock("bank", day(0), day(45))!;
    expect(on.waitPassed).toBe(true);
    expect(on.daysRemaining).toBe(0);
  });

  it("invents no waiting period where none is verified", () => {
    for (const cat of ["telecom", "consumer"] as const) {
      const c = computeComplaintClock(cat, day(0), day(3))!;
      expect(c.waitDays).toBeNull();
      expect(c.waitPassed).toBe(false);
      expect(c.daysRemaining).toBe(0);
      expect(c.daysElapsed).toBe(3);
    }
  });

  it("refuses a future date instead of showing a negative clock", () => {
    expect(computeComplaintClock("bank", day(5), day(0))).toBeNull();
  });
});

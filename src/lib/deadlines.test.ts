import { describe, expect, it } from "vitest";
import {
  isReminderDue,
  daysUntil,
  normalizeRemindDaysBefore,
  computeClaimExpiry,
  DEFAULT_REMIND_DAYS_BEFORE,
  GENERAL_LIMITATION_YEARS,
} from "./deadlines";

describe("isReminderDue", () => {
  it("is not due long before the reminder window opens", () => {
    const due = isReminderDue({
      dueDate: new Date("2026-12-01"),
      remindDaysBefore: 14,
      notifiedAt: null,
    }, new Date("2026-10-01"));
    expect(due).toBe(false);
  });

  it("is due once inside the reminder window", () => {
    const due = isReminderDue({
      dueDate: new Date("2026-12-01"),
      remindDaysBefore: 14,
      notifiedAt: null,
    }, new Date("2026-11-25"));
    expect(due).toBe(true);
  });

  it("is still due if the due date itself has already passed and nobody was notified", () => {
    const due = isReminderDue({
      dueDate: new Date("2026-12-01"),
      remindDaysBefore: 14,
      notifiedAt: null,
    }, new Date("2026-12-15"));
    expect(due).toBe(true);
  });

  it("is never due again once notifiedAt is set", () => {
    const due = isReminderDue({
      dueDate: new Date("2026-12-01"),
      remindDaysBefore: 14,
      notifiedAt: new Date("2026-11-26"),
    }, new Date("2026-11-27"));
    expect(due).toBe(false);
  });
});

describe("daysUntil", () => {
  it("counts whole days forward", () => {
    expect(daysUntil(new Date("2026-12-10"), new Date("2026-12-01"))).toBe(9);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil(new Date("2026-12-01"), new Date("2026-12-10"))).toBe(-9);
  });
});

describe("normalizeRemindDaysBefore", () => {
  it("falls back to the default for zero, negative, or non-finite input", () => {
    expect(normalizeRemindDaysBefore(0)).toBe(DEFAULT_REMIND_DAYS_BEFORE);
    expect(normalizeRemindDaysBefore(-5)).toBe(DEFAULT_REMIND_DAYS_BEFORE);
    expect(normalizeRemindDaysBefore(NaN)).toBe(DEFAULT_REMIND_DAYS_BEFORE);
  });

  it("clamps an unreasonably large lead time", () => {
    expect(normalizeRemindDaysBefore(10000)).toBe(180);
  });

  it("passes through a sane value untouched", () => {
    expect(normalizeRemindDaysBefore(30)).toBe(30);
  });
});

describe("computeClaimExpiry", () => {
  it("adds the general 7-year limitation period to the event date", () => {
    expect(GENERAL_LIMITATION_YEARS).toBe(7);
    const expiry = computeClaimExpiry("2026-01-15");
    expect(expiry?.getUTCFullYear()).toBe(2033);
    expect(expiry?.getUTCMonth()).toBe(0); // January
    expect(expiry?.getUTCDate()).toBe(15);
  });

  it("returns null for an unparsable event date rather than throwing", () => {
    expect(computeClaimExpiry("not-a-date")).toBeNull();
  });

  it("handles a leap-day event date without throwing", () => {
    const expiry = computeClaimExpiry("2024-02-29");
    expect(expiry).not.toBeNull();
  });
});

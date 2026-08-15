import { describe, expect, it } from "vitest";
import { computeNoticeWindow } from "./noticeWindow";

/**
 * The date a renewal reminder must fire on.
 *
 * The contract checker used to set the reminder for `renewalDate`, which is
 * the date it is already too late: a contract renewing on 1 January with
 * sixty days' notice had to be acted on by 1 November, and the reminder said
 * "this renewed today". The notice period was already being extracted by the
 * analyzer — it was collected and then ignored.
 *
 * This locks the rule the component now follows: remind on `actBy` when both
 * numbers are known, and fall back to the renewal date only when the contract
 * states no notice period.
 */
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Exactly what the component computes before POSTing to /api/deadlines. */
function reminderDate(renewalDate: string | null, noticeDays: number | null, now: Date) {
  const w = computeNoticeWindow({ renewalDate, noticeDays, now });
  return w.actBy ? iso(w.actBy) : renewalDate;
}

describe("the reminder fires while something can still be done", () => {
  it("targets the notice deadline, not the renewal date", () => {
    expect(reminderDate("2027-01-01", 60, new Date("2026-08-08"))).toBe("2026-11-02");
  });

  it("handles a one-month notice period", () => {
    expect(reminderDate("2027-01-01", 30, new Date("2026-08-08"))).toBe("2026-12-02");
  });

  /**
   * A customary default guessed here would produce a confident deadline that
   * is wrong, and somebody would plan around it. The renewal date is at least
   * a date the contract actually states.
   */
  it("falls back to the renewal date when no notice period was stated", () => {
    expect(reminderDate("2027-01-01", null, new Date("2026-08-08"))).toBe("2027-01-01");
  });

  it("never invents a deadline with no renewal date", () => {
    expect(reminderDate(null, 60, new Date("2026-08-08"))).toBeNull();
  });

  it("is never later than the renewal date itself", () => {
    for (const days of [0, 1, 14, 30, 60, 90, 365]) {
      const d = reminderDate("2027-01-01", days, new Date("2026-08-08"))!;
      expect(d <= "2027-01-01", `${days} days' notice`).toBe(true);
    }
  });
});

describe("what the reader is told about the window", () => {
  it("calls a passed window missed rather than showing a negative countdown", () => {
    const w = computeNoticeWindow({
      renewalDate: "2026-09-01",
      noticeDays: 60,
      now: new Date("2026-08-08"),
    });
    // Act-by was 3 July; today is 8 August.
    expect(w.state).toBe("missed");
    expect(w.daysLeft).toBeLessThan(0);
  });

  it("says unknown, not open, when the contract does not state a notice period", () => {
    // "Open" would read as "you have time", which is a claim the document
    // does not support.
    const w = computeNoticeWindow({
      renewalDate: "2027-01-01",
      noticeDays: null,
      now: new Date("2026-08-08"),
    });
    expect(w.state).toBe("unknown");
    expect(w.actBy).toBeNull();
  });
});

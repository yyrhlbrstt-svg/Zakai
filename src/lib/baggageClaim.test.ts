import { describe, expect, it } from "vitest";
import { COMPLAINT_DAYS, baggageDeadline, baggageWindowState } from "./baggageClaim";

/**
 * The deadline is the fact most likely to decide a baggage claim: an airline
 * that can point at a missed one never has to argue about the money. Every
 * case here is about not stating a date that is wrong.
 */
describe("the Montreal Convention windows", () => {
  it("gives seven days to complain about damage", () => {
    expect(COMPLAINT_DAYS.damaged).toBe(7);
    expect(baggageDeadline("damaged", "2026-08-01")?.toISOString().slice(0, 10)).toBe("2026-08-08");
  });

  it("gives twenty-one days for delayed baggage", () => {
    expect(COMPLAINT_DAYS.delayed).toBe(21);
    expect(baggageDeadline("delayed", "2026-08-01")?.toISOString().slice(0, 10)).toBe("2026-08-22");
  });

  /**
   * A bag is not formally lost until the carrier says so or twenty-one days
   * pass, and the claim then runs on the two-year limitation period. Giving
   * it a short window would tell somebody with a live claim they were too
   * late.
   */
  it("gives lost baggage no short window at all", () => {
    expect(COMPLAINT_DAYS.lost).toBeNull();
    expect(baggageDeadline("lost", "2026-08-01")).toBeNull();
  });

  it("crosses a month boundary correctly", () => {
    expect(baggageDeadline("delayed", "2026-08-20")?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("returns nothing for a date it cannot read", () => {
    // A confidently wrong deadline in a letter to an airline is worse than
    // none: it hands them a date to hold the passenger to.
    for (const bad of ["", "next tuesday", "01/08/2026", "2026-13-01", "2026-02-30"]) {
      expect(baggageDeadline("damaged", bad), bad).toBeNull();
    }
  });
});

describe("whether the window has closed", () => {
  it("is in time on the deadline itself", () => {
    expect(baggageWindowState("damaged", "2026-08-01", new Date("2026-08-08T23:00:00Z"))).toBe(
      "in_time",
    );
  });

  it("is closed the day after", () => {
    expect(baggageWindowState("damaged", "2026-08-01", new Date("2026-08-09T01:00:00Z"))).toBe(
      "closed",
    );
  });

  /**
   * "Unknown" rather than "in time" when there is nothing to check. A claim
   * nobody can date is not one anybody should be told is safe.
   */
  it("says unknown for a claim with no window, and for an unreadable date", () => {
    expect(baggageWindowState("lost", "2026-08-01")).toBe("unknown");
    expect(baggageWindowState("damaged", "whenever")).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeContractAnalysis, MAX_CLAUSES } from "./contractAnalysis";

describe("normalizeContractAnalysis", () => {
  it("passes through a well-formed response", () => {
    const result = normalizeContractAnalysis({
      readable: true,
      clauses: [
        { quote: "Price fixed for 12 months", risk: "green", explanation: "You're protected from a mid-year hike." },
        { quote: "Late by one day incurs a ₪500 penalty", risk: "red", explanation: "A single late payment costs ₪500." },
      ],
    });
    expect(result.readable).toBe(true);
    expect(result.clauses).toHaveLength(2);
    expect(result.clauses[0].risk).toBe("green");
    expect(result.clauses[1].risk).toBe("red");
  });

  it("drops a clause missing any required field", () => {
    const result = normalizeContractAnalysis({
      readable: true,
      clauses: [
        { quote: "Something", risk: "green" }, // no explanation
        { risk: "red", explanation: "Missing the quote" }, // no quote
        { quote: "Fine", explanation: "No risk given" }, // no risk
        { quote: "Real one", risk: "green", explanation: "Kept" },
      ],
    });
    expect(result.clauses).toHaveLength(1);
    expect(result.clauses[0].quote).toBe("Real one");
  });

  it("rejects a risk value outside the closed green/red set", () => {
    const result = normalizeContractAnalysis({
      readable: true,
      clauses: [{ quote: "x", risk: "yellow", explanation: "not a real risk value" }],
    });
    expect(result.clauses).toHaveLength(0);
  });

  it("caps the number of clauses at MAX_CLAUSES", () => {
    const clauses = Array.from({ length: MAX_CLAUSES + 15 }, (_, i) => ({
      quote: `clause ${i}`,
      risk: i % 2 === 0 ? "green" : "red",
      explanation: `explanation ${i}`,
    }));
    const result = normalizeContractAnalysis({ readable: true, clauses });
    expect(result.clauses).toHaveLength(MAX_CLAUSES);
  });

  it("truncates an oversized field rather than passing it through unbounded", () => {
    const huge = "x".repeat(10_000);
    const result = normalizeContractAnalysis({
      readable: true,
      clauses: [{ quote: huge, risk: "red", explanation: huge }],
    });
    expect(result.clauses[0].quote.length).toBeLessThan(huge.length);
    expect(result.clauses[0].explanation.length).toBeLessThan(huge.length);
  });

  it("reports not readable, empty clauses, for a non-object response", () => {
    const empty = {
      clauses: [],
      readable: false,
      autoRenews: false,
      renewalDate: null,
      noticeDays: null,
    };
    expect(normalizeContractAnalysis(null)).toEqual(empty);
    expect(normalizeContractAnalysis("a string")).toEqual(empty);
    expect(normalizeContractAnalysis(42)).toEqual(empty);
  });

  it("reports not readable when the model says so, even with no clauses", () => {
    const result = normalizeContractAnalysis({ readable: false, clauses: [] });
    expect(result.readable).toBe(false);
    expect(result.clauses).toEqual([]);
  });

  it("tolerates clauses not being an array at all", () => {
    const result = normalizeContractAnalysis({ readable: true, clauses: "not an array" });
    expect(result.clauses).toEqual([]);
  });

  it("passes through a well-formed renewal date", () => {
    const result = normalizeContractAnalysis({
      readable: true,
      clauses: [],
      autoRenews: true,
      renewalDate: "2027-03-15",
    });
    expect(result.autoRenews).toBe(true);
    expect(result.renewalDate).toBe("2027-03-15");
  });

  it("rejects a renewal date in the wrong shape", () => {
    for (const bad of ["15/03/2027", "next month", "2027-3-15", "", 20270315]) {
      expect(normalizeContractAnalysis({ readable: true, clauses: [], renewalDate: bad }).renewalDate).toBeNull();
    }
  });

  it("rejects a calendar date that doesn't actually exist (Date silently rolls it over)", () => {
    // Feb 30 rolls into March — must not hand a reminder-scheduler a lie.
    expect(
      normalizeContractAnalysis({ readable: true, clauses: [], renewalDate: "2026-02-30" }).renewalDate,
    ).toBeNull();
  });

  it("defaults autoRenews/renewalDate absent from the model response", () => {
    const result = normalizeContractAnalysis({ readable: true, clauses: [] });
    expect(result.autoRenews).toBe(false);
    expect(result.renewalDate).toBeNull();
  });
});

describe("noticeDays — the number that decides whether a term rolls", () => {
  /**
   * A renewal date without a notice period tells you when it is already too
   * late. This is the figure that turns "renews 1 January" into "act by
   * 2 November", and it is stated separately in almost every contract.
   */
  it("keeps a plausible notice period", () => {
    expect(normalizeContractAnalysis({ readable: true, noticeDays: 60 }).noticeDays).toBe(60);
    expect(normalizeContractAnalysis({ readable: true, noticeDays: 0 }).noticeDays).toBe(0);
  });

  it("rounds a fractional value rather than carrying it into a date", () => {
    expect(normalizeContractAnalysis({ readable: true, noticeDays: 29.6 }).noticeDays).toBe(30);
  });

  it("drops values that are a misreading rather than a term", () => {
    // Negative, absurd, or non-numeric: letting one through would put the
    // deadline in the wrong place, which is the one failure this cannot afford.
    for (const bad of [-1, 5000, Number.NaN, "60", null, undefined]) {
      expect(
        normalizeContractAnalysis({ readable: true, noticeDays: bad as unknown }).noticeDays,
        String(bad),
      ).toBeNull();
    }
  });
});

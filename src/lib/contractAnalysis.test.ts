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
    expect(normalizeContractAnalysis(null)).toEqual({ clauses: [], readable: false });
    expect(normalizeContractAnalysis("a string")).toEqual({ clauses: [], readable: false });
    expect(normalizeContractAnalysis(42)).toEqual({ clauses: [], readable: false });
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
});

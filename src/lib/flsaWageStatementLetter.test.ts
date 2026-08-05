import { describe, expect, it } from "vitest";
import { buildFlsaWageStatementLetter } from "./flsaWageStatementLetter";

describe("buildFlsaWageStatementLetter", () => {
  it("cites the FLSA, addresses the named employer, and includes the pay period", () => {
    const letter = buildFlsaWageStatementLetter({
      employeeName: "Morgan Diaz",
      employerName: "Acme Logistics",
      payPeriod: "March 2026",
      details: "I worked six Saturdays that never appeared on my pay stub.",
    });
    expect(letter.subject).toContain("March 2026");
    expect(letter.body).toContain("Fair Labor Standards Act");
    expect(letter.body).toContain("Acme Logistics");
    expect(letter.body).toContain("March 2026");
    expect(letter.body).toContain("six Saturdays");
  });

  it("falls back to bracketed placeholders rather than empty strings", () => {
    const letter = buildFlsaWageStatementLetter({
      employeeName: "",
      employerName: "",
      payPeriod: "",
    });
    expect(letter.body).toContain("[Your name]");
    expect(letter.body).toContain("[Employer name]");
    expect(letter.body).toContain("[pay period]");
  });

  it("omits the extra-details paragraph when none given", () => {
    const letter = buildFlsaWageStatementLetter({
      employeeName: "Sam",
      employerName: "Beta Co",
      payPeriod: "Q1 2026",
    });
    expect(letter.body.trim().endsWith("Sam")).toBe(true);
  });
});

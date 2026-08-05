import { describe, expect, it } from "vitest";
import { buildFdcpaValidationLetter } from "./fdcpaValidationLetter";

describe("buildFdcpaValidationLetter", () => {
  it("cites 15 U.S.C. § 1692g and never asks for an SSN or taxpayer ID", () => {
    const letter = buildFdcpaValidationLetter({
      customerName: "Jordan Lee",
      collectorName: "Acme Collections",
      referenceNumber: "REF-4471",
      details: "The account was already paid off in 2024.",
    });
    expect(letter.subject).toContain("15 U.S.C. § 1692g");
    expect(letter.body).toContain("15 U.S.C. § 1692g");
    expect(letter.body).toContain("REF-4471");
    expect(letter.body).toContain("already paid off in 2024");
    expect(letter.body).not.toMatch(/social security|SSN|taxpayer/i);
  });

  it("falls back to bracketed placeholders rather than empty strings", () => {
    const letter = buildFdcpaValidationLetter({ customerName: "", collectorName: "" });
    expect(letter.body).toContain("[Your name]");
    expect(letter.body).toContain("[Collector name]");
  });

  it("omits the reference-number and details lines when not given", () => {
    const letter = buildFdcpaValidationLetter({
      customerName: "Sam",
      collectorName: "Beta Recovery",
    });
    expect(letter.body).not.toContain("reference/account number");
  });
});

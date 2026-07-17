import { describe, it, expect } from "vitest";
import { buildFlightDemandLetter } from "./flightLetter";

const base = {
  passengerName: "דנה כהן",
  airline: "אל על",
  flightNumber: "LY315",
  flightDate: "12/06/2026",
  route: "תל אביב – לונדון",
};

describe("buildFlightDemandLetter", () => {
  it("Israeli law, long delay: cites the law, the ₪ amount and all three remedies", () => {
    const letter = buildFlightDemandLetter({
      ...base,
      jurisdiction: "il",
      disruption: { kind: "delay", delayHours: 9, tier: "medium" },
    });
    expect(letter).toContain('חוק שירותי תעופה');
    expect(letter).toContain("2,390");
    expect(letter).toContain("יותר מ-8 שעות");
    expect(letter).toContain("השבת התמורה");
    expect(letter).toContain("דנה כהן");
    expect(letter).toContain("LY315");
    expect(letter).toContain("21 ימים");
  });

  it("EU jurisdiction cites EC261 and euro amounts", () => {
    const letter = buildFlightDemandLetter({
      ...base,
      jurisdiction: "eu",
      disruption: { kind: "delay", delayHours: 4, tier: "long" },
    });
    expect(letter).toContain("261/2004");
    expect(letter).toContain("€600");
  });

  it("cancellation with 14+ days notice demands refund but no fixed compensation", () => {
    const letter = buildFlightDemandLetter({
      ...base,
      jurisdiction: "il",
      disruption: { kind: "cancelled", noticeDaysAhead: 20, tier: "long" },
    });
    expect(letter).not.toContain("3,580");
    expect(letter).toContain("השבת התמורה");
    expect(letter).toContain("14 ימים או יותר");
  });
});

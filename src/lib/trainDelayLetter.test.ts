import { describe, expect, it } from "vitest";
import { buildTrainDelayLetter } from "./trainDelayLetter";

describe("buildTrainDelayLetter", () => {
  it("cites the operator's own compensation procedure, not a statute", () => {
    const letter = buildTrainDelayLetter({
      customerName: "אורי",
      trainLine: "תל אביב - חיפה",
      travelDate: "01/08/2026",
      delayMinutes: 45,
      ticketPriceShekels: 27.5,
    });
    expect(letter.body).toContain("נוהל פיצוי הנוסעים המפורסם של רכבת ישראל");
    expect(letter.body).toContain("45 דקות");
    expect(letter.body).toContain("₪27.50");
  });

  it("never invents a claimed amount or a compensation formula when none is given", () => {
    const letter = buildTrainDelayLetter({
      customerName: "מיכל",
      trainLine: "",
      travelDate: "02/08/2026",
    });
    expect(letter.body).not.toContain("₪");
    expect(letter.body).not.toMatch(/%|אחוז/);
  });

  it("includes the passenger's own claimed amount only when they supplied one", () => {
    const letter = buildTrainDelayLetter({
      customerName: "מיכל",
      trainLine: "",
      travelDate: "02/08/2026",
      claimedAmountShekels: 40,
    });
    expect(letter.body).toContain("₪40");
  });

  it("falls back to a placeholder passenger name rather than an empty string", () => {
    const letter = buildTrainDelayLetter({ customerName: "", trainLine: "", travelDate: "" });
    expect(letter.body).toContain("הנוסע/ת");
  });
});

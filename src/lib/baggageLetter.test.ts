import { describe, expect, it } from "vitest";
import { buildBaggageClaimLetter } from "./baggageLetter";

describe("buildBaggageClaimLetter", () => {
  it("builds a lost-baggage letter citing the PIR and the Montreal cap", () => {
    const letter = buildBaggageClaimLetter({
      customerName: "דנה",
      airline: "El Al",
      pirNumber: "TLV12345",
      flightDate: "01/08/2026",
      disruptionType: "lost",
      essentialPurchasesShekels: 850,
      description: "מזוודה לא הגיעה בנחיתה",
    });
    expect(letter.subject).toContain("אובדן");
    expect(letter.subject).toContain("TLV12345");
    expect(letter.body).toContain("El Al");
    expect(letter.body).toContain("אבדה");
    expect(letter.body).toContain("1,131");
    expect(letter.body).toContain("₪850");
  });

  it("builds a delayed-baggage letter without inventing an amount when none is given", () => {
    const letter = buildBaggageClaimLetter({
      customerName: "יוסי",
      airline: "Israir",
      pirNumber: "",
      flightDate: "02/08/2026",
      disruptionType: "delayed",
    });
    expect(letter.subject).toContain("עיכוב");
    expect(letter.body).toContain("עוכבה");
    expect(letter.body).not.toContain("₪");
  });

  it("falls back to a placeholder name/airline rather than an empty string", () => {
    const letter = buildBaggageClaimLetter({
      customerName: "",
      airline: "",
      pirNumber: "",
      flightDate: "",
      disruptionType: "delayed",
    });
    expect(letter.body).toContain("הלקוח/ה");
    expect(letter.body).toContain("חברת התעופה");
  });
});

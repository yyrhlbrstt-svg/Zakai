import { describe, expect, it } from "vitest";
import { buildVaadBaitLetter } from "./vaadBaitLetter";

describe("buildVaadBaitLetter", () => {
  it("cites the Land Law and never promises a refund or reduction", () => {
    const letter = buildVaadBaitLetter({
      customerName: "אלון",
      buildingAddress: "הרצל 12, תל אביב",
      unexplainedCharge: "חיוב שיפוץ חדר מדרגות",
      chargeAmountShekels: 850,
    });
    expect(letter.body).toContain("חוק המקרקעין, התשכ\"ט-1969");
    expect(letter.body).toContain("₪850.00");
    expect(letter.body).not.toMatch(/החזר|יוחזר|מובטח/);
  });

  it("omits the amount line when none was given", () => {
    const letter = buildVaadBaitLetter({
      customerName: "נעם",
      buildingAddress: "",
      unexplainedCharge: "חיוב לא ברור בדוח האחרון",
    });
    expect(letter.body).not.toContain("₪");
  });

  it("falls back to placeholder text rather than empty strings", () => {
    const letter = buildVaadBaitLetter({
      customerName: "",
      buildingAddress: "",
      unexplainedCharge: "",
    });
    expect(letter.body).toContain("הדייר/ת");
    expect(letter.body).toContain("חיוב שלא צורף לו פירוט");
  });
});

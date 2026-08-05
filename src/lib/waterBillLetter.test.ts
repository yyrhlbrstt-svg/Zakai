import { describe, expect, it } from "vitest";
import { buildWaterBillCreditLetter } from "./waterBillLetter";

describe("buildWaterBillCreditLetter", () => {
  it("cites the tariff rules and never promises a guaranteed amount or approval", () => {
    const letter = buildWaterBillCreditLetter({
      customerName: "דנה",
      accountNumber: "77821",
      repairDate: "01/08/2026",
      billAmountShekels: 640,
      hasRepairProof: true,
    });
    expect(letter.body).toContain("תעריפים לשירותי מים וביוב), התש\"ע-2009");
    expect(letter.body).toContain("₪640.00");
    expect(letter.body).toContain("ככל שתאושר");
    expect(letter.body).not.toMatch(/מובטח|בוודאות תאושר/);
  });

  it("states the applicant is still obtaining repair proof when none is confirmed yet", () => {
    const letter = buildWaterBillCreditLetter({
      customerName: "רון",
      accountNumber: "",
      repairDate: "02/08/2026",
      hasRepairProof: false,
    });
    expect(letter.body).toContain("פועל/ת להשגת אישור תיקון");
    expect(letter.body).not.toContain("₪");
  });

  it("falls back to a placeholder name rather than an empty string", () => {
    const letter = buildWaterBillCreditLetter({
      customerName: "",
      accountNumber: "",
      repairDate: "",
      hasRepairProof: false,
    });
    expect(letter.body).toContain("הלקוח/ה");
  });
});

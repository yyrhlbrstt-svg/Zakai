import { describe, expect, it } from "vitest";
import { buildBankFeeLetter } from "./bankFeeLetter";

describe("buildBankFeeLetter", () => {
  it("includes bank, amount and kind", () => {
    const { subject, body } = buildBankFeeLetter({
      customerName: "ישראל ישראלי",
      bank: "בנק לאומי",
      accountLast4: "1234",
      feeKind: "account_mgmt",
      amountShekels: 29,
      chargeDate: "01/07/2026",
    });
    expect(subject).toContain("עמלה");
    expect(body).toContain("בנק לאומי");
    expect(body).toContain("ישראל ישראלי");
    expect(body).toContain("1234");
    expect(body).toContain("29");
    expect(body).toContain("זכאי");
  });

  it("falls back when optional fields missing", () => {
    const { body } = buildBankFeeLetter({
      customerName: "",
      bank: "הפועלים",
      feeKind: "atm",
    });
    expect(body).toContain("הפועלים");
    expect(body).toContain("הלקוח/ה");
  });
});

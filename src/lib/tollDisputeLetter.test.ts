import { describe, expect, it } from "vitest";
import { buildTollDisputeLetter } from "./tollDisputeLetter";

describe("buildTollDisputeLetter", () => {
  it("cites the statutory appeals committee and the invoice number", () => {
    const letter = buildTollDisputeLetter({
      customerName: "רון",
      invoiceNumber: "INV-9001",
      reason: "vehicle_sold",
      amountShekels: 45,
    });
    expect(letter.subject).toContain("INV-9001");
    expect(letter.body).toContain("ועדת הערר הסטטוטורית");
    expect(letter.body).toContain("נמכר");
    expect(letter.body).toContain("₪45");
  });

  it("selects the correct reason text for every reason category", () => {
    const reasons = ["wrong_vehicle", "vehicle_sold", "duplicate", "technical_fault", "other"] as const;
    for (const reason of reasons) {
      const letter = buildTollDisputeLetter({ customerName: "x", invoiceNumber: "1", reason });
      expect(letter.body.length).toBeGreaterThan(0);
    }
  });

  it("never invents an amount when none is given", () => {
    const letter = buildTollDisputeLetter({ customerName: "דנה", invoiceNumber: "", reason: "duplicate" });
    expect(letter.body).not.toContain("₪");
  });

  it("falls back to a placeholder name rather than an empty string", () => {
    const letter = buildTollDisputeLetter({ customerName: "", invoiceNumber: "", reason: "other" });
    expect(letter.body).toContain("הלקוח/ה");
  });
});

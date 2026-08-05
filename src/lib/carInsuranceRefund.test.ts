import { describe, expect, it } from "vitest";
import { buildCarInsuranceRefundLetter } from "./carInsuranceRefund";

describe("buildCarInsuranceRefundLetter", () => {
  it("cites Insurance Contracts Law and asks for written amounts", () => {
    const letter = buildCarInsuranceRefundLetter({
      customerName: "נועה",
      insurer: "הפניקס",
      policyNumber: "P-1",
      premiumPaidShekels: 2400,
    });
    expect(letter.subject).toMatch(/החזר פרמיה/);
    expect(letter.body).toMatch(/חוק חוזי הביטוח/);
    expect(letter.body).toMatch(/₪2400/);
    expect(letter.body).toMatch(/זכאי/);
  });
});

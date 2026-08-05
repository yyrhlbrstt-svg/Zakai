import { describe, expect, it } from "vitest";
import { buildSlcOverpaymentLetter } from "./slcOverpaymentLetter";

describe("buildSlcOverpaymentLetter", () => {
  it("cites the 1998 regulations, addresses the real SLC address, and never asks for a National Insurance number", () => {
    const letter = buildSlcOverpaymentLetter({
      customerName: "Priya Shah",
      customerReference: "SLC-99881",
      accountDetails: "Plan 2, cleared balance in March, repayments continued for 4 more months",
    });
    expect(letter.body).toContain("Education (Student Loans) Regulations 1998");
    expect(letter.body).toContain("Student Loans Company");
    expect(letter.body).toContain("Glasgow G2 7JD");
    expect(letter.body).toContain("SLC-99881");
    expect(letter.body).toContain("cleared balance in March");
    expect(letter.body).not.toMatch(/national insurance|NI number/i);
  });

  it("falls back to bracketed placeholders rather than empty strings", () => {
    const letter = buildSlcOverpaymentLetter({ customerName: "", accountDetails: "" });
    expect(letter.body).toContain("[Your name]");
    expect(letter.body).toContain("[Plan type and repayment account details]");
  });

  it("omits the customer reference line when not given", () => {
    const letter = buildSlcOverpaymentLetter({ customerName: "Alex", accountDetails: "Plan 1 overpaid" });
    expect(letter.body).not.toContain("Customer reference");
  });
});

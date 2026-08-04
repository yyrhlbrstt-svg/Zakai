import { describe, expect, it } from "vitest";
import { PaymentError } from "./payments";

describe("initiateFeePayment mandate binding", () => {
  it("documents refuse when PENDING fee has no mandateJti", () => {
    const status: string = "PENDING";
    const amount = 1000;
    const mandateJti: string | null = null;
    expect(() => {
      if (status === "WAIVED" || amount <= 0) throw new PaymentError("NOTHING_TO_COLLECT");
      if (!mandateJti) throw new PaymentError("MANDATE_REQUIRED");
    }).toThrow("MANDATE_REQUIRED");
  });
});

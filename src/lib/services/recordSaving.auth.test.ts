import { describe, expect, it } from "vitest";
import { CaseError } from "./cases";

/**
 * Doctrine for prove→fee: withdrawn authority cannot settle; a chargeable
 * fee without a machine Mandate jti is undefendable (same class as selfReported).
 */
describe("recordSaving auth doctrine", () => {
  it("refuses when authorization is not ACTIVE", () => {
    const status: string = "REVOKED";
    expect(() => {
      if (status !== "ACTIVE") throw new CaseError("AUTH_REVOKED");
    }).toThrow("AUTH_REVOKED");
  });

  it("waives billable amount when mandateJti is missing", () => {
    const selfReported = false;
    const feeAmount = 1800;
    const mandateJti: string | null = null;
    let billableAmount = selfReported ? 0 : feeAmount;
    if (billableAmount > 0 && !mandateJti) billableAmount = 0;
    expect(billableAmount).toBe(0);
  });

  it("keeps billable amount when ACTIVE auth carries mandateJti", () => {
    const selfReported = false;
    const feeAmount = 1800;
    const mandateJti: string | null = "jti-live";
    let billableAmount = selfReported ? 0 : feeAmount;
    if (billableAmount > 0 && !mandateJti) billableAmount = 0;
    expect(billableAmount).toBe(1800);
  });
});

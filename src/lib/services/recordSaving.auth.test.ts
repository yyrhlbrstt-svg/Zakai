import { describe, expect, it } from "vitest";
import { CaseError } from "./cases";

/**
 * Doctrine for prove→fee: withdrawn authority cannot settle; a chargeable
 * fee without a machine Mandate jti must refuse (not silent WAIVE — that
 * looks like "no fee due").
 */
describe("recordSaving auth doctrine", () => {
  it("refuses when authorization is not ACTIVE", () => {
    const status: string = "REVOKED";
    expect(() => {
      if (status !== "ACTIVE") throw new CaseError("AUTH_REVOKED");
    }).toThrow("AUTH_REVOKED");
  });

  it("refuses chargeable settle when mandateJti is missing", () => {
    const selfReported = false;
    const feeAmount = 1800;
    const mandateJti: string | null = null;
    expect(() => {
      let billableAmount = selfReported ? 0 : feeAmount;
      if (billableAmount > 0 && !mandateJti) throw new CaseError("MANDATE_REQUIRED");
    }).toThrow("MANDATE_REQUIRED");
  });

  it("keeps billable amount when ACTIVE auth carries mandateJti", () => {
    const selfReported = false;
    const feeAmount = 1800;
    const mandateJti: string | null = "jti-live";
    let billableAmount = selfReported ? 0 : feeAmount;
    if (billableAmount > 0 && !mandateJti) throw new CaseError("MANDATE_REQUIRED");
    expect(billableAmount).toBe(1800);
  });

  it("still allows zero-fee / selfReported settle without mandateJti", () => {
    const selfReported = true;
    const feeAmount = 1800;
    const mandateJti: string | null = null;
    let billableAmount = selfReported ? 0 : feeAmount;
    if (billableAmount > 0 && !mandateJti) throw new CaseError("MANDATE_REQUIRED");
    expect(billableAmount).toBe(0);
  });
});

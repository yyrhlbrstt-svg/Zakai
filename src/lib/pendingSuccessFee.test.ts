import { describe, expect, it } from "vitest";
import { isPendingSuccessFee, pendingFeeDisplayShekels } from "./pendingSuccessFee";

describe("isPendingSuccessFee", () => {
  it("keeps sub-₪1 PENDING fees (18 agorot) as pending", () => {
    expect(isPendingSuccessFee({ amount: 18, status: "PENDING" })).toBe(true);
    expect(Math.round(18 / 100) > 0).toBe(false); // documents the old shekel-round bug
  });

  it("ignores paid / waived / zero", () => {
    expect(isPendingSuccessFee({ amount: 1800, status: "PAID" })).toBe(false);
    expect(isPendingSuccessFee({ amount: 0, status: "PENDING" })).toBe(false);
    expect(isPendingSuccessFee(null)).toBe(false);
  });
});

describe("pendingFeeDisplayShekels", () => {
  it("shows two decimals under ₪1", () => {
    expect(pendingFeeDisplayShekels(18)).toBe("0.18");
    expect(pendingFeeDisplayShekels(1800)).toBe("18");
  });
});

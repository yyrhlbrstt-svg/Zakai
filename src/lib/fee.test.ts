import { describe, it, expect } from "vitest";
import { computeFee, computeRecoveryFee, computeCaseSuccessFee, documentedRecoveryMinor, inboundProposedRemainingShekels, resolveInboundRecordAmountShekels, monthlySaving, FEE_RATE_BPS, previewSuccessFeeShekels } from "./fee";
import { shekelsToAgorot } from "./money";

describe("monthlySaving", () => {
  it("is the positive difference in agorot", () => {
    expect(monthlySaving(10000, 7000)).toBe(3000);
  });

  it("clamps to zero when the new amount is higher (no negative saving)", () => {
    expect(monthlySaving(7000, 10000)).toBe(0);
  });

  it("is zero when nothing changed", () => {
    expect(monthlySaving(10000, 10000)).toBe(0);
  });

  it("rejects non-integer agorot", () => {
    expect(() => monthlySaving(100.5, 50)).toThrow();
  });

  it("rejects negative inputs", () => {
    expect(() => monthlySaving(-1, 0)).toThrow();
  });
});

describe("computeFee — the money-critical path", () => {
  it("charges 18% of a documented saving", () => {
    // 100 ₪ -> 70 ₪ = 30 ₪ saving; fee = 18% = 5.40 ₪ = 540 agorot
    const fee = computeFee(shekelsToAgorot(100), shekelsToAgorot(70));
    expect(fee.savingMonthly).toBe(3000);
    expect(fee.amount).toBe(540);
    expect(fee.rateBps).toBe(FEE_RATE_BPS);
    expect(fee.chargeable).toBe(true);
  });

  it("charges nothing when there is no saving", () => {
    const fee = computeFee(shekelsToAgorot(70), shekelsToAgorot(70));
    expect(fee.savingMonthly).toBe(0);
    expect(fee.amount).toBe(0);
    expect(fee.chargeable).toBe(false);
  });

  it("charges nothing when the bill went up (never a negative charge)", () => {
    const fee = computeFee(shekelsToAgorot(70), shekelsToAgorot(120));
    expect(fee.amount).toBe(0);
    expect(fee.chargeable).toBe(false);
  });

  it("rounds a fractional-agora fee half-up", () => {
    // saving 37 ₪ = 3700 agorot; 18% = 666 agorot exactly (6.66 ₪)
    expect(computeFee(shekelsToAgorot(37), 0).amount).toBe(666);
    // saving 3701 agorot; 18% = 666.18 -> 666
    expect(computeFee(3701, 0).amount).toBe(666);
    // saving 3703 agorot; 18% = 666.54 -> 667
    expect(computeFee(3703, 0).amount).toBe(667);
  });

  it("treats a sub-1-agora fee as not chargeable", () => {
    // saving of 5 agorot; 18% = 0.9 -> rounds to 1 agora, chargeable
    expect(computeFee(5, 0).amount).toBe(1);
    // saving of 2 agorot; 18% = 0.36 -> rounds to 0, not chargeable
    const tiny = computeFee(2, 0);
    expect(tiny.amount).toBe(0);
    expect(tiny.chargeable).toBe(false);
  });

  it("honors an injected rate for future plans", () => {
    // 20% of 30 ₪ = 6 ₪
    expect(computeFee(shekelsToAgorot(100), shekelsToAgorot(70), 2000).amount).toBe(600);
  });

  it("rejects an invalid rate", () => {
    expect(() => computeFee(1000, 0, -1)).toThrow();
    expect(() => computeFee(1000, 0, 1.5)).toThrow();
  });
});

describe("computeRecoveryFee — lump-sum documented recovery", () => {
  it("charges 18% of recovered agorot", () => {
    const fee = computeRecoveryFee(shekelsToAgorot(5000));
    expect(fee.amount).toBe(90000);
  });

  it("is not chargeable on zero recovery", () => {
    expect(computeRecoveryFee(0).chargeable).toBe(false);
  });
});

describe("computeCaseSuccessFee", () => {
  it("lump basis uses recovery fee on full amount when new is zero", () => {
    const deposit = shekelsToAgorot(5000);
    const fee = computeCaseSuccessFee(deposit, 0, "lump");
    expect(fee.savingMonthly).toBe(deposit);
    expect(fee.amount).toBe(computeRecoveryFee(deposit).amount);
  });

  it("monthly basis matches computeFee", () => {
    const a = shekelsToAgorot(100);
    const b = shekelsToAgorot(70);
    expect(computeCaseSuccessFee(a, b, "monthly")).toEqual(computeFee(a, b));
  });
});

describe("previewSuccessFeeShekels", () => {
  it("shows 18% fee on documented monthly saving before confirm", () => {
    const preview = previewSuccessFeeShekels(100, 70, "monthly");
    expect(preview.savingShekels).toBe(30);
    expect(preview.feeShekels).toBe(Math.round((30 * FEE_RATE_BPS) / 10_000));
    expect(preview.chargeable).toBe(true);
  });

  it("is not chargeable when new >= original", () => {
    expect(previewSuccessFeeShekels(100, 100, "monthly").chargeable).toBe(false);
  });
});

describe("inboundProposedRemainingShekels", () => {
  it("passes monthly extract through", () => {
    expect(inboundProposedRemainingShekels("monthly", 100, 70)).toBe(70);
  });

  it("maps lump transfer amount to remaining owed", () => {
    expect(inboundProposedRemainingShekels("lump", 5000, 5000)).toBe(0);
    expect(inboundProposedRemainingShekels("lump", 5000, 3000)).toBe(2000);
  });
});

describe("resolveInboundRecordAmountShekels", () => {
  it("uses remaining balance directly on lump cases", () => {
    expect(resolveInboundRecordAmountShekels("lump", 5000, 2000, "remaining")).toBe(2000);
  });

  it("maps lump refund credits via original minus credit", () => {
    expect(resolveInboundRecordAmountShekels("lump", 5000, 1200, "refund")).toBe(3800);
  });

  it("passes monthly amounts through", () => {
    expect(resolveInboundRecordAmountShekels("monthly", 100, 70, "refund")).toBe(70);
  });
});

describe("documentedRecoveryMinor", () => {
  /**
   * This used to assert ×12 and the reversal is deliberate.
   *
   * It read "annualizes monthly savings only" and was satisfied by twelve
   * months recorded off a single verified bill, while `computeFee` charged 18%
   * of exactly one. The graph counted a year, the invoice counted a month, and
   * the field is called *documented* — eleven of those months were never
   * observed by anyone.
   */
  it("records only the cycles actually confirmed", () => {
    expect(documentedRecoveryMinor(1000, "monthly", 1)).toBe(1000);
    expect(documentedRecoveryMinor(1000, "monthly", 2)).toBe(3000);
    expect(documentedRecoveryMinor(1000, "monthly", 3)).toBe(6000);
  });

  it("defaults to one cycle — what settling a case actually establishes", () => {
    expect(documentedRecoveryMinor(1000, "monthly")).toBe(1000);
  });

  it("never claims a full year, at any depth", () => {
    for (const cycles of [1, 2, 3, 4, 10, 100]) {
      expect(documentedRecoveryMinor(1000, "monthly", cycles)).toBeLessThan(12000);
    }
  });

  it("leaves a lump recovery whole, whatever the cycle count", () => {
    for (const cycles of [1, 2, 5]) {
      expect(documentedRecoveryMinor(1000, "lump", cycles)).toBe(1000);
    }
  });
});

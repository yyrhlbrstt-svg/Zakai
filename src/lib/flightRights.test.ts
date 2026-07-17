import { describe, it, expect } from "vitest";
import {
  computeEntitlement,
  computeEntitlementEU,
  COMPENSATION_AGOROT,
  EU_COMPENSATION_EUR,
} from "./flightRights";

describe("computeEntitlement", () => {
  it("cancellation with 14+ days notice: refund only, no compensation", () => {
    const e = computeEntitlement({ kind: "cancelled", noticeDaysAhead: 14, tier: "long" });
    expect(e.compensationAgorot).toBe(0);
    expect(e.refundOrAlternative).toBe(true);
    expect(e.assistance).toBe(false);
    expect(e.noteKeys).toContain("noticeExempt");
  });

  it("short-notice cancellation: full package incl. distance-based compensation", () => {
    const e = computeEntitlement({ kind: "cancelled", noticeDaysAhead: 3, tier: "medium" });
    expect(e.assistance).toBe(true);
    expect(e.refundOrAlternative).toBe(true);
    expect(e.compensationAgorot).toBe(COMPENSATION_AGOROT.medium);
  });

  it("delay ladder: <2h nothing; 2-5h assistance; 5-8h + refund; 8h+ = cancellation", () => {
    expect(computeEntitlement({ kind: "delay", delayHours: 1, tier: "short" })).toMatchObject({
      assistance: false,
      refundOrAlternative: false,
      compensationAgorot: 0,
    });
    expect(computeEntitlement({ kind: "delay", delayHours: 3, tier: "short" })).toMatchObject({
      assistance: true,
      refundOrAlternative: false,
      compensationAgorot: 0,
    });
    expect(computeEntitlement({ kind: "delay", delayHours: 6, tier: "short" })).toMatchObject({
      assistance: true,
      refundOrAlternative: true,
      compensationAgorot: 0,
    });
    const long = computeEntitlement({ kind: "delay", delayHours: 9, tier: "long" });
    expect(long.compensationAgorot).toBe(COMPENSATION_AGOROT.long);
    expect(long.noteKeys).toContain("longDelayAsCancellation");
  });

  it("distance tiers order sanely", () => {
    expect(COMPENSATION_AGOROT.short).toBeLessThan(COMPENSATION_AGOROT.medium);
    expect(COMPENSATION_AGOROT.medium).toBeLessThan(COMPENSATION_AGOROT.long);
  });

  it("negative delay hours are clamped", () => {
    const e = computeEntitlement({ kind: "delay", delayHours: -5, tier: "short" });
    expect(e.compensationAgorot).toBe(0);
    expect(e.assistance).toBe(false);
  });
});

describe("computeEntitlementEU (EC261)", () => {
  it("compensates from a 3h arrival delay (Sturgeon), refund from 5h", () => {
    expect(computeEntitlementEU({ kind: "delay", delayHours: 2.5, tier: "medium" }).compensationEur).toBe(0);
    const at4 = computeEntitlementEU({ kind: "delay", delayHours: 4, tier: "medium" });
    expect(at4.compensationEur).toBe(400);
    expect(at4.refundOrAlternative).toBe(false);
    const at6 = computeEntitlementEU({ kind: "delay", delayHours: 6, tier: "long" });
    expect(at6.compensationEur).toBe(600);
    expect(at6.refundOrAlternative).toBe(true);
  });

  it("cancellation: 14+ days notice exempts compensation; short notice pays by tier", () => {
    expect(
      computeEntitlementEU({ kind: "cancelled", noticeDaysAhead: 20, tier: "long" }).compensationEur,
    ).toBe(0);
    expect(
      computeEntitlementEU({ kind: "cancelled", noticeDaysAhead: 2, tier: "short" }).compensationEur,
    ).toBe(EU_COMPENSATION_EUR.short);
  });
});

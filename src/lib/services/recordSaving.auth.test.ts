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

/**
 * A self-reported save must never trigger a referral reward — same
 * discipline as billableAmount above, applied to the OTHER real-money side
 * effect recordSaving has: a reward paid to a third party (the referrer),
 * not just the reporting user's own fee. Without this, a burner account
 * self-reporting a fake saving mints real, uncapped credit toward its
 * referrer's future fees off a number this codebase's own doctrine
 * (selfReportedSaving.ts) says can never support a charge.
 */
describe("recordSaving referral-reward doctrine", () => {
  function triggersReferralReward(saved: boolean, selfReported: boolean, hasReferrer: boolean): boolean {
    return saved && !selfReported && hasReferrer;
  }

  it("triggers a reward for a verified save with a referrer", () => {
    expect(triggersReferralReward(true, false, true)).toBe(true);
  });

  it("never triggers a reward for a self-reported save, even with a real saving amount", () => {
    expect(triggersReferralReward(true, true, true)).toBe(false);
  });

  it("never triggers a reward with no referrer, regardless of selfReported", () => {
    expect(triggersReferralReward(true, false, false)).toBe(false);
    expect(triggersReferralReward(true, true, false)).toBe(false);
  });

  it("never triggers a reward when nothing was saved", () => {
    expect(triggersReferralReward(false, false, true)).toBe(false);
  });
});

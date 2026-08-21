import { describe, expect, it } from "vitest";
import {
  CLAIM_SPEAK_THRESHOLD,
  decideClaim,
  partitionClaims,
  type ClaimCandidate,
} from "./claimGate";
import { getRight, rightForLetter } from "./rightsGraph/registry";

const allowAll = () => true;
const denyAll = () => false;

const base: ClaimCandidate = {
  kind: "recurring_charge",
  confidence: 0.9,
  actionHref: "/cancel",
};

describe("claim gate", () => {
  it("speaks when confidence is high and there is somewhere to go", () => {
    const v = decideClaim(base, allowAll);
    expect(v.speak).toBe(true);
  });

  it("is silent below the bar, and says which bar", () => {
    const v = decideClaim({ ...base, confidence: CLAIM_SPEAK_THRESHOLD - 0.01 }, allowAll);
    expect(v).toMatchObject({ speak: false, reason: "low_confidence" });
  });

  it("is silent with no immediate action, however sure we are", () => {
    expect(decideClaim({ ...base, confidence: 1, actionHref: null }, allowAll)).toMatchObject({
      speak: false,
      reason: "no_immediate_action",
    });
    // Whitespace is not an action path.
    expect(decideClaim({ ...base, confidence: 1, actionHref: "   " }, allowAll)).toMatchObject({
      speak: false,
      reason: "no_immediate_action",
    });
  });

  it("refuses a claim resting on an unverified right — the letter rule, inward", () => {
    const v = decideClaim({ ...base, rightId: "il.some.draft.right" }, denyAll);
    expect(v).toMatchObject({ speak: false, reason: "unverified_right" });
  });

  it("allows a claim that rests on no right at all, when it says so honestly", () => {
    // Arithmetic over the person's own statement is not a legal claim. It must
    // not have to name a right it does not use in order to be shown.
    const v = decideClaim({ ...base, rightId: null }, denyAll);
    expect(v.speak).toBe(true);
  });

  it("treats a non-finite confidence as zero rather than as high", () => {
    expect(decideClaim({ ...base, confidence: Number.NaN }, allowAll)).toMatchObject({
      speak: false,
      reason: "low_confidence",
    });
  });

  it("keeps the silenced half rather than discarding it", () => {
    const { speak, silent } = partitionClaims(
      [base, { ...base, confidence: 0.2 }, { ...base, actionHref: "" }],
      allowAll,
    );
    expect(speak).toHaveLength(1);
    expect(silent.map((s) => s.reason)).toEqual(["low_confidence", "no_immediate_action"]);
  });

  it("is stricter than the bar used for proposals a human then confirms", () => {
    // inboundDecision and proposedSaving both gate at 0.6, where the person is
    // the check. Nothing here may quietly drop to that.
    expect(CLAIM_SPEAK_THRESHOLD).toBeGreaterThan(0.6);
  });

  it("agrees with the outbound gate on the same right", () => {
    // The point of the gate is that it is the same rule. A right good enough
    // to send a letter about is good enough to mention; one that is not, is
    // not — asserted against the real registry, not a stub.
    const verified = (id: string) => {
      try {
        rightForLetter(id);
        return true;
      } catch {
        return false;
      }
    };
    const known = "il.consumer.31a.continued-billing-after-cancellation";
    expect(getRight(known)?.status).toBe("verified");
    expect(decideClaim({ ...base, rightId: known }, verified).speak).toBe(true);
    expect(decideClaim({ ...base, rightId: "il.not.a.right" }, verified)).toMatchObject({
      speak: false,
      reason: "unverified_right",
    });
  });
});

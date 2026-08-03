import { describe, expect, it } from "vitest";
import { consumerReferralFromSearchParams } from "./consumerReferralAttribution";

describe("consumerReferralFromSearchParams", () => {
  it("accepts alphanumeric ref", () => {
    const p = new URLSearchParams("ref=abc_12");
    expect(consumerReferralFromSearchParams(p)).toBe("abc_12");
  });

  it("rejects invalid", () => {
    expect(consumerReferralFromSearchParams(new URLSearchParams("ref=bad space"))).toBeNull();
  });
});

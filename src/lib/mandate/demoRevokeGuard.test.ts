import { describe, expect, it } from "vitest";
import { isVerifierReadinessDemoJti } from "./demoRevokeGuard";

describe("isVerifierReadinessDemoJti", () => {
  it("accepts readiness demo JTIs", () => {
    expect(isVerifierReadinessDemoJti("readiness_abc123def456")).toBe(true);
  });

  it("rejects live-looking JTIs", () => {
    expect(isVerifierReadinessDemoJti("auth_abc123def456")).toBe(false);
    expect(isVerifierReadinessDemoJti("pilot_abc123def456")).toBe(false);
    expect(isVerifierReadinessDemoJti("readiness_")).toBe(false);
    expect(isVerifierReadinessDemoJti("")).toBe(false);
  });
});

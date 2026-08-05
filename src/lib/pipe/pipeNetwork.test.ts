import { describe, expect, it } from "vitest";
import { scorePipeGravity } from "./pipeNetwork";

describe("scorePipeGravity", () => {
  it("empty when nothing moved", () => {
    expect(
      scorePipeGravity({
        mandatesIssued: 0,
        casesSent: 0,
        savingsProofs: 0,
        verifiedRecoveredMinor: 0,
      }).tier,
    ).toBe("empty");
  });

  it("signal then gravity then network", () => {
    expect(
      scorePipeGravity({
        mandatesIssued: 3,
        casesSent: 2,
        savingsProofs: 0,
        verifiedRecoveredMinor: 0,
      }).tier,
    ).toBe("signal");
    expect(
      scorePipeGravity({
        mandatesIssued: 25,
        casesSent: 20,
        savingsProofs: 1,
        verifiedRecoveredMinor: 1000,
      }).tier,
    ).toBe("gravity");
    expect(
      scorePipeGravity({
        mandatesIssued: 200,
        casesSent: 180,
        savingsProofs: 50,
        verifiedRecoveredMinor: 1_000_000,
      }).tier,
    ).toBe("network");
  });
});

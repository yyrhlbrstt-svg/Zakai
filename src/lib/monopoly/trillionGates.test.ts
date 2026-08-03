import { describe, expect, it } from "vitest";
import { CONTROL_PHASE, evaluateTrillionGates, TRILLION_GATES } from "./trillionGates";

const empty = {
  interopExternalGreen: false,
  packsCdnLive: false,
  referenceVerifiers: 0,
  fairnessProvidersScored: 0,
  issuersTotal: 1,
  inboundInstitutionsOverThreshold: 0,
  marketsWithCitedRights: 1,
  multiMarketOutcomes: false,
  savedCases: 0,
  attributedSignups: 0,
  paymentsLive: false,
};

describe("evaluateTrillionGates", () => {
  it("exposes nine ordered gates", () => {
    expect(TRILLION_GATES).toHaveLength(9);
    expect(TRILLION_GATES[0]!.id).toBe("G1_interop_green");
    expect(TRILLION_GATES[8]!.id).toBe("G9_closed_loop_fees");
  });

  it("starts at skeleton with an honest disclaimer", () => {
    const r = evaluateTrillionGates(empty);
    expect(r.phase).toBe(CONTROL_PHASE.SKELETON);
    expect(r.gatesPassed).toBe(0);
    expect(r.disclaimer).toMatch(/not a valuation/i);
    expect(r.nextBlocker).toMatch(/^G1_/);
  });

  it("reaches local_gravity at three passes", () => {
    const r = evaluateTrillionGates({
      ...empty,
      interopExternalGreen: true,
      packsCdnLive: true,
      referenceVerifiers: 1,
    });
    expect(r.gatesPassed).toBe(3);
    expect(r.phase).toBe(CONTROL_PHASE.LOCAL_GRAVITY);
  });

  it("requires cross-market depth for G7", () => {
    const r = evaluateTrillionGates({
      ...empty,
      marketsWithCitedRights: 2,
      savedCases: 100,
      multiMarketOutcomes: false,
    });
    expect(r.gates.find((g) => g.id === "G7_cross_market")!.passed).toBe(false);
  });

  it("requires live payments and volume for G9", () => {
    const r = evaluateTrillionGates({
      ...empty,
      paymentsLive: true,
      savedCases: 999,
    });
    expect(r.gates.find((g) => g.id === "G9_closed_loop_fees")!.passed).toBe(false);
    const r2 = evaluateTrillionGates({
      ...empty,
      paymentsLive: true,
      savedCases: 1000,
    });
    expect(r2.gates.find((g) => g.id === "G9_closed_loop_fees")!.passed).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  getRulePack,
  listRulePacks,
  isFullService,
  effectiveFeeRateBps,
  feeBasisForVertical,
  RULE_PACKS,
} from "./index";
import { PLANS } from "@/lib/plans";

describe("rule pack registry", () => {
  it("resolves telecom IL and defaults country to IL", () => {
    const pack = getRulePack("telecom");
    expect(pack?.key).toBe("telecom");
    expect(pack?.country).toBe("IL");
    expect(pack?.level).toBe("full");
  });

  it("returns null for an unconfigured (vertical, country)", () => {
    expect(getRulePack("telecom", "UK")).toBeNull();
    expect(getRulePack("nonexistent")).toBeNull();
  });

  it("lists packs, optionally by country", () => {
    expect(listRulePacks("IL").length).toBe(RULE_PACKS.length);
    expect(listRulePacks("UK")).toEqual([]);
  });

  it("all agent verticals are full-service (Case + Mandate + send + SavingsProof)", () => {
    expect(isFullService("telecom")).toBe(true);
    expect(isFullService("bank-fees")).toBe(true);
    expect(isFullService("subscription")).toBe(true);
    expect(isFullService("airline")).toBe(true);
    expect(isFullService("refund-chase")).toBe(true);
    expect(isFullService("parking")).toBe(true);
    expect(isFullService("transport-fine")).toBe(true);
    expect(isFullService("electricity")).toBe(true);
    expect(isFullService("late-payment")).toBe(true);
    expect(isFullService("deposit")).toBe(true);
    expect(isFullService("duplicate-insurance")).toBe(true);
    expect(isFullService("arnona")).toBe(true);
  });
});

describe("feeBasis on rule packs", () => {
  it("feeBasis on rule packs", () => {
    expect(getRulePack("deposit")?.feeBasis).toBe("lump");
    expect(getRulePack("telecom")?.feeBasis).toBe("monthly");
    expect(getRulePack("duplicate-insurance")?.feeBasis).toBe("monthly");
  });

  it("feeBasisForVertical defaults to monthly", () => {
    expect(feeBasisForVertical("deposit")).toBe("lump");
    expect(feeBasisForVertical("unknown")).toBe("monthly");
  });
});

describe("effectiveFeeRateBps — Stage-0 regression invariant", () => {
  it("telecom overrides nothing, so the rate equals the plan rate exactly", () => {
    const telecom = getRulePack("telecom");
    for (const plan of Object.values(PLANS)) {
      expect(effectiveFeeRateBps(telecom, plan.feeRateBps)).toBe(plan.feeRateBps);
    }
  });

  it("a null pack falls back to the plan rate", () => {
    expect(effectiveFeeRateBps(null, 1800)).toBe(1800);
  });

  it("a pack with an explicit override pins the rate regardless of plan", () => {
    const pinned = { ...getRulePack("telecom")!, feeRateBps: 1500 };
    expect(effectiveFeeRateBps(pinned, 900)).toBe(1500);
  });
});

describe("rule pack integrity", () => {
  it("every full-service pack has a verification method and is not an unresolved legal gate", () => {
    for (const p of RULE_PACKS.filter((p) => p.level === "full")) {
      expect(p.verification.method).toBeTruthy();
      // A regulated vertical must not be full-service without sign-off; none are.
      expect(p.regulated).toBe(false);
    }
  });
});

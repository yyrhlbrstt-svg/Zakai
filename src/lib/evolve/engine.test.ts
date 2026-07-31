import { describe, expect, it } from "vitest";
import { decide, digest, review, summarise } from "./engine";
import { EXPERIMENTS, automatableExperiments, experimentById } from "./experiments";
import { seededRng } from "../strategy/selector";
import type { Experiment, Trial } from "./types";

const exp: Experiment<string> = {
  id: "test",
  surface: "wording",
  target: { key: "conversion" },
  guardrails: [{ metric: { key: "trust" }, maxRelativeDrop: 0.05 }],
  minSamplesPerArm: 100,
  minRelativeLift: 0.05,
  arms: [
    { id: "control", baseline: true, payload: "a" },
    { id: "challenger", payload: "b" },
  ],
};

/** n trials for an arm at a given conversion rate, with optional guardrail. */
function trials(armId: string, n: number, rate: number, trust?: number): Trial[] {
  return Array.from({ length: n }, (_, i) => ({
    experimentId: "test",
    armId,
    converted: i < Math.round(n * rate),
    value: i < Math.round(n * rate) ? 1 : 0,
    guardrailValues: trust === undefined ? undefined : { trust },
  }));
}

describe("it refuses to change what must never be automated", () => {
  it("declines a human-only experiment outright", () => {
    const locked: Experiment<string> = { ...exp, humanOnly: true };
    const data = [...trials("control", 500, 0.1), ...trials("challenger", 500, 0.9)];
    const r = review(locked, data);
    expect(r.verdict).toEqual({ kind: "refused", reason: "human_only" });
    expect(r.explanation).toMatch(/pricing, legal, consent and security/);
  });

  it("always serves the baseline for a human-only experiment, whatever the data says", () => {
    const locked: Experiment<string> = { ...exp, humanOnly: true };
    const data = [...trials("control", 500, 0.01), ...trials("challenger", 500, 0.99)];
    for (let i = 0; i < 25; i++) {
      expect(decide(locked, data, { rng: seededRng(i) }).id).toBe("control");
    }
  });

  it("locks the fee rate, consent copy and security thresholds in the real registry", () => {
    for (const id of ["success_fee_rate", "consent_copy", "security_thresholds"]) {
      expect({ id, humanOnly: experimentById(id)?.humanOnly }).toEqual({ id, humanOnly: true });
    }
    expect(automatableExperiments().map((e) => e.id)).not.toContain("success_fee_rate");
  });

  it("refuses without a baseline, because there would be nothing to roll back to", () => {
    const noBase: Experiment<string> = {
      ...exp,
      arms: [{ id: "a", payload: "a" }, { id: "b", payload: "b" }],
    };
    const data = [...trials("a", 200, 0.1), ...trials("b", 200, 0.9)];
    expect(review(noBase, data).verdict).toEqual({ kind: "refused", reason: "no_baseline" });
  });
});

describe("it demands evidence, not a lead", () => {
  it("waits until every arm has enough data", () => {
    const data = [...trials("control", 100, 0.1), ...trials("challenger", 30, 0.9)];
    const r = review(exp, data);
    expect(r.verdict.kind).toBe("insufficient_data");
    expect(r.explanation).toMatch(/Still collecting/);
  });

  it("does not promote a lead that is within noise", () => {
    // 52% vs 50% over 100 each — a real-looking lead that means nothing.
    const data = [...trials("control", 100, 0.5), ...trials("challenger", 100, 0.52)];
    const r = review(exp, data);
    expect(r.verdict.kind).toBe("no_winner");
    expect(r.explanation).toMatch(/leading is not the same as winning|under the/i);
  });

  it("does not promote a real but trivial improvement", () => {
    const data = [...trials("control", 4000, 0.5), ...trials("challenger", 4000, 0.51)];
    const r = review(exp, data);
    expect(r.verdict).toMatchObject({ kind: "no_winner", reason: "below_min_lift" });
  });

  it("promotes a large, well-evidenced win", () => {
    const data = [...trials("control", 400, 0.2), ...trials("challenger", 400, 0.4)];
    const r = review(exp, data);
    expect(r.verdict.kind).toBe("promote");
    if (r.verdict.kind === "promote") {
      expect(r.verdict.armId).toBe("challenger");
      expect(r.verdict.relativeLift).toBeGreaterThan(0.5);
    }
    expect(r.explanation).toMatch(/Adopting "challenger"/);
  });

  it("never promotes the baseline over itself", () => {
    const data = [...trials("control", 400, 0.4), ...trials("challenger", 400, 0.2)];
    expect(review(exp, data).verdict.kind).toBe("no_winner");
  });
});

describe("guardrails are a veto, not a weight", () => {
  it("rejects a winner that damaged the protected metric", () => {
    const data = [
      ...trials("control", 400, 0.2, 100),
      ...trials("challenger", 400, 0.6, 80), // +200% conversion, -20% trust
    ];
    const r = review(exp, data);
    expect(r.verdict.kind).toBe("guardrail_veto");
    if (r.verdict.kind === "guardrail_veto") {
      expect(r.verdict.metric).toBe("trust");
      expect(r.verdict.observedDrop).toBeCloseTo(0.2, 2);
    }
    expect(r.explanation).toMatch(/Rejected rather than traded off/);
  });

  it("tolerates a movement inside the stated allowance", () => {
    const data = [
      ...trials("control", 400, 0.2, 100),
      ...trials("challenger", 400, 0.4, 98), // -2%, under the 5% limit
    ];
    expect(review(exp, data).verdict.kind).toBe("promote");
  });

  it("reads a lower-is-better metric in the right direction", () => {
    const bounce: Experiment<string> = {
      ...exp,
      guardrails: [{ metric: { key: "trust", lowerIsBetter: true }, maxRelativeDrop: 0.05 }],
    };
    // The value went UP, which for a lower-is-better metric is worse.
    const worse = [...trials("control", 400, 0.2, 100), ...trials("challenger", 400, 0.5, 130)];
    expect(review(bounce, worse).verdict.kind).toBe("guardrail_veto");

    // Same magnitude, downward — an improvement, so no veto.
    const better = [...trials("control", 400, 0.2, 100), ...trials("challenger", 400, 0.5, 70)];
    expect(review(bounce, better).verdict.kind).toBe("promote");
  });

  it("checks the guardrail before deciding anything about the target", () => {
    // Enough data and a huge lift, but the guardrail still wins.
    const data = [
      ...trials("control", 1000, 0.1, 100),
      ...trials("challenger", 1000, 0.9, 50),
    ];
    expect(review(exp, data).verdict.kind).toBe("guardrail_veto");
  });
});

describe("choosing an arm", () => {
  it("explores when it knows nothing", () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => decide(exp, [], { rng: seededRng(i) }).id),
    );
    expect(seen.size).toBe(2);
  });

  it("converges on the better arm once the evidence is in", () => {
    const data = [...trials("control", 400, 0.1), ...trials("challenger", 400, 0.6)];
    const picks = Array.from({ length: 300 }, (_, i) => decide(exp, data, { rng: seededRng(i) }).id);
    const winners = picks.filter((p) => p === "challenger").length;
    expect(winners).toBeGreaterThan(270);
  });

  it("is reproducible from a seed", () => {
    const data = trials("control", 50, 0.5);
    expect(decide(exp, data, { rng: seededRng(99) }).id).toBe(
      decide(exp, data, { rng: seededRng(99) }).id,
    );
  });

  it("throws rather than silently picking nothing", () => {
    expect(() => decide({ ...exp, arms: [] }, [])).toThrow(/no arms/);
  });
});

describe("summaries", () => {
  it("includes arms with no data at all", () => {
    const s = summarise(exp, trials("control", 10, 0.5));
    expect(s.map((x) => x.armId).sort()).toEqual(["challenger", "control"]);
    expect(s.find((x) => x.armId === "challenger")!.samples).toBe(0);
  });

  it("ignores trials belonging to another experiment", () => {
    const foreign: Trial[] = trials("control", 50, 1).map((t) => ({ ...t, experimentId: "other" }));
    expect(summarise(exp, foreign).every((s) => s.samples === 0)).toBe(true);
  });
});

describe("the digest a human reads", () => {
  it("leads with what actually changed", () => {
    const promoted = review(exp, [...trials("control", 400, 0.2), ...trials("challenger", 400, 0.5)]);
    const waiting = review({ ...exp, id: "b" }, []);
    const lines = digest([waiting, promoted]);
    expect(lines[0]).toMatch(/^\[promote\]/);
    expect(lines[1]).toMatch(/^\[insufficient_data\]/);
  });

  it("explains every verdict in a sentence", () => {
    for (const r of [
      review(exp, []),
      review(exp, [...trials("control", 400, 0.2), ...trials("challenger", 400, 0.5)]),
      review({ ...exp, humanOnly: true }, []),
    ]) {
      expect(r.explanation.length).toBeGreaterThan(30);
    }
  });
});

describe("the shipped registry is coherent", () => {
  it("gives every experiment exactly one baseline", () => {
    for (const e of EXPERIMENTS) {
      expect({ id: e.id, baselines: e.arms.filter((a) => a.baseline).length }).toEqual({
        id: e.id,
        baselines: 1,
      });
    }
  });

  it("uses unique ids for experiments and for arms within one", () => {
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(EXPERIMENTS.length);
    for (const e of EXPERIMENTS) {
      expect(new Set(e.arms.map((a) => a.id)).size).toBe(e.arms.length);
    }
  });

  it("gives every automatable experiment a guardrail", () => {
    for (const e of automatableExperiments()) {
      expect({ id: e.id, guards: e.guardrails.length }).not.toEqual({ id: e.id, guards: 0 });
    }
  });

  it("keeps every door-order arm a duplicate-free list of known door keys", () => {
    // Not "the same four doors every time": an arm testing whether "dormant"
    // converts better in the lead position legitimately names a different set
    // than one testing "money" vs "cancel" — page.tsx's rank() already
    // tolerates a payload that omits a door (it sorts last, stably, rather
    // than erroring). What must hold regardless is that nothing in an arm's
    // list is a typo'd or duplicated key, since either would silently make
    // that arm untestable or double-count a door.
    const knownDoors = new Set([
      "money",
      "cancel",
      "owed",
      "electricity",
      "incident",
      "dormant",
      "vehicle-check",
    ]);
    const doors = experimentById("home_door_order")!;
    for (const arm of doors.arms) {
      const payload = arm.payload as string[];
      expect(new Set(payload).size).toBe(payload.length); // no duplicates
      for (const key of payload) {
        expect({ arm: arm.id, key, known: knownDoors.has(key) }).toEqual({
          arm: arm.id,
          key,
          known: true,
        });
      }
    }
  });
});

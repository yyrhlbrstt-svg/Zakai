import { describe, expect, it } from "vitest";
import {
  SETTLEMENT_VECTORS,
  runSettlementVectors,
  selfCheck,
  settlementVectorDocument,
} from "./vectors";
import { adjudicate, hashRecord } from "./records";

/** The real implementation, so a perturbation test changes exactly one thing. */
function selfCheckImpl(chain: Parameters<typeof adjudicate>[0], now: Date) {
  const a = adjudicate(chain, now);
  return { verdict: a.verdict as string, burden: a.burden as string, settledMinor: a.settledMinor };
}

describe("our own implementation passes its own settlement vectors", () => {
  it("passes every one", () => {
    const report = selfCheck();
    expect(report.failed).toEqual([]);
    expect(report.conformant).toBe(true);
  });
});

describe("the vectors cover every verdict", () => {
  it("has at least one vector per verdict", () => {
    // A verdict with no vector is one two implementations will disagree about,
    // and a disputed act nobody can settle.
    const covered = new Set(SETTLEMENT_VECTORS.map((v) => v.expect.verdict));
    for (const verdict of settlementVectorDocument().verdicts) {
      expect(covered).toContain(verdict);
    }
  });

  it("covers both burdens that can be assigned, and none", () => {
    const burdens = new Set(SETTLEMENT_VECTORS.map((v) => v.expect.burden));
    expect(burdens).toContain("institution");
    expect(burdens).toContain("none");
  });

  it("explains what each vector is for", () => {
    for (const v of SETTLEMENT_VECTORS) expect(v.pins.trim().length).toBeGreaterThan(25);
  });

  it("has no duplicate ids", () => {
    const ids = SETTLEMENT_VECTORS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("canonical hashing is pinned separately from the verdicts", () => {
  it("publishes fixtures an implementer can check before anything else", () => {
    // Right verdict from the wrong hash is agreement about nothing: such an
    // implementation works on chains it built itself and rejects every chain
    // built by anybody else. This is the most common way a signed-record format
    // fails between languages.
    const doc = settlementVectorDocument();
    expect(doc.canonicalisation.fixtures.length).toBeGreaterThanOrEqual(4);
    for (const f of doc.canonicalisation.fixtures) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(hashRecord(f.record)).toBe(f.sha256);
    }
  });

  it("includes a fixture pair that differs only in key order", () => {
    // The specific divergence: an implementation that serialises in insertion
    // order passes every test it writes itself and fails on real traffic.
    const [first, second] = settlementVectorDocument().canonicalisation.fixtures;
    expect(first.sha256).toBe(second.sha256);
    expect(JSON.stringify(first.record)).not.toBe(JSON.stringify(second.record));
  });

  it("states the three rules that are the whole of the canonicalisation", () => {
    const rules = settlementVectorDocument().canonicalisation.rules;
    expect(rules.join(" ")).toMatch(/sorted/);
    expect(rules.join(" ")).toMatch(/undefined/);
  });

  it("has a vector that only passes when the hashing matches", () => {
    // The edited-decision vector recomputes a hash over a record the candidate
    // did not build, so a divergent serialiser cannot pass it by accident.
    const v = SETTLEMENT_VECTORS.find((x) => x.id === "broken_chain_edited_decision")!;
    expect(v.expect.verdict).toBe("broken_chain");
  });
});

describe("a failing implementation is caught, not flattered", () => {
  it("fails one that always settles", () => {
    const report = runSettlementVectors(() => ({
      verdict: "performed_as_authorized",
      burden: "none",
      settledMinor: 42_000,
    }));
    expect(report.conformant).toBe(false);
    expect(report.failed.length).toBeGreaterThan(10);
  });

  it("fails one that always refuses to decide", () => {
    const report = runSettlementVectors(() => ({
      verdict: "indeterminate",
      burden: "none",
      settledMinor: 0,
    }));
    expect(report.conformant).toBe(false);
  });

  it("fails one that gets the verdict right and the burden wrong", () => {
    // Burden is not decoration: it is who has to produce the missing document,
    // and an implementation that assigns it differently settles disputes
    // differently.
    const report = runSettlementVectors((chain, now) => {
      const real = selfCheckImpl(chain, now);
      return { ...real, burden: "agent" };
    });
    expect(report.conformant).toBe(false);
  });

  it("records a throw as a failure instead of crashing the harness", () => {
    const report = runSettlementVectors(() => {
      throw new Error("boom");
    });
    expect(report.conformant).toBe(false);
    expect(report.failed[0].actual).toContain("threw:boom");
  });
});

describe("the published document is usable from another language", () => {
  it("serialises without loss", () => {
    const doc = settlementVectorDocument();
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("carries the full chain for every vector", () => {
    for (const v of settlementVectorDocument().vectors) {
      expect(v.chain.mandate).toBeDefined();
      expect(v.expect.verdict).toBeDefined();
    }
  });

  it("is deterministic", () => {
    expect(settlementVectorDocument()).toEqual(settlementVectorDocument());
  });
});

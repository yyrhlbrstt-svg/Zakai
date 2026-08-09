import { describe, expect, it } from "vitest";
import { MEANINGFUL_GAP, buildPlaybook, type OutcomeRow } from "./counterpartyPlaybook";
import { MIN_SAMPLE } from "./companyScore";

/**
 * This is handed to a third-party agent as guidance about a named company,
 * and it will be acted on. Every number therefore has to be either earned or
 * withheld — there is no useful middle where it is "probably right".
 */
const row = (over: Partial<OutcomeRow> = {}): OutcomeRow => ({
  counterparty: "cellcom",
  vertical: "telecom",
  variantId: "firm",
  paid: true,
  recoveredMinor: 10_000,
  days: 10,
  ...over,
});

const many = (n: number, over: Partial<OutcomeRow> = {}) => Array.from({ length: n }, () => row(over));

describe("it refuses to speak below the evidence floor", () => {
  /**
   * A win rate from three cases is an anecdote with a percent sign on it.
   * Silence is the honest output.
   */
  it("says there is not enough evidence rather than reporting a thin rate", () => {
    const out = buildPlaybook("cellcom", many(MIN_SAMPLE - 1));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("not_enough_evidence");
      expect(out.sampleSize).toBe(MIN_SAMPLE - 1);
    }
  });

  it("speaks at exactly the floor, so the gate is a floor and not a moving target", () => {
    expect(buildPlaybook("cellcom", many(MIN_SAMPLE)).ok).toBe(true);
  });

  it("counts only the counterparty asked about", () => {
    const rows = [...many(MIN_SAMPLE, { counterparty: "partner" }), ...many(2)];
    const out = buildPlaybook("cellcom", rows);
    // Two cellcom rows is below the floor even though the list is long.
    expect(out.ok).toBe(false);
  });

  it("narrows to one vertical when asked, and applies the floor to that slice", () => {
    const rows = [...many(MIN_SAMPLE, { vertical: "telecom" }), ...many(2, { vertical: "bank-fees" })];
    expect(buildPlaybook("cellcom", rows, "telecom").ok).toBe(true);
    expect(buildPlaybook("cellcom", rows, "bank-fees").ok).toBe(false);
  });
});

describe("the figures describe what happened", () => {
  it("reports the paid rate and the median days among those that paid", () => {
    const rows = [
      row({ paid: true, days: 4 }),
      row({ paid: true, days: 8 }),
      row({ paid: true, days: 30 }),
      row({ paid: false, days: 0, recoveredMinor: 0 }),
      row({ paid: false, days: 0, recoveredMinor: 0 }),
    ];
    const out = buildPlaybook("cellcom", rows);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.playbook.paidRate).toBeCloseTo(0.6);
    // Unpaid rows have no resolution to time; counting their zero days would
    // report a speed nobody experienced.
    expect(out.playbook.medianDays).toBe(8);
  });

  it("keeps money in integer minor units", () => {
    const out = buildPlaybook("cellcom", many(MIN_SAMPLE, { recoveredMinor: 1_234.7 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(Number.isInteger(out.playbook.recoveredMinor)).toBe(true);
  });

  it("has no median when nothing was paid, rather than inventing one", () => {
    const out = buildPlaybook("cellcom", many(MIN_SAMPLE, { paid: false, days: 0 }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.playbook.medianDays).toBeNull();
  });
});

describe("it names a winning approach only when there is one", () => {
  it("picks the clear leader", () => {
    const rows = [
      ...many(MIN_SAMPLE, { variantId: "firm", paid: true }),
      ...many(MIN_SAMPLE, { variantId: "soft", paid: false }),
    ];
    const out = buildPlaybook("cellcom", rows);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.playbook.bestVariant?.variantId).toBe("firm");
  });

  /**
   * Otherwise every future claim is routed down a path chosen by a coin flip,
   * and the record then confirms the choice it caused.
   */
  it("names nobody when the approaches are within noise", () => {
    // 19/20 against 18/20 — a five-point gap, which is what "within noise"
    // actually looks like. (An earlier version of this test used 5/5 against
    // 4/5 and called it close; that is a twenty-point gap and a real result.)
    const rows = [
      ...many(19, { variantId: "firm", paid: true }),
      ...many(1, { variantId: "firm", paid: false }),
      ...many(18, { variantId: "soft", paid: true }),
      ...many(2, { variantId: "soft", paid: false }),
    ];
    const out = buildPlaybook("cellcom", rows);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const gap =
      out.playbook.variants[0].paidRate - out.playbook.variants[1].paidRate;
    expect(gap).toBeLessThan(MEANINGFUL_GAP);
    expect(out.playbook.bestVariant).toBeNull();
  });

  it("ignores an approach tried too few times to mean anything", () => {
    // Tried twice, won twice, is not a strategy.
    const rows = [
      ...many(MIN_SAMPLE, { variantId: "firm", paid: false }),
      ...many(2, { variantId: "lucky", paid: true }),
    ];
    const out = buildPlaybook("cellcom", rows);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.playbook.bestVariant?.variantId).not.toBe("lucky");
  });

  it("still lists every approach, so a reader can see what was thin", () => {
    const rows = [
      ...many(MIN_SAMPLE, { variantId: "firm" }),
      ...many(2, { variantId: "lucky" }),
    ];
    const out = buildPlaybook("cellcom", rows);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.playbook.variants.map((v) => v.variantId).sort()).toEqual(["firm", "lucky"]);
  });
});

describe("it carries no person", () => {
  it("returns nothing that could identify a claimant", () => {
    const out = buildPlaybook("cellcom", many(MIN_SAMPLE));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const serialised = JSON.stringify(out.playbook);
    for (const forbidden of ["userId", "caseId", "email", "phone", "name"]) {
      expect(serialised.includes(forbidden), `${forbidden} must not appear`).toBe(false);
    }
  });
});

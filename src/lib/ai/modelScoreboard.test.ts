import { describe, expect, it } from "vitest";
import {
  MEANINGFUL_GAP,
  MIN_SAMPLE,
  bestDrafter,
  buildScoreboard,
  comparable,
  type OutcomeRow,
} from "./modelScoreboard";
import { drafterId, isAttributed, parseDrafterId, UNKNOWN_DRAFTER } from "./drafterId";

const row = (over: Partial<OutcomeRow> = {}): OutcomeRow => ({
  drafterId: "anthropic:claude-sonnet-5",
  paid: true,
  recoveredMinor: 10_000,
  days: 10,
  selfReported: false,
  ...over,
});

/** n rows for one drafter, `paid` of them successful. */
const rows = (id: string, n: number, paid: number, over: Partial<OutcomeRow> = {}) =>
  Array.from({ length: n }, (_, i) => row({ drafterId: id, paid: i < paid, ...over }));

describe("drafterId", () => {
  it("builds a stable id from a completed call", () => {
    expect(drafterId("anthropic", "claude-sonnet-5")).toBe("anthropic:claude-sonnet-5");
  });

  it("normalizes spelling so one model is not two rows", () => {
    expect(drafterId("gemini", "  Gemini-2.5-Flash  ")).toBe(drafterId("gemini", "gemini-2.5-flash"));
    expect(drafterId("gemini", "models/gemini-2.5-flash")).toBe("gemini:gemini-2.5-flash");
  });

  it("refuses to attribute an unknown provider rather than guessing", () => {
    expect(drafterId("mistral", "big")).toBe(UNKNOWN_DRAFTER);
    expect(drafterId(undefined, "claude-sonnet-5")).toBe(UNKNOWN_DRAFTER);
    expect(drafterId("anthropic", null)).toBe(UNKNOWN_DRAFTER);
    expect(drafterId("anthropic", "   ")).toBe(UNKNOWN_DRAFTER);
  });

  it("round-trips through parse", () => {
    expect(parseDrafterId("anthropic:claude-sonnet-5")).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5",
    });
  });

  it("treats the unknown marker as unattributed", () => {
    expect(isAttributed(UNKNOWN_DRAFTER)).toBe(false);
    expect(parseDrafterId(UNKNOWN_DRAFTER)).toBeNull();
    expect(parseDrafterId("anthropic:")).toBeNull();
    expect(parseDrafterId(":claude")).toBeNull();
  });

  it("bounds the stored length", () => {
    expect(drafterId("anthropic", "x".repeat(500)).length).toBeLessThanOrEqual(80);
  });
});

describe("buildScoreboard", () => {
  it("counts unattributed cases instead of blaming a model for them", () => {
    // The failure this prevents: folding pre-attribution history into whichever
    // model happens to be configured, which would invent its track record.
    const board = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 5, 3),
      row({ drafterId: UNKNOWN_DRAFTER }),
      row({ drafterId: "" }),
    ]);
    expect(board.unattributed).toBe(2);
    expect(board.drafters).toHaveLength(1);
    expect(board.drafters[0].trials).toBe(5);
  });

  it("withholds a rate below the sample gate rather than rounding one up", () => {
    const board = buildScoreboard(rows("anthropic:claude-sonnet-5", MIN_SAMPLE - 1, 4));
    const d = board.drafters[0];
    expect(d.trials).toBe(MIN_SAMPLE - 1);
    expect(d.paidRate).toBeNull();
    expect(d.reportable).toBe(false);
  });

  it("reports a rate once the gate is cleared", () => {
    const board = buildScoreboard(rows("anthropic:claude-sonnet-5", 10, 7));
    expect(board.drafters[0].paidRate).toBeCloseTo(0.7);
    expect(board.drafters[0].reportable).toBe(true);
  });

  it("excludes self-reported outcomes unless asked", () => {
    const input = [
      ...rows("anthropic:claude-sonnet-5", 5, 5),
      ...rows("anthropic:claude-sonnet-5", 5, 0, { selfReported: true }),
    ];
    expect(buildScoreboard(input).drafters[0].trials).toBe(5);
    expect(buildScoreboard(input, { includeSelfReported: true }).drafters[0].trials).toBe(10);
  });

  it("keeps money in integer minor units", () => {
    const board = buildScoreboard([
      row({ recoveredMinor: 1_234 }),
      row({ recoveredMinor: 4_321 }),
      ...rows("anthropic:claude-sonnet-5", 3, 3, { recoveredMinor: 0 }),
    ]);
    expect(board.drafters[0].recoveredMinor).toBe(5_555);
    expect(Number.isInteger(board.drafters[0].recoveredMinor)).toBe(true);
  });

  it("reports median days among paid cases only", () => {
    const board = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 3, 3, { days: 10 }),
      ...rows("anthropic:claude-sonnet-5", 2, 0, { days: 999 }),
    ]);
    expect(board.drafters[0].medianDaysToPaid).toBe(10);
  });

  it("orders by evidence, so a thin row cannot lead the table", () => {
    const board = buildScoreboard([
      ...rows("gemini:gemini-2.5-flash", 3, 3),
      ...rows("anthropic:claude-sonnet-5", 40, 20),
    ]);
    expect(board.drafters[0].drafterId).toBe("anthropic:claude-sonnet-5");
  });

  it("is empty and honest with no data at all", () => {
    const board = buildScoreboard([]);
    expect(board.drafters).toEqual([]);
    expect(board.totalTrials).toBe(0);
    expect(bestDrafter(board)).toBeNull();
    expect(comparable(board)).toBe(false);
  });
});

describe("bestDrafter", () => {
  it("names a winner only when the gap is real", () => {
    const board = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 20, 18), // 0.90
      ...rows("gemini:gemini-2.5-flash", 20, 8), // 0.40
    ]);
    expect(bestDrafter(board)?.drafterId).toBe("anthropic:claude-sonnet-5");
  });

  it("returns null on a gap too small to act on", () => {
    // 0.60 vs 0.58 — a difference no one should switch models over.
    const board = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 50, 30),
      ...rows("gemini:gemini-2.5-flash", 50, 29),
    ]);
    expect((board.drafters[0].paidRate ?? 0) - (board.drafters[1].paidRate ?? 0)).toBeLessThan(
      MEANINGFUL_GAP,
    );
    expect(bestDrafter(board)).toBeNull();
  });

  it("ignores a thin row that would otherwise top the table", () => {
    // A perfect 5-for-5 must not beat a proven 0.5 from 100 unless it clears
    // the gate — and even then, only on a real gap.
    const board = buildScoreboard([
      ...rows("gemini:gemini-2.5-flash", MIN_SAMPLE - 1, MIN_SAMPLE - 1),
      ...rows("anthropic:claude-sonnet-5", 100, 50),
    ]);
    expect(bestDrafter(board)?.drafterId).toBe("anthropic:claude-sonnet-5");
  });

  it("names the only reportable drafter when there is nothing to compare", () => {
    const board = buildScoreboard(rows("anthropic:claude-sonnet-5", 10, 6));
    expect(bestDrafter(board)?.drafterId).toBe("anthropic:claude-sonnet-5");
    expect(comparable(board)).toBe(false);
  });
});

describe("comparable", () => {
  it("is true only once two drafters both clear the gate", () => {
    const thin = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 10, 5),
      ...rows("gemini:gemini-2.5-flash", MIN_SAMPLE - 1, 2),
    ]);
    expect(comparable(thin)).toBe(false);

    const both = buildScoreboard([
      ...rows("anthropic:claude-sonnet-5", 10, 5),
      ...rows("gemini:gemini-2.5-flash", MIN_SAMPLE, 2),
    ]);
    expect(comparable(both)).toBe(true);
  });
});

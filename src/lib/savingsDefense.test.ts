import { describe, expect, it } from "vitest";
import {
  DEFENSE_CHECK_AFTER_DAYS,
  DEFENSE_MIN_AGOROT,
  actionableDefenses,
  assessDefense,
  defenseValueAgorot,
  dueForCheck,
  type DefendedSaving,
} from "./savingsDefense";

/** Won ₪120 → ₪70, i.e. a ₪50/month saving. */
const won = (over: Partial<DefendedSaving> = {}): DefendedSaving => ({
  counterparty: "cellcom",
  originalAgorot: 12_000,
  agreedAgorot: 7_000,
  agreedAt: new Date("2026-05-01T00:00:00Z"),
  ...over,
});

describe("assessDefense", () => {
  it("catches the promotional rate quietly lapsing", () => {
    // Back to ₪110 — most of the ₪50 win handed back.
    const v = assessDefense(won(), 11_000);
    expect(v.reason).toBe("eroded");
    expect(v.actionable).toBe(true);
    expect(v.erodedAgorot).toBe(4_000);
    expect(v.erodedShare).toBeCloseTo(0.8);
  });

  it("says nothing when they are still honouring it", () => {
    const v = assessDefense(won(), 7_000);
    expect(v.reason).toBe("held");
    expect(v.actionable).toBe(false);
    expect(v.erodedAgorot).toBe(0);
  });

  it("does not call a better price erosion", () => {
    const v = assessDefense(won(), 6_000);
    expect(v.reason).toBe("improved");
    expect(v.erodedAgorot).toBe(0);
    expect(v.actionable).toBe(false);
  });

  /**
   * Bills wobble. Chasing a counterparty over a few shekels spends the
   * credibility that makes the next letter work, for money not worth having.
   */
  it("ignores an amount too small to be worth a letter", () => {
    const v = assessDefense(won(), 7_000 + DEFENSE_MIN_AGOROT - 1);
    expect(v.reason).toBe("too_small");
    expect(v.actionable).toBe(false);
  });

  it("ignores a large absolute move that is a small share of a large win", () => {
    // Won ₪1000 off; ₪150 back is 15% — drift, not a reversal.
    const v = assessDefense(
      won({ originalAgorot: 200_000, agreedAgorot: 100_000 }),
      115_000,
    );
    expect(v.erodedAgorot).toBe(15_000);
    expect(v.actionable).toBe(false);
    expect(v.reason).toBe("too_small");
  });

  it("flags a charge that climbed above the pre-Zakai price as its own thing", () => {
    // Not an eroded discount — a fresh increase on top of one. Different
    // letter, so it must not be silently folded into "eroded".
    const v = assessDefense(won(), 13_000);
    expect(v.reason).toBe("above_original");
    expect(v.actionable).toBe(true);
  });

  it("caps the eroded share at 1 rather than reporting more than was won", () => {
    const v = assessDefense(won(), 20_000);
    expect(v.erodedShare).toBe(1);
  });

  it("survives a saving that was never really a saving", () => {
    // original == agreed: nothing was won, so nothing can erode.
    const v = assessDefense(won({ originalAgorot: 7_000 }), 9_000);
    expect(v.erodedShare).toBe(0);
    expect(v.actionable).toBe(true); // above the original price is still real
    expect(v.reason).toBe("above_original");
  });

  it("keeps money in whole agorot", () => {
    const v = assessDefense(won(), 11_000.6);
    expect(Number.isInteger(v.erodedAgorot)).toBe(true);
    expect(Number.isInteger(v.currentAgorot)).toBe(true);
  });
});

describe("defenseValueAgorot", () => {
  it("values a defence over twelve months, like any monthly saving", () => {
    expect(defenseValueAgorot(assessDefense(won(), 11_000))).toBe(4_000 * 12);
  });

  it("is zero when there is nothing to act on", () => {
    expect(defenseValueAgorot(assessDefense(won(), 7_000))).toBe(0);
    expect(defenseValueAgorot(assessDefense(won(), 6_000))).toBe(0);
  });
});

describe("actionableDefenses", () => {
  it("returns only what is worth re-opening, biggest first", () => {
    const small = assessDefense(won({ counterparty: "partner" }), 9_500);
    const big = assessDefense(won({ counterparty: "cellcom" }), 11_500);
    const held = assessDefense(won({ counterparty: "hot" }), 7_000);
    expect(actionableDefenses([small, big, held]).map((v) => v.counterparty)).toEqual([
      "cellcom",
      "partner",
    ]);
  });

  it("is empty when every saving is holding", () => {
    expect(actionableDefenses([assessDefense(won(), 7_000)])).toEqual([]);
  });
});

describe("dueForCheck", () => {
  const agreedAt = new Date("2026-05-01T00:00:00Z");
  const after = (days: number) => new Date(agreedAt.getTime() + days * 86_400_000);

  it("waits until a saving has had a chance to lapse", () => {
    expect(dueForCheck(won({ agreedAt }), after(DEFENSE_CHECK_AFTER_DAYS - 1))).toBe(false);
  });

  it("is due once the window has passed", () => {
    expect(dueForCheck(won({ agreedAt }), after(DEFENSE_CHECK_AFTER_DAYS))).toBe(true);
    expect(dueForCheck(won({ agreedAt }), after(365))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENTED_MONTHS,
  documentedMonths,
  documentedSavingMinor,
  tieredFee,
  tieredFeeEnabled,
} from "./verificationDepth";

describe("documentedMonths — only what was observed", () => {
  it("documents nothing when nothing was verified", () => {
    // A case that was sent and never confirmed has recovered nothing anyone
    // can point to. That is the correct answer, not an edge case.
    expect(documentedMonths(0)).toBe(0);
    expect(documentedMonths(-1)).toBe(0);
  });

  it("grows with evidence and then stops", () => {
    expect(documentedMonths(1)).toBe(1);
    expect(documentedMonths(2)).toBe(3);
    expect(documentedMonths(3)).toBe(6);
  });

  it("never documents more than the ceiling, however many bills arrive", () => {
    for (const n of [4, 5, 12, 60, 1000]) {
      expect(documentedMonths(n)).toBe(MAX_DOCUMENTED_MONTHS);
    }
  });

  it("never reaches the twelve it replaced", () => {
    // The whole point: the outcome graph recorded twelve months off a single
    // verified bill. Nothing this function returns may assert a full year.
    for (const n of [0, 1, 2, 3, 4, 10, 100]) {
      expect(documentedMonths(n)).toBeLessThan(12);
    }
  });

  it("ignores a fractional cycle rather than interpolating one", () => {
    expect(documentedMonths(1.9)).toBe(documentedMonths(1));
  });
});

describe("documentedSavingMinor", () => {
  it("leaves a lump recovery whole — there is no second payout", () => {
    for (const cycles of [0, 1, 2, 5]) {
      expect(documentedSavingMinor(300_000, "lump", cycles)).toBe(300_000);
    }
  });

  it("scales a monthly saving by the months actually verified", () => {
    expect(documentedSavingMinor(3000, "monthly", 1)).toBe(3000);
    expect(documentedSavingMinor(3000, "monthly", 2)).toBe(9000);
    expect(documentedSavingMinor(3000, "monthly", 3)).toBe(18_000);
  });

  it("documents zero for a monthly saving nobody confirmed", () => {
    expect(documentedSavingMinor(3000, "monthly", 0)).toBe(0);
  });

  it("refuses a float or a negative — money is integer minor units", () => {
    expect(() => documentedSavingMinor(30.5, "monthly", 1)).toThrow();
    expect(() => documentedSavingMinor(-100, "monthly", 1)).toThrow();
  });
});

describe("tieredFee — bills the difference, never the same month twice", () => {
  const RATE = 1800; // 18%

  it("charges one month's worth on the first confirmed bill", () => {
    const f = tieredFee(3000, "monthly", 1, RATE);
    expect(f.documentedMonths).toBe(1);
    expect(f.totalMinor).toBe(540); // ₪5.40 — what is charged today
    expect(f.dueNowMinor).toBe(540);
  });

  it("bills only the delta when a second bill confirms it held", () => {
    const f = tieredFee(3000, "monthly", 2, RATE, 540);
    expect(f.totalMinor).toBe(1620); // 18% of three months
    expect(f.dueNowMinor).toBe(1080); // the difference, not the whole thing again
  });

  it("reaches six months of evidence and stops", () => {
    const third = tieredFee(3000, "monthly", 3, RATE, 1620);
    expect(third.totalMinor).toBe(3240);
    expect(third.dueNowMinor).toBe(1620);
    // A fourth confirmed bill adds evidence but no charge.
    const fourth = tieredFee(3000, "monthly", 4, RATE, 3240);
    expect(fourth.totalMinor).toBe(3240);
    expect(fourth.dueNowMinor).toBe(0);
  });

  it("never turns into a credit when more was charged than the ladder supports", () => {
    const f = tieredFee(3000, "monthly", 1, RATE, 5000);
    expect(f.dueNowMinor).toBe(0);
  });

  it("charges a lump recovery on the whole sum, once", () => {
    const f = tieredFee(300_000, "lump", 1, RATE);
    expect(f.totalMinor).toBe(54_000); // ₪540 on a ₪3,000 deposit
    // More "cycles" cannot inflate a one-time recovery.
    expect(tieredFee(300_000, "lump", 5, RATE).totalMinor).toBe(54_000);
  });

  it("charges nothing on a saving nobody confirmed", () => {
    expect(tieredFee(3000, "monthly", 0, RATE).dueNowMinor).toBe(0);
  });

  it("returns integer agorot at every depth", () => {
    for (const cycles of [1, 2, 3, 4]) {
      const f = tieredFee(3333, "monthly", cycles, RATE, 0);
      expect(Number.isInteger(f.totalMinor)).toBe(true);
      expect(Number.isInteger(f.dueNowMinor)).toBe(true);
    }
  });

  it("refuses a nonsense rate rather than computing with it", () => {
    expect(() => tieredFee(3000, "monthly", 1, -1)).toThrow();
    expect(() => tieredFee(3000, "monthly", 1, 18.5)).toThrow();
  });
});

describe("the pricing change stays off until somebody decides it", () => {
  it("is off unless the environment says otherwise", () => {
    const prev = process.env.TIERED_SUCCESS_FEE;
    delete process.env.TIERED_SUCCESS_FEE;
    expect(tieredFeeEnabled()).toBe(false);
    process.env.TIERED_SUCCESS_FEE = "1";
    expect(tieredFeeEnabled(), "only the exact string 'true' may switch billing").toBe(false);
    process.env.TIERED_SUCCESS_FEE = "true";
    expect(tieredFeeEnabled()).toBe(true);
    if (prev === undefined) delete process.env.TIERED_SUCCESS_FEE;
    else process.env.TIERED_SUCCESS_FEE = prev;
  });
});

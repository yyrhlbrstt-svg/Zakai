import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { strategyOutcome: { findMany: (...a: unknown[]) => findMany(...a) } } }));

const { predictResponse } = await import("./predictResponse");

const NOW = new Date("2026-08-21T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const row = (o: Record<string, unknown> = {}) => ({
  paid: true,
  recoveredMinor: 20_000,
  days: 14,
  variantId: "standard",
  settlementBacked: false,
  createdAt: daysAgo(10),
  ...o,
});

beforeEach(() => findMany.mockReset());

describe("Engine 1 refuses to predict from thin evidence", () => {
  it("returns available:false below the gate — not a low-confidence guess", async () => {
    findMany.mockResolvedValue([row(), row()]);
    const p = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    expect(p.available).toBe(false);
    expect(p.settleProbability).toBeNull();
    expect(p.expectedDays).toBeNull();
    expect(p.recommendedTactic).toBeNull();
    expect(p.confidence).toBe(0);
    // The counts stay true and visible, so a caller can say why.
    expect(p.basis.trials).toBe(2);
    expect(p.basis.minTrials).toBe(5);
  });

  it("returns available:false on an empty book without inventing a zero rate", async () => {
    findMany.mockResolvedValue([]);
    const p = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "nobody", now: NOW });
    expect(p.available).toBe(false);
    expect(p.basis.trials).toBe(0);
    expect(p.basis.newestOutcomeDaysAgo).toBeNull();
  });
});

describe("Engine 1 predicts only what the closed cases say", () => {
  it("derives probability, range, days and tactic from real rows", async () => {
    findMany.mockResolvedValue([
      row({ recoveredMinor: 10_000, days: 10 }),
      row({ recoveredMinor: 20_000, days: 14 }),
      row({ recoveredMinor: 30_000, days: 20 }),
      row({ recoveredMinor: 40_000, days: 30 }),
      row({ paid: false, recoveredMinor: null, days: 40 }),
    ]);
    const p = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    expect(p.available).toBe(true);
    expect(p.settleProbability).toBeCloseTo(0.8);
    expect(p.expectedDays).toBe(20);
    expect(p.recommendedTactic).toBe("standard");
    // p25–p75 of what was ACTUALLY recovered — never extrapolated past it.
    expect(p.expectedAmountRangeAgorot!.low).toBeGreaterThanOrEqual(10_000);
    expect(p.expectedAmountRangeAgorot!.high).toBeLessThanOrEqual(40_000);
  });

  it("scores confidence from volume, recency and evidence grade — and nothing else", async () => {
    // A thin, old, self-reported cell...
    findMany.mockResolvedValue(
      Array.from({ length: 5 }, () => row({ settlementBacked: false, createdAt: daysAgo(400) })),
    );
    const weak = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    // ...against a large, fresh, settlement-backed one.
    findMany.mockResolvedValue(
      Array.from({ length: 20 }, () => row({ settlementBacked: true, createdAt: daysAgo(5) })),
    );
    const strong = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    expect(Object.keys(strong.confidenceParts).sort()).toEqual(["grade", "recency", "volume"]);
    expect(strong.confidenceParts.grade).toBe(1);
    expect(strong.confidenceParts.recency).toBeGreaterThan(0.9);
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });

  it("discounts stale evidence — an old posture is not a current one", async () => {
    const old = Array.from({ length: 20 }, () => row({ createdAt: daysAgo(520) }));
    findMany.mockResolvedValue(old);
    const stale = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    expect(stale.available).toBe(true);
    expect(stale.confidenceParts.recency).toBeLessThan(0.1);
    expect(stale.basis.newestOutcomeDaysAgo).toBe(520);
  });

  it("never reports a confidence above 1 however much evidence piles up", async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 500 }, () => row({ settlementBacked: true, createdAt: NOW })),
    );
    const p = await predictResponse({ market: "IL", vertical: "telecom", counterparty: "cellcom", now: NOW });
    expect(p.confidence).toBeLessThanOrEqual(1);
    expect(p.confidenceParts.volume).toBe(1);
  });
});

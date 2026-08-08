import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { strategyOutcome: { findMany: (...a: unknown[]) => findMany(...a) } } }));
vi.mock("server-only", () => ({}));

const { loadSnapshotFacts } = await import("./snapshotFacts");
const { SNAPSHOT_MIN_SAMPLE } = await import("@/lib/mandate/signedSnapshot");

const row = (over: Partial<{ counterparty: string; paid: boolean; recoveredMinor: number; days: number; createdAt: Date }> = {}) => ({
  counterparty: "cellcom",
  paid: true,
  recoveredMinor: 10_000,
  days: 10,
  createdAt: new Date("2026-03-01T00:00:00Z"),
  ...over,
});

const rows = (n: number, over = {}) => Array.from({ length: n }, () => row(over));

// Braces matter: Vitest treats a value returned from beforeEach as a teardown
// callback, and mockReset() returns the mock itself — so the concise form
// silently calls findMany() after every test.
beforeEach(() => {
  findMany.mockReset();
});

describe("loadSnapshotFacts", () => {
  it("summarises a publishable sample", async () => {
    findMany.mockResolvedValue([
      row({ counterparty: "cellcom", days: 4, createdAt: new Date("2026-01-02T00:00:00Z") }),
      row({ counterparty: "partner", days: 8 }),
      row({ counterparty: "partner", days: 12 }),
      row({ counterparty: "hot", paid: false, recoveredMinor: 0, days: 0 }),
      row({ counterparty: "yes", days: 30, createdAt: new Date("2026-06-20T00:00:00Z") }),
    ]);
    const f = await loadSnapshotFacts("IL");
    expect(f).not.toBeNull();
    expect(f!.sampleSize).toBe(5);
    expect(f!.counterparties).toBe(4);
    expect(f!.paidCount).toBe(4);
    expect(f!.recoveredMinor).toBe(40_000);
    expect(f!.from).toBe("2026-01-02");
    expect(f!.to).toBe("2026-06-20");
  });

  /**
   * Null means "do not sign", not "sign zeros". An authoritative-looking
   * document reporting an empty aggregate is worse than no document.
   */
  it("returns null rather than a signable empty aggregate", async () => {
    findMany.mockResolvedValue([]);
    expect(await loadSnapshotFacts("IL")).toBeNull();
  });

  it("returns null below the publishable minimum", async () => {
    findMany.mockResolvedValue(rows(SNAPSHOT_MIN_SAMPLE - 1));
    expect(await loadSnapshotFacts("IL")).toBeNull();
  });

  it("returns null when the database is unreachable, rather than reporting zeros", async () => {
    findMany.mockImplementation(() => Promise.reject(new Error("no connection")));
    expect(await loadSnapshotFacts("IL")).toBeNull();
  });

  /**
   * A self-report is somebody's memory. Signing it as a market statistic would
   * give a weak input the authority of a strong one.
   */
  it("asks the database for documented outcomes only, in this market", async () => {
    findMany.mockResolvedValue(rows(SNAPSHOT_MIN_SAMPLE));
    await loadSnapshotFacts("DE");
    expect(findMany.mock.calls[0][0].where).toMatchObject({ selfReported: false, market: "DE" });
  });

  it("never counts an unpaid outcome as paid", async () => {
    findMany.mockResolvedValue(rows(SNAPSHOT_MIN_SAMPLE, { paid: false, recoveredMinor: 0 }));
    const f = await loadSnapshotFacts("IL");
    expect(f!.paidCount).toBe(0);
    expect(f!.recoveredMinor).toBe(0);
  });
});

describe("median days", () => {
  it("takes the middle of an odd number of paid outcomes", async () => {
    findMany.mockResolvedValue([
      row({ days: 1 }),
      row({ days: 5 }),
      row({ days: 9 }),
      row({ days: 40 }),
      row({ days: 100 }),
    ]);
    expect((await loadSnapshotFacts("IL"))!.medianDays).toBe(9);
  });

  it("averages the two middle values on an even count", async () => {
    findMany.mockResolvedValue([
      row({ days: 2 }),
      row({ days: 4 }),
      row({ days: 8 }),
      row({ days: 10 }),
      row({ days: 0, paid: false }),
    ]);
    expect((await loadSnapshotFacts("IL"))!.medianDays).toBe(6);
  });

  it("ignores unpaid outcomes, which have no resolution to time", async () => {
    // Counting a zero-day unresolved row would drag the median toward a speed
    // nobody actually experienced.
    findMany.mockResolvedValue([
      row({ days: 20 }),
      row({ days: 22 }),
      row({ days: 24 }),
      row({ days: 0, paid: false }),
      row({ days: 0, paid: false }),
    ]);
    expect((await loadSnapshotFacts("IL"))!.medianDays).toBe(22);
  });

  /**
   * There is no median when nothing was paid, and inventing one would
   * fabricate the figure a reader relies on most.
   */
  it("is null when nothing was paid", async () => {
    findMany.mockResolvedValue(rows(SNAPSHOT_MIN_SAMPLE, { paid: false, days: 0 }));
    expect((await loadSnapshotFacts("IL"))!.medianDays).toBeNull();
  });

  it("stays a whole number of days", async () => {
    findMany.mockResolvedValue([
      row({ days: 3 }),
      row({ days: 4 }),
      row({ days: 7 }),
      row({ days: 8 }),
      row({ days: 0, paid: false }),
    ]);
    expect(Number.isInteger((await loadSnapshotFacts("IL"))!.medianDays!)).toBe(true);
  });
});

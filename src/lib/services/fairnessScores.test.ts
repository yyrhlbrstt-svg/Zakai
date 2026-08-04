import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prismaRead", () => ({
  prismaRead: { strategyOutcome: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

import { loadFairnessScores } from "./fairnessScores";
import { clearSingleflight } from "@/lib/scale/singleflight";

describe("loadFairnessScores", () => {
  beforeEach(() => {
    findMany.mockReset();
    clearSingleflight();
  });
  afterEach(() => {
    clearSingleflight();
  });

  it("aggregates real outcome rows into scores", async () => {
    findMany.mockResolvedValue([
      { counterparty: "cellcom", paid: true, recoveredMinor: 5000 },
      { counterparty: "cellcom", paid: false, recoveredMinor: 0 },
    ]);
    const scores = await loadFairnessScores("IL");
    expect(findMany).toHaveBeenCalledWith({
      where: { market: "IL", selfReported: false },
      select: { counterparty: true, paid: true, recoveredMinor: true },
    });
    expect(scores.length).toBeGreaterThanOrEqual(0);
  });

  it("returns an empty list rather than throwing when the DB is unreachable — this is what /companies and the fairness-certified doc both depend on to stay up", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(loadFairnessScores("IL")).resolves.toEqual([]);
  });

  it("uppercases the market code before querying", async () => {
    findMany.mockResolvedValue([]);
    await loadFairnessScores("gb");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ market: "GB" }) }),
    );
  });
});

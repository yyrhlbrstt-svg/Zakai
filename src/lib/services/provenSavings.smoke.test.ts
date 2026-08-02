import { describe, expect, it } from "vitest";
import { provenSavings } from "./selfReportedSaving";

describe("provenSavings", () => {
  it("returns numeric shape even when DB unavailable", async () => {
    const r = await provenSavings();
    expect(typeof r.verifiedMinor).toBe("number");
    expect(typeof r.verifiedCount).toBe("number");
    expect(r.verifiedMinor).toBeGreaterThanOrEqual(0);
  });
});

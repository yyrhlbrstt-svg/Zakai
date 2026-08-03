import { describe, expect, it } from "vitest";
import { authorizationVectorsConformant } from "./referenceVerifier";

describe("authorizationVectorsConformant", () => {
  it("passes the published authorization suite", () => {
    const r = authorizationVectorsConformant();
    expect(r.ok).toBe(true);
    expect(r.total).toBeGreaterThan(10);
    expect(r.failed).toEqual([]);
  });
});

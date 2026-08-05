import { describe, expect, it } from "vitest";
import { clearSingleflight, singleflight } from "./singleflight";

describe("singleflight", () => {
  it("coalesces concurrent loaders", async () => {
    clearSingleflight();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    };
    const [a, b] = await Promise.all([
      singleflight("k", 1000, loader),
      singleflight("k", 1000, loader),
    ]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(calls).toBe(1);
  });
});

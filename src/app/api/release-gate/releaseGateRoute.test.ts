import { describe, expect, it } from "vitest";

describe("/api/release-gate", () => {
  it("returns release score without secrets", async () => {
    const { GET } = await import("@/app/api/release-gate/route");
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.releaseScore).toBe("number");
    expect(typeof body.canReleaseConsumerApp).toBe("boolean");
    expect(Array.isArray(body.failing)).toBe(true);
    expect(body).not.toHaveProperty("MANDATE_SIGNING_JWK");
  });
});

import { describe, expect, it } from "vitest";

describe("/api/institution/inbound-pressure", () => {
  it("returns ok shape without secrets", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.pressure)).toBe(true);
    expect(typeof body.disclaimer).toBe("string");
    expect(body).not.toHaveProperty("NEON_DATABASE_URL");
  });
});

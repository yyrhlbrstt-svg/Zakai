import { describe, expect, it } from "vitest";

describe("/api/network/readiness", () => {
  it("exports layer booleans without secrets", async () => {
    const { GET } = await import("@/app/api/network/readiness/route");
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.layers).toBeDefined();
    expect(typeof body.layers.mandateSigning).toBe("boolean");
    expect(body.paymentsMode).toMatch(/^(live|demo)$/);
    expect(typeof body.operationalScore).toBe("number");
    expect(typeof body.consumerReleaseScore).toBe("number");
    expect(typeof body.canReleaseConsumerApp).toBe("boolean");
    expect(["blocked", "degraded", "operational"]).toContain(body.tier);
    expect(body).not.toHaveProperty("CRON_SECRET");
    expect(body).not.toHaveProperty("ANTHROPIC_API_KEY");
  });
});

describe("/api/network/opportunity-map", () => {
  it("returns verticals array", async () => {
    const { GET } = await import("@/app/api/network/opportunity-map/route");
    const res = await GET(new Request("http://localhost/api/network/opportunity-map?market=US"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.verticals.some((v: { id: string }) => v.id === "us_wage_theft")).toBe(true);
    expect(body.verticals.some((v: { id: string }) => v.id === "us_fdcpa")).toBe(true);
  });
});

describe("/api/network/savings-ledger", () => {
  it("returns de-identified ledger shape without inventing traction", async () => {
    const { GET } = await import("@/app/api/network/savings-ledger/route");
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.spec).toBe("zakai-savings-ledger");
    expect(typeof body.totals.verifiedProofCount).toBe("number");
    expect(Array.isArray(body.recent)).toBe(true);
    expect(body.disclaimer).toMatch(/Empty totals|de-identified/i);
  });
});

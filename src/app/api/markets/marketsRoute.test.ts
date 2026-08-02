import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/markets", () => {
  it("lists engine and catalog-only markets", async () => {
    const res = await GET(new Request("https://zakai.test/api/markets"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      markets: { code: string; capabilities: string[] }[];
    };
    expect(body.ok).toBe(true);
    const codes = body.markets.map((m) => m.code);
    expect(codes).toContain("IL");
    expect(codes).toContain("EU");
    expect(codes).toContain("GB");
    const eu = body.markets.find((m) => m.code === "EU");
    expect(eu?.capabilities).toEqual(["zml_catalog"]);
  });
});

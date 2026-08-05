import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const rateLimit = vi.fn();
const exportReceiptsCsv = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), { status }),
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

vi.mock("@/lib/services/receipts", () => ({
  exportReceiptsCsv: (...args: unknown[]) => exportReceiptsCsv(...args),
}));

import { GET } from "./route";

describe("GET /api/receipts/export", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    rateLimit.mockReset();
    exportReceiptsCsv.mockReset();
    requireUserId.mockResolvedValue({ userId: "user_1" });
    rateLimit.mockResolvedValue({ ok: true });
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({ response: new Response("{}", { status: 401 }) });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(exportReceiptsCsv).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited, without touching the DB", async () => {
    rateLimit.mockResolvedValue({ ok: false });
    const res = await GET();
    expect(res.status).toBe(429);
    expect(exportReceiptsCsv).not.toHaveBeenCalled();
  });

  it("streams the caller's own CSV as a download", async () => {
    exportReceiptsCsv.mockResolvedValue("vendor,amount\nCellcom,89.90");
    const res = await GET();
    expect(exportReceiptsCsv).toHaveBeenCalledWith("user_1");
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("zakai-receipts.csv");
    expect(await res.text()).toContain("Cellcom,89.90");
  });
});

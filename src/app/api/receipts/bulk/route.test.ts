import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const rateLimit = vi.fn();
const findUnique = vi.fn();
const parseStatement = vi.fn();
const recordReceiptsBulk = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), { status }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

vi.mock("@/lib/subscriptions", () => ({
  parseStatement: (...args: unknown[]) => parseStatement(...args),
}));

vi.mock("@/lib/services/receipts", () => ({
  recordReceiptsBulk: (...args: unknown[]) => recordReceiptsBulk(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://zakai.test/api/receipts/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/receipts/bulk", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    rateLimit.mockReset();
    findUnique.mockReset();
    parseStatement.mockReset();
    recordReceiptsBulk.mockReset();

    requireUserId.mockResolvedValue({ userId: "user_1" });
    rateLimit.mockResolvedValue({ ok: true });
    findUnique.mockResolvedValue({ plan: "BUSINESS" });
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({ response: new Response("{}", { status: 401 }) });
    const res = await POST(req({ csv: "x" }));
    expect(res.status).toBe(401);
    expect(recordReceiptsBulk).not.toHaveBeenCalled();
  });

  it("refuses a non-Business plan, server-side, not just in the UI", async () => {
    findUnique.mockResolvedValue({ plan: "MAX" });
    const res = await POST(req({ csv: "x" }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe("businessPlanRequired");
    expect(recordReceiptsBulk).not.toHaveBeenCalled();
  });

  it("refuses a FREE-plan caller the same way", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    const res = await POST(req({ csv: "x" }));
    expect(res.status).toBe(403);
    expect(recordReceiptsBulk).not.toHaveBeenCalled();
  });

  it("returns an empty result without touching the DB when nothing parses", async () => {
    parseStatement.mockReturnValue([]);
    const res = await POST(req({ csv: "not a real statement" }));
    const body = await res.json();
    expect(body).toEqual({ imported: 0, skipped: 0, flagged: [] });
    expect(recordReceiptsBulk).not.toHaveBeenCalled();
  });

  it("parses and imports for a Business-plan caller", async () => {
    const txns = [{ date: new Date(), merchant: "Cellcom", amountAgorot: 8990 }];
    parseStatement.mockReturnValue(txns);
    recordReceiptsBulk.mockResolvedValue({ imported: 1, skipped: 0, flagged: [] });

    const res = await POST(req({ csv: "01/08/2026, Cellcom, 89.90" }));
    const body = await res.json();

    expect(recordReceiptsBulk).toHaveBeenCalledWith("user_1", txns);
    expect(body).toEqual({ imported: 1, skipped: 0, flagged: [] });
  });
});

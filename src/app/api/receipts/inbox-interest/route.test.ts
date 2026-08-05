import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const rateLimit = vi.fn();
const recordInboxInterest = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), { status }),
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

vi.mock("@/lib/services/receipts", () => ({
  recordInboxInterest: (...args: unknown[]) => recordInboxInterest(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://zakai.test/api/receipts/inbox-interest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/receipts/inbox-interest", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    rateLimit.mockReset();
    recordInboxInterest.mockReset();
    requireUserId.mockResolvedValue({ userId: "user_1" });
    rateLimit.mockResolvedValue({ ok: true });
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({ response: new Response("{}", { status: 401 }) });
    const res = await POST(req({ provider: "gmail" }));
    expect(res.status).toBe(401);
    expect(recordInboxInterest).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider", async () => {
    const res = await POST(req({ provider: "yahoo" }));
    expect(res.status).toBe(400);
    expect(recordInboxInterest).not.toHaveBeenCalled();
  });

  it("records interest for the caller only", async () => {
    const res = await POST(req({ provider: "outlook" }));
    expect(res.status).toBe(200);
    expect(recordInboxInterest).toHaveBeenCalledWith("user_1", "outlook");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const rateLimit = vi.fn();
const aiAvailable = vi.fn();
const analyzeReceiptImage = vi.fn();
const recordReceipt = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

vi.mock("@/lib/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return {
    ...actual,
    aiAvailable: () => aiAvailable(),
    analyzeReceiptImage: (...args: unknown[]) => analyzeReceiptImage(...args),
  };
});

vi.mock("@/lib/services/receipts", () => ({
  recordReceipt: (...args: unknown[]) => recordReceipt(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://zakai.test/api/receipts/scan", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/receipts/scan", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    rateLimit.mockReset();
    aiAvailable.mockReset();
    analyzeReceiptImage.mockReset();
    recordReceipt.mockReset();
    reportError.mockReset();

    requireUserId.mockResolvedValue({ userId: "user_1" });
    rateLimit.mockResolvedValue({ ok: true });
    aiAvailable.mockReturnValue(true);
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({ response: new Response("{}", { status: 401 }) });
    const res = await POST(req({ imageBase64: "abcdefghij" }));
    expect(res.status).toBe(401);
    expect(analyzeReceiptImage).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured, rather than a fabricated receipt", async () => {
    aiAvailable.mockReturnValue(false);
    const res = await POST(req({ imageBase64: "abcdefghij" }));
    expect(res.status).toBe(503);
    expect(analyzeReceiptImage).not.toHaveBeenCalled();
  });

  it("rejects an unsupported media type", async () => {
    const res = await POST(req({ imageBase64: "abcdefghij", mediaType: "application/pdf" }));
    expect(res.status).toBe(400);
    expect(analyzeReceiptImage).not.toHaveBeenCalled();
  });

  it("reports readable:false without persisting anything for an unreadable photo", async () => {
    analyzeReceiptImage.mockResolvedValue({
      vendor: "",
      amountShekels: 0,
      currency: "ILS",
      date: null,
      category: "other",
      hasVat: false,
      readable: false,
    });
    const res = await POST(req({ imageBase64: "abcdefghij" }));
    const body = await res.json();
    expect(body).toEqual({ readable: false });
    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("persists a readable receipt and returns it, flagged when it's a duplicate", async () => {
    analyzeReceiptImage.mockResolvedValue({
      vendor: "Cellcom",
      amountShekels: 89.9,
      currency: "ILS",
      date: "2026-08-01",
      category: "recurring",
      hasVat: true,
      readable: true,
    });
    recordReceipt.mockResolvedValue({
      id: "rc_1",
      vendor: "Cellcom",
      amountAgorot: 8990,
      currency: "ILS",
      occurredAt: new Date("2026-08-01"),
      category: "recurring",
      hasVat: true,
      flagged: true,
      duplicateOfId: "rc_0",
      createdAt: new Date(),
    });

    const res = await POST(req({ imageBase64: "abcdefghij" }));
    const body = await res.json();

    expect(recordReceipt).toHaveBeenCalledWith("user_1", expect.objectContaining({ vendor: "Cellcom" }), "photo");
    expect(body.readable).toBe(true);
    expect(body.receipt.flagged).toBe(true);
  });
});

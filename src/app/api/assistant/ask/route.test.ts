import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const aiAvailable = vi.fn();
const askZakai = vi.fn();
const findUnique = vi.fn();
const rateLimit = vi.fn();
const refundRateLimit = vi.fn();
const buildAssistantCasesSnapshot = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/ai", () => ({
  aiAvailable: () => aiAvailable(),
  askZakai: (...args: unknown[]) => askZakai(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  refundRateLimit: (...args: unknown[]) => refundRateLimit(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

vi.mock("@/lib/services/assistantContext", () => ({
  buildAssistantCasesSnapshot: (...args: unknown[]) => buildAssistantCasesSnapshot(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/assistant/ask", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/assistant/ask", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    aiAvailable.mockReset();
    askZakai.mockReset();
    findUnique.mockReset();
    rateLimit.mockReset();
    refundRateLimit.mockReset();
    buildAssistantCasesSnapshot.mockReset();

    requireUserId.mockResolvedValue({ userId: "user_1" });
    aiAvailable.mockReturnValue(true);
    findUnique.mockResolvedValue({ plan: "FREE" });
    rateLimit.mockResolvedValue({ ok: true });
    buildAssistantCasesSnapshot.mockResolvedValue("NO_OPEN_CASE");
    askZakai.mockResolvedValue("answer text");
  });

  it("answers a plain text question (no image) exactly as before", async () => {
    const res = await POST(req({ question: "How much have I saved?", locale: "he" }));
    expect(res.status).toBe(200);
    expect(askZakai).toHaveBeenCalledWith(
      "How much have I saved?",
      expect.objectContaining({ plan: "FREE", locale: "he" }),
      undefined,
    );
  });

  it("accepts an image with no question text and fills a placeholder question", async () => {
    const res = await POST(
      req({
        question: "",
        locale: "he",
        imageBase64: "0123456789abcdef",
        imageMediaType: "image/png",
      }),
    );
    expect(res.status).toBe(200);
    expect(askZakai).toHaveBeenCalledWith(
      expect.stringContaining("image"),
      expect.anything(),
      { base64: "0123456789abcdef", mediaType: "image/png" },
    );
  });

  it("passes both a question and an image through together", async () => {
    const res = await POST(
      req({
        question: "What is this?",
        locale: "en",
        imageBase64: "0123456789abcdef",
        imageMediaType: "image/jpeg",
      }),
    );
    expect(res.status).toBe(200);
    expect(askZakai).toHaveBeenCalledWith(
      "What is this?",
      expect.anything(),
      { base64: "0123456789abcdef", mediaType: "image/jpeg" },
    );
  });

  it("rejects when both question and image are empty", async () => {
    const res = await POST(req({ question: "", locale: "he" }));
    expect(res.status).toBe(400);
    expect(askZakai).not.toHaveBeenCalled();
  });

  it("rejects a disallowed image media type", async () => {
    const res = await POST(
      req({
        question: "",
        locale: "he",
        imageBase64: "0123456789abcdef",
        imageMediaType: "application/pdf",
      }),
    );
    expect(res.status).toBe(400);
    expect(askZakai).not.toHaveBeenCalled();
  });

  it("still requires login", async () => {
    requireUserId.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "mustLogin" }), { status: 401 }),
    });
    const res = await POST(req({ question: "hi" }));
    expect(res.status).toBe(401);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const rateLimit = vi.fn();
const openLoopConflictIfAny = vi.fn();
const createExpressVerticalCase = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), { status }),
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

vi.mock("@/lib/services/expressCaseOpen", () => ({
  openLoopConflictIfAny: (...args: unknown[]) => openLoopConflictIfAny(...args),
}));

vi.mock("@/lib/services/expressVerticalCase", () => ({
  createExpressVerticalCase: (...args: unknown[]) => createExpressVerticalCase(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://zakai.test/api/cases/baggage", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  customerName: "דנה",
  airline: "El Al",
  pirNumber: "TLV12345",
  flightDate: "01/08/2026",
  disruptionType: "lost",
  essentialPurchasesShekels: 850,
};

describe("POST /api/cases/baggage", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    rateLimit.mockReset();
    openLoopConflictIfAny.mockReset();
    createExpressVerticalCase.mockReset();

    requireUserId.mockResolvedValue({ userId: "user_1" });
    rateLimit.mockResolvedValue({ ok: true });
    openLoopConflictIfAny.mockResolvedValue(null);
    createExpressVerticalCase.mockResolvedValue({
      ok: true,
      body: { caseId: "case_1", message: "case_opened", dispatched: false, delivered: false, needsOutreachEmail: false },
    });
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({ response: new Response("{}", { status: 401 }) });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(401);
    expect(createExpressVerticalCase).not.toHaveBeenCalled();
  });

  it("blocks on an open loop before creating a new case", async () => {
    openLoopConflictIfAny.mockResolvedValue(new Response(JSON.stringify({ error: "OPEN_LOOP" }), { status: 409 }));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(409);
    expect(createExpressVerticalCase).not.toHaveBeenCalled();
  });

  it("rejects an invalid disruptionType", async () => {
    const res = await POST(req({ ...VALID_BODY, disruptionType: "misplaced" }));
    expect(res.status).toBe(400);
    expect(createExpressVerticalCase).not.toHaveBeenCalled();
  });

  it("resolves the curated airline contact email as a fallback candidate", async () => {
    await POST(req({ ...VALID_BODY, airlineContactEmail: undefined }));
    const call = createExpressVerticalCase.mock.calls[0][0];
    expect(call.counterpartyEmailCandidates).toContain("customerservice@elal.co.il");
  });

  it("never invents an amount when no essential-purchase cost was given", async () => {
    await POST(req({ ...VALID_BODY, essentialPurchasesShekels: undefined }));
    const call = createExpressVerticalCase.mock.calls[0][0];
    expect(call.amountShekels).toBe(0);
  });

  it("passes through a real amount and returns the created case", async () => {
    const res = await POST(req(VALID_BODY));
    const body = await res.json();
    expect(createExpressVerticalCase.mock.calls[0][0]).toMatchObject({
      vertical: "baggage",
      provider: "El Al",
      amountShekels: 850,
    });
    expect(body.caseId).toBe("case_1");
  });

  it("surfaces a needsOutreachEmail error with the right status", async () => {
    createExpressVerticalCase.mockResolvedValue({ ok: false, status: 400, error: "needsOutreachEmail" });
    const res = await POST(req(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("needsOutreachEmail");
  });
});

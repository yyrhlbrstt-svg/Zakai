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
  return new Request("https://zakai.test/api/cases/collection-complaint", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  customerName: "אלון",
  collectorName: "חברת גבייה בע\"מ",
  contactEmail: "support@example.test",
  reason: "disputed_amount",
};

describe("POST /api/cases/collection-complaint", () => {
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

  it("rejects an invalid reason", async () => {
    const res = await POST(req({ ...VALID_BODY, reason: "annoyed" }));
    expect(res.status).toBe(400);
    expect(createExpressVerticalCase).not.toHaveBeenCalled();
  });

  it("never sets an amount — this is a fairness demand, not a refund claim", async () => {
    await POST(req({ ...VALID_BODY, claimedAmountShekels: 1200 }));
    expect(createExpressVerticalCase.mock.calls[0][0].amountShekels).toBe(0);
  });

  it("targets the named collector as provider", async () => {
    await POST(req(VALID_BODY));
    expect(createExpressVerticalCase.mock.calls[0][0].provider).toBe("חברת גבייה בע\"מ");
  });

  it("surfaces needsOutreachEmail when no contact email is given", async () => {
    createExpressVerticalCase.mockResolvedValue({ ok: false, status: 400, error: "needsOutreachEmail" });
    const res = await POST(req({ ...VALID_BODY, contactEmail: undefined }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("needsOutreachEmail");
  });
});

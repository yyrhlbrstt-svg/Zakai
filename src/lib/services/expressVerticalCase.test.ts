import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  createCase: vi.fn(),
  chooseStance: vi.fn(),
  tryExpressMandateSend: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.findUnique(...args) },
    case: { count: (...args: unknown[]) => mocks.count(...args) },
  },
}));

vi.mock("@/lib/services/cases", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/cases")>("@/lib/services/cases");
  return { ...actual, createCase: (...args: unknown[]) => mocks.createCase(...args) };
});

vi.mock("@/lib/strategy/store", () => ({
  chooseStance: (...args: unknown[]) => mocks.chooseStance(...args),
}));

vi.mock("@/lib/services/expressCaseOpen", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/expressCaseOpen")>(
    "@/lib/services/expressCaseOpen",
  );
  return { ...actual, tryExpressMandateSend: (...args: unknown[]) => mocks.tryExpressMandateSend(...args) };
});

import { createExpressVerticalCase } from "./expressVerticalCase";
import { CaseError } from "@/lib/services/cases";

const BASE_INPUT = {
  userId: "user_1",
  vertical: "baggage",
  provider: "El Al",
  counterpartyEmailCandidates: ["support@elal.test"],
  amountShekels: 800,
  targetShekels: 0,
  planDescription: "Lost baggage",
  strategy: "תביעת מזוודה אבודה עם Mandate",
  letter: { subject: "Baggage claim", body: "body text" },
};

describe("createExpressVerticalCase", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.count.mockReset();
    mocks.createCase.mockReset();
    mocks.chooseStance.mockReset();
    mocks.tryExpressMandateSend.mockReset();

    mocks.findUnique.mockResolvedValue({ plan: "FREE", country: "IL", emailVerifiedAt: null });
    mocks.count.mockResolvedValue(0);
    mocks.chooseStance.mockResolvedValue({
      variantId: "v1",
      seed: 1,
      instructions: [],
      evidenceLevel: "none",
      trials: 0,
    });
    mocks.createCase.mockResolvedValue({ id: "case_1", status: "APPROVED" });
    mocks.tryExpressMandateSend.mockResolvedValue({ dispatched: false, delivered: false });
  });

  it("refuses with needsOutreachEmail when no usable address resolves, before touching the DB", async () => {
    const result = await createExpressVerticalCase({ ...BASE_INPUT, counterpartyEmailCandidates: [undefined, ""] });
    expect(result).toEqual({ ok: false, status: 400, error: "needsOutreachEmail" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("refuses mustLogin for a user that no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await createExpressVerticalCase(BASE_INPUT);
    expect(result).toEqual({ ok: false, status: 401, error: "mustLogin" });
  });

  it("refuses caseLimit when the plan's active-case allowance is exhausted", async () => {
    mocks.count.mockResolvedValue(1); // FREE plan allows 1 active case
    const result = await createExpressVerticalCase(BASE_INPUT);
    expect(result).toEqual({ ok: false, status: 403, error: "caseLimit" });
    expect(mocks.createCase).not.toHaveBeenCalled();
  });

  it("also maps a CaseError(CASE_LIMIT) thrown by createCase itself to the same caseLimit shape", async () => {
    mocks.createCase.mockRejectedValue(new CaseError("CASE_LIMIT"));
    const result = await createExpressVerticalCase(BASE_INPUT);
    expect(result).toEqual({ ok: false, status: 403, error: "caseLimit" });
  });

  it("creates the case with the resolved outreach email and vertical, and shapes a successful response", async () => {
    const result = await createExpressVerticalCase(BASE_INPUT);
    expect(result.ok).toBe(true);
    expect(mocks.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        vertical: "baggage",
        provider: "El Al",
        counterpartyEmail: "support@elal.test",
        autoApprove: true,
      }),
    );
    if (result.ok) {
      expect(result.body.caseId).toBe("case_1");
      expect(result.body.message).toBe("case_opened"); // not delivered in this test
    }
  });

  it("reports mandate_sent only when the express dispatch actually delivered", async () => {
    mocks.tryExpressMandateSend.mockResolvedValue({ dispatched: true, delivered: true });
    const result = await createExpressVerticalCase(BASE_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.message).toBe("mandate_sent");
  });
});

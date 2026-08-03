import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/dispatch", () => ({
  dispatchAgent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { CaseError } from "@/lib/services/cases";
import { dispatchAgent } from "@/lib/services/dispatch";
import { expressOpenBody, tryExpressMandateSend } from "./expressCaseOpen";

describe("expressOpenBody", () => {
  it("marks mandate_sent only when delivered", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: true,
      delivered: true,
      extra: { subject: "x" },
    });
    expect(body.message).toBe("mandate_sent");
    expect(body.needsOutreachEmail).toBe(false);
    expect(body.subject).toBe("x");
  });

  it("marks case_opened when dispatched but not delivered (QUEUED / no SMTP)", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: true,
      delivered: false,
    });
    expect(body.message).toBe("case_opened");
    expect(body.dispatched).toBe(true);
    expect(body.delivered).toBe(false);
  });

  it("marks case_opened when not dispatched", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: false,
      delivered: false,
    });
    expect(body.message).toBe("case_opened");
    expect(body.dispatched).toBe(false);
  });

  it("surfaces needsOutreachEmail from NEEDS_OUTREACH_EMAIL blockReason", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: false,
      delivered: false,
      blockReason: "NEEDS_OUTREACH_EMAIL",
    });
    expect(body.needsOutreachEmail).toBe(true);
    expect(body.blockReason).toBe("NEEDS_OUTREACH_EMAIL");
  });

  it("ORs soft-open needsOutreachEmail flag", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: false,
      delivered: false,
      needsOutreachEmail: true,
    });
    expect(body.needsOutreachEmail).toBe(true);
  });
});

describe("tryExpressMandateSend", () => {
  beforeEach(() => {
    vi.mocked(dispatchAgent).mockReset();
  });

  it("skips dispatch when email is unverified", async () => {
    const res = await tryExpressMandateSend("c1", "u1", null);
    expect(res).toEqual({ dispatched: false, delivered: false });
    expect(dispatchAgent).not.toHaveBeenCalled();
  });

  it("returns delivered from dispatchAgent", async () => {
    vi.mocked(dispatchAgent).mockResolvedValue({ delivered: true } as never);
    const res = await tryExpressMandateSend("c1", "u1", new Date());
    expect(res).toEqual({ dispatched: true, delivered: true });
  });

  it("surfaces CaseError blockReason without throwing", async () => {
    vi.mocked(dispatchAgent).mockRejectedValue(new CaseError("NEEDS_OUTREACH_EMAIL"));
    const res = await tryExpressMandateSend("c1", "u1", new Date());
    expect(res).toEqual({
      dispatched: false,
      delivered: false,
      blockReason: "NEEDS_OUTREACH_EMAIL",
    });
  });

  it("fail-opens on non-CaseError with no blockReason", async () => {
    vi.mocked(dispatchAgent).mockRejectedValue(new Error("boom"));
    const res = await tryExpressMandateSend("c1", "u1", new Date());
    expect(res).toEqual({ dispatched: false, delivered: false });
  });
});

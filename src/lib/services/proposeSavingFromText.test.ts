import { describe, expect, it, vi, beforeEach } from "vitest";

const findCaseFirst = vi.fn();
const outboxCreate = vi.fn();
const outboxFindMany = vi.fn();
const extractSavingsFromEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findFirst: findCaseFirst, findUnique: vi.fn() },
    outbox: { create: outboxCreate, findMany: outboxFindMany },
  },
}));

vi.mock("@/lib/ai", () => ({
  extractSavingsFromEmail,
}));

describe("proposeSavingFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxCreate.mockResolvedValue({ id: "ob_paste" });
  });

  it("rejects non-SENT cases", async () => {
    findCaseFirst.mockResolvedValue({
      id: "c1",
      status: "VERIFIED",
      vertical: "bank_fees",
      amountOriginal: 10_000,
    });
    const { proposeSavingFromText } = await import("./proposeSavingFromText");
    const { CaseError } = await import("./cases");
    await expect(proposeSavingFromText("c1", "u1", "מחיר חדש 80 ש״ח לחודש")).rejects.toBeInstanceOf(
      CaseError,
    );
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it("writes inbound Outbox proposal for high-confidence monthly extract", async () => {
    findCaseFirst.mockResolvedValue({
      id: "c1",
      status: "SENT",
      vertical: "bank_fees",
      amountOriginal: 10_000,
    });
    // getProposedSaving loads case again
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.case.findUnique).mockResolvedValue({
      vertical: "bank_fees",
      amountOriginal: 10_000,
    } as never);

    extractSavingsFromEmail.mockResolvedValue({
      found: true,
      newAmountShekels: 80,
      authorizationCode: null,
      confidence: 0.9,
      amountKind: "monthly",
      reason: "test",
    });

    outboxFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-08-01T12:00:00Z"),
        body: JSON.stringify({
          direction: "inbound",
          from: "paste@user",
          subject: "user-paste",
          extract: {
            found: true,
            newAmountShekels: 80,
            recordAmountShekels: 80,
            confidence: 0.9,
            amountKind: "monthly",
          },
        }),
      },
    ]);

    const { proposeSavingFromText } = await import("./proposeSavingFromText");
    const result = await proposeSavingFromText(
      "c1",
      "u1",
      "שלום, העמלה החודשית עודכנה ל-80 שקלים בלבד.",
    );

    expect(outboxCreate).toHaveBeenCalledOnce();
    const created = outboxCreate.mock.calls[0][0].data;
    expect(created.providerMessageId).toBe("inbound");
    expect(created.caseId).toBe("c1");
    const note = JSON.parse(created.body);
    expect(note.matchMethod).toBe("paste");
    expect(note.extract.found).toBe(true);
    expect(result.proposed?.newAmountShekels).toBe(80);
    expect(result.extract.confidence).toBe(0.9);
  });
});

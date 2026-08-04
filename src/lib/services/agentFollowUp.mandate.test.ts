import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const priorCount = vi.fn();
const rebuild = vi.fn();
const sendEmail = vi.fn();
const emailConfigured = vi.fn();
const resolveOutreach = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: vi.fn(),
    },
    outbox: {
      count: (...args: unknown[]) => priorCount(...args),
    },
  },
}));

vi.mock("@/lib/services/outreachAttachments", () => ({
  rebuildMandateAttachmentsForCase: (...args: unknown[]) => rebuild(...args),
  mandateAttachClaimLine: (hasInbound: boolean) =>
    hasInbound ? "מצורף: HTML + JSON inbound" : "מצורף: HTML",
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  emailConfigured: () => emailConfigured(),
}));

vi.mock("@/lib/caseOutreach", () => ({
  resolveCaseOutreachTo: (...args: unknown[]) => resolveOutreach(...args),
}));

vi.mock("@/lib/followUpRouter", () => ({
  buildFollowUpForVertical: () => ({
    body: "follow body",
    subject: "follow subject",
    tip: "tip",
  }),
}));

vi.mock("@/lib/outreachSwitchingMeta", () => ({
  buildOutreachProtocolFooter: () => "protocol",
}));

vi.mock("@/lib/institutionPull", () => ({
  institutionPullFooterLine: () => "",
  institutionPipeMagnetLine: () => "",
  institutionSalesEmail: () => "sales@example.com",
}));

vi.mock("@/lib/providers", () => ({
  providerHebrewName: (p: string) => p,
}));

vi.mock("@/lib/money", () => ({
  agorotToShekels: (n: number) => n / 100,
}));

vi.mock("@/lib/push", () => ({
  pushToUser: vi.fn(async () => undefined),
}));

vi.mock("@/lib/mandate/document", () => ({
  proofsInboundAddress: () => "proofs@example.com",
}));

import { dispatchCaseFollowUp } from "./agentFollowUp";

describe("dispatchCaseFollowUp Mandate attach", () => {
  beforeEach(() => {
    findUnique.mockReset();
    priorCount.mockReset();
    rebuild.mockReset();
    sendEmail.mockReset();
    emailConfigured.mockReset();
    resolveOutreach.mockReset();
    priorCount.mockResolvedValue(0);
    emailConfigured.mockReturnValue(true);
    resolveOutreach.mockReturnValue("provider@example.com");
    findUnique.mockResolvedValue({
      id: "c1",
      status: "SENT",
      ownershipVerifiedAt: new Date(),
      provider: "partner",
      vertical: "telecom",
      strategy: null,
      amountOriginal: 10000,
      targetAmount: 8000,
      planDescription: null,
      counterpartyEmail: "provider@example.com",
      authorization: {
        status: "ACTIVE",
        code: "ZK-A",
        principalName: "Ada",
        mandateJti: null,
        mandateJws: null,
      },
      user: { id: "u1", name: "Ada", email: "a@example.com" },
    });
  });

  it("refuses send when Mandate attachments are unavailable (keys live, no JWS)", async () => {
    rebuild.mockResolvedValue([]);
    const result = await dispatchCaseFollowUp("c1", { replyKind: "delay" });
    expect(result).toMatchObject({ sent: false, reason: "MANDATE_REQUIRED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends with rebuilt attachments when Mandate docs are available", async () => {
    rebuild.mockResolvedValue([
      { filename: "mandate.html", content: "<html/>" },
      { filename: "inbound.json", content: "{}" },
    ]);
    sendEmail.mockResolvedValue({ status: "SENT" });
    const result = await dispatchCaseFollowUp("c1", { replyKind: "delay" });
    expect(result.sent).toBe(true);
    expect(result.delivered).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "mandate.html" }),
          expect.objectContaining({ filename: "inbound.json" }),
        ]),
      }),
    );
  });
});

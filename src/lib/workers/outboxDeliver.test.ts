import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();
const authFindUnique = vi.fn();
const sendMail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outbox: {
      findMany: (...args: unknown[]) => findMany(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
    authorization: {
      findUnique: (...args: unknown[]) => authFindUnique(...args),
    },
  },
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: (...args: unknown[]) => sendMail(...args) }) },
}));

vi.mock("@/lib/services/outreachAttachments", () => ({
  rebuildMandateAttachmentsForCase: vi.fn(async () => []),
  shouldAttachMandateDocs: () => false,
}));

vi.mock("@/lib/mandate/document", () => ({
  proofsInboundAddress: () => "proofs@zakai.app",
}));

vi.mock("@/lib/deploy/smtpConfigured", () => ({
  smtpFullyConfigured: () => true,
}));

vi.mock("@/lib/services/outreachDeliveredNotify", () => ({
  notifyUserProviderOutreachDelivered: vi.fn(async () => false),
}));

vi.mock("@/lib/institutionOutboundNotify", () => ({
  notifyInstitutionOnOutboundSend: vi.fn(async () => undefined),
}));

import { processOutboxBatch } from "./outboxDeliver";

function baseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "row_1",
    caseId: null,
    channel: "EMAIL",
    toAddress: "user@example.com",
    subject: "Subject",
    body: "Body",
    status: "QUEUED",
    providerMessageId: null,
    error: null,
    createdAt: new Date(),
    sentAt: null,
    ...overrides,
  };
}

describe("processOutboxBatch — claim before send", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    findUnique.mockReset();
    update.mockReset();
    authFindUnique.mockReset();
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  it(
    "sends exactly once when the claim succeeds — the normal single-worker path",
    async () => {
      const row = baseRow();
      findMany.mockResolvedValue([row]);
      updateMany.mockResolvedValue({ count: 1 });
      findUnique.mockResolvedValue(row);
      update.mockResolvedValue(row);

      const result = await processOutboxBatch();

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: "row_1", status: "QUEUED", error: null },
        data: { status: "QUEUED", error: null },
      });
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(result.sent).toBe(1);
      expect(result.skipped).toBe(0);
    },
  );

  it(
    "never calls sendMail when a concurrent invocation already claimed the row — " +
      "this is the exact bug this test guards against: two overlapping cron runs " +
      "(a Vercel retry, or a manual drain landing next to the scheduled one) reading " +
      "the same QUEUED row and both sending the same letter/OTP/fee-confirm twice",
    async () => {
      const row = baseRow();
      findMany.mockResolvedValue([row]);
      // Simulates another worker's updateMany having already changed status/error
      // between our findMany read and our own claim attempt.
      updateMany.mockResolvedValue({ count: 0 });

      const result = await processOutboxBatch();

      expect(sendMail).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.sent).toBe(0);
    },
  );

  it("preserves the real attempt count through the claim for a retried FAILED row", async () => {
    const row = baseRow({ status: "FAILED", error: "[attempts=2] smtp timeout" });
    findMany.mockResolvedValue([row]);
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ ...row, status: "QUEUED", error: "[attempts=2]" });
    update.mockResolvedValue(row);

    await processOutboxBatch();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "row_1", status: "FAILED", error: "[attempts=2] smtp timeout" },
      data: { status: "QUEUED", error: "[attempts=2]" },
    });
  });

  it("dead-letters without ever claiming or sending once MAX_OUTBOX_ATTEMPTS is hit", async () => {
    const row = baseRow({ status: "FAILED", error: "[attempts=5] smtp timeout" });
    findMany.mockResolvedValue([row]);
    update.mockResolvedValue(row);

    const result = await processOutboxBatch();

    expect(updateMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

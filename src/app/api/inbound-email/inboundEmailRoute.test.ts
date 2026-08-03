import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const findAuthUnique = vi.fn();
const findAuthFirst = vi.fn();
const findCaseUnique = vi.fn();
const outboxCreate = vi.fn();
const findUserUnique = vi.fn();
const extractSavingsFromEmail = vi.fn();
const sendEmail = vi.fn();
const pushToUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorization: {
      findUnique: findAuthUnique,
      findFirst: findAuthFirst,
    },
    case: { findUnique: findCaseUnique },
    outbox: { create: outboxCreate },
    user: { findUnique: findUserUnique },
  },
}));

vi.mock("@/lib/ai", () => ({
  extractSavingsFromEmail,
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail,
}));

vi.mock("@/lib/push", () => ({
  pushToUser: pushToUser,
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 99 })),
  clientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/report-error", () => ({
  reportError: vi.fn(),
}));

describe("POST /api/inbound-email", () => {
  const prevSecret = process.env.INBOUND_EMAIL_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INBOUND_EMAIL_SECRET;
    outboxCreate.mockResolvedValue({ id: "ob_1" });
    sendEmail.mockResolvedValue(undefined);
    pushToUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.INBOUND_EMAIL_SECRET;
    else process.env.INBOUND_EMAIL_SECRET = prevSecret;
  });

  async function post(body: unknown, headers?: Record<string, string>) {
    const { POST } = await import("@/app/api/inbound-email/route");
    return POST(
      new Request("http://localhost/api/inbound-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
  }

  it("deposit lump + ZK code match → record 0, outbox audit, notify user", async () => {
    const caseId = "case_dep_1";
    const userId = "user_1";
    const code = "ZK-DEP01";

    extractSavingsFromEmail.mockResolvedValue({
      found: true,
      newAmountShekels: 8000,
      authorizationCode: code,
      confidence: 0.55,
      amountKind: "refund",
      reason: "test",
    });

    findAuthUnique.mockResolvedValue({
      code,
      status: "ACTIVE",
      caseId,
      case: { id: caseId, userId, status: "SENT" },
    });

    findCaseUnique.mockResolvedValue({
      vertical: "deposit",
      amountOriginal: 800_000,
    });

    findUserUnique.mockResolvedValue({
      id: userId,
      email: "user@example.com",
      name: "Test",
      country: "IL",
    });

    const res = await post({
      from: "landlord@example.com",
      subject: `אישור החזר ${code}`,
      text: "הוחזר פיקדון במלואו",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.matched).toBe(true);
    expect(json.caseId).toBe(caseId);
    expect(json.matchMethod).toBe("code");
    expect(json.notified).toBe(true);

    expect(outboxCreate).toHaveBeenCalledOnce();
    const outboxBody = outboxCreate.mock.calls[0]![0].data.body as string;
    const logged = JSON.parse(outboxBody) as {
      extract: { recordAmountShekels?: number };
    };
    expect(logged.extract.recordAmountShekels).toBe(0);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(pushToUser).toHaveBeenCalledOnce();
  });

  it("rejects when INBOUND_EMAIL_SECRET is set and header missing", async () => {
    process.env.INBOUND_EMAIL_SECRET = "test-secret";
    const res = await post({ from: "a@b.com", subject: "hi", text: "x" });
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    const res = await post({ from: "" });
    expect(res.status).toBe(400);
  });

  it("telecom monthly + email match with high confidence → notify", async () => {
    const caseId = "case_tel_1";
    const userId = "user_2";
    const from = "billing@cellcom.co.il";

    extractSavingsFromEmail.mockResolvedValue({
      found: true,
      newAmountShekels: 89,
      authorizationCode: null,
      confidence: 0.72,
      amountKind: "monthly",
      reason: "test",
    });

    findAuthUnique.mockResolvedValue(null);
    findAuthFirst.mockResolvedValue({
      principalEmail: from,
      status: "ACTIVE",
      caseId,
      case: { id: caseId, userId, status: "SENT" },
    });

    findCaseUnique.mockResolvedValue({
      vertical: "telecom",
      amountOriginal: 12_900,
    });

    findUserUnique.mockResolvedValue({
      id: userId,
      email: "user2@example.com",
      name: "User",
      country: "IL",
    });

    const res = await post({
      from,
      subject: "עדכון חיוב",
      text: "החיוב החודשי החדש 89 שקל",
    });
    const json = await res.json();

    expect(json.matched).toBe(true);
    expect(json.matchMethod).toBe("email");
    expect(json.notified).toBe(true);

    const outboxBody = outboxCreate.mock.calls[0]![0].data.body as string;
    const logged = JSON.parse(outboxBody) as {
      extract: { recordAmountShekels?: number };
    };
    expect(logged.extract.recordAmountShekels).toBe(89);
  });

  it("ZK-code match on SENT works even when Mandate is REVOKED", async () => {
    const caseId = "case_revoked_1";
    const userId = "user_rev";
    const code = "ZK-REV01";

    extractSavingsFromEmail.mockResolvedValue({
      found: true,
      newAmountShekels: 70,
      authorizationCode: code,
      confidence: 0.8,
      amountKind: "monthly",
      reason: "test",
    });

    findAuthUnique.mockResolvedValue({
      code,
      status: "REVOKED",
      caseId,
      case: { id: caseId, userId, status: "SENT" },
    });

    findCaseUnique.mockResolvedValue({
      vertical: "telecom",
      amountOriginal: 12_900,
    });

    findUserUnique.mockResolvedValue({
      id: userId,
      email: "user@example.com",
      name: "Test",
      country: "IL",
    });

    const res = await post({
      from: "billing@cellcom.co.il",
      subject: `אישור ${code}`,
      text: "החיוב החדש 70 שקל",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.matched).toBe(true);
    expect(json.caseId).toBe(caseId);
    expect(json.matchMethod).toBe("code");
    expect(json.notified).toBe(true);
  });

  it("email match below confidence threshold → matched but not notified", async () => {
    extractSavingsFromEmail.mockResolvedValue({
      found: true,
      newAmountShekels: 89,
      confidence: 0.55,
      authorizationCode: null,
      reason: "test",
    });
    findAuthUnique.mockResolvedValue(null);
    findAuthFirst.mockResolvedValue({
      status: "ACTIVE",
      caseId: "c1",
      case: { id: "c1", userId: "u1", status: "SENT" },
    });
    findCaseUnique.mockResolvedValue({ vertical: "telecom", amountOriginal: 12_900 });

    const res = await post({
      from: "billing@example.com",
      subject: "bill",
      text: "89",
    });
    const json = await res.json();
    expect(json.matched).toBe(true);
    expect(json.notified).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

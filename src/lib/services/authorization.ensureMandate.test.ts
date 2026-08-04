import { beforeEach, describe, expect, it, vi } from "vitest";

const authFindUnique = vi.fn();
const authUpdate = vi.fn();
const caseFindUnique = vi.fn();
const allocateStatusIndex = vi.fn();
const statusIndexForJti = vi.fn();
const publishRevocation = vi.fn();
const issueMandate = vi.fn();
const loadSigningKeyFromEnv = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorization: {
      findUnique: (...args: unknown[]) => authFindUnique(...args),
      update: (...args: unknown[]) => authUpdate(...args),
    },
    case: {
      findUnique: (...args: unknown[]) => caseFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => transactionMock(fn),
  },
}));

vi.mock("@/lib/mandate/statusIndex", () => ({
  allocateStatusIndex: (...args: unknown[]) => allocateStatusIndex(...args),
  statusIndexForJti: (...args: unknown[]) => statusIndexForJti(...args),
  publishRevocation: (...args: unknown[]) => publishRevocation(...args),
  statusListUriForIssuer: () => "https://issuer.example/api/mandate/revocations",
}));

vi.mock("@/lib/mandate/mandate", () => ({
  issueMandate: (...args: unknown[]) => issueMandate(...args),
  loadSigningKeyFromEnv: () => loadSigningKeyFromEnv(),
  MandateKeyUnavailableError: class MandateKeyUnavailableError extends Error {},
}));

vi.mock("@/lib/institutionAudience", () => ({
  resolveMandateAudience: () => "probe-bank",
}));

vi.mock("@/lib/codes", () => ({
  generateAuthorizationCode: () => "ZK-NEW-CODE",
}));

vi.mock("@/lib/phone", () => ({
  maskPhone: (p: string) => p,
}));

import { createAuthorization, ensureMandateTokenForCase } from "./authorization";

describe("ensureMandateTokenForCase", () => {
  beforeEach(() => {
    authFindUnique.mockReset();
    authUpdate.mockReset();
    caseFindUnique.mockReset();
    allocateStatusIndex.mockReset();
    statusIndexForJti.mockReset();
    publishRevocation.mockReset();
    issueMandate.mockReset();
    loadSigningKeyFromEnv.mockReset();
    transactionMock.mockReset();
    loadSigningKeyFromEnv.mockReturnValue({ kid: "k", privateJwk: {} });
    issueMandate.mockResolvedValue("signed.jws.token");
    authUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      caseId: "c1",
      ...data,
    }));
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  });

  it("returns existing jti+jws without resigning", async () => {
    authFindUnique.mockResolvedValue({
      status: "ACTIVE",
      mandateJti: "jti-live",
      mandateJws: "existing.jws",
      mandateStatusIndex: 3,
      code: "ZK-A",
      mandateAudience: "probe-bank",
    });
    const result = await ensureMandateTokenForCase("c1");
    expect(result).toEqual({ jti: "jti-live", jws: "existing.jws" });
    expect(issueMandate).not.toHaveBeenCalled();
    expect(allocateStatusIndex).not.toHaveBeenCalled();
  });

  it("heals missing jws with the same jti and status bit — never remints", async () => {
    authFindUnique.mockResolvedValue({
      status: "ACTIVE",
      mandateJti: "jti-heal",
      mandateJws: null,
      mandateStatusIndex: 7,
      code: "ZK-A",
      mandateAudience: "probe-bank",
    });
    caseFindUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      provider: "partner",
      user: {
        name: "Ada",
        email: "a@example.com",
        phone: "050",
        country: "IL",
      },
    });

    const result = await ensureMandateTokenForCase("c1");
    expect(result?.jti).toBe("jti-heal");
    expect(result?.jws).toBe("signed.jws.token");
    expect(allocateStatusIndex).not.toHaveBeenCalled();
    expect(issueMandate).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: "jti-heal",
        status: expect.objectContaining({ idx: 7 }),
      }),
      expect.anything(),
    );
    expect(authUpdate).toHaveBeenCalledWith({
      where: { caseId: "c1" },
      data: expect.objectContaining({
        mandateJti: "jti-heal",
        mandateJws: "signed.jws.token",
        mandateStatusIndex: 7,
      }),
    });
  });

  it("fails closed on heal when the issue-time status bit is unknown", async () => {
    authFindUnique.mockResolvedValue({
      status: "ACTIVE",
      mandateJti: "jti-orphan",
      mandateJws: null,
      mandateStatusIndex: null,
      code: "ZK-A",
      mandateAudience: "probe-bank",
    });
    caseFindUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      provider: "partner",
      user: { name: "Ada", email: "a@example.com", phone: "050", country: "IL" },
    });
    statusIndexForJti.mockResolvedValue(undefined);

    const result = await ensureMandateTokenForCase("c1");
    expect(result).toBeUndefined();
    expect(allocateStatusIndex).not.toHaveBeenCalled();
    expect(issueMandate).not.toHaveBeenCalled();
  });

  it("mints a fresh jti only when Authorization has no mandateJti", async () => {
    authFindUnique.mockResolvedValue({
      status: "ACTIVE",
      mandateJti: null,
      mandateJws: null,
      mandateStatusIndex: null,
      code: "ZK-A",
      mandateAudience: "probe-bank",
    });
    caseFindUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      provider: "partner",
      user: { name: "Ada", email: "a@example.com", phone: "050", country: "IL" },
    });
    allocateStatusIndex.mockResolvedValue(11);

    const result = await ensureMandateTokenForCase("c1");
    expect(result?.jws).toBe("signed.jws.token");
    expect(allocateStatusIndex).toHaveBeenCalledTimes(1);
    expect(issueMandate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({ idx: 11 }),
      }),
      expect.anything(),
    );
    expect(issueMandate.mock.calls[0][0].jti).not.toBe("jti-heal");
  });
});

describe("reissueAuthorization via createAuthorization", () => {
  beforeEach(() => {
    authFindUnique.mockReset();
    authUpdate.mockReset();
    caseFindUnique.mockReset();
    allocateStatusIndex.mockReset();
    publishRevocation.mockReset();
    issueMandate.mockReset();
    loadSigningKeyFromEnv.mockReset();
    transactionMock.mockReset();
    loadSigningKeyFromEnv.mockReturnValue({ kid: "k", privateJwk: {} });
    issueMandate.mockResolvedValue("fresh.jws.token");
    allocateStatusIndex.mockResolvedValue(22);
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
    authUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "auth1",
      caseId: "c1",
      code: "ZK-NEW-CODE",
      status: "ACTIVE",
      ...data,
    }));
  });

  it("publishes prior jti and clears Mandate fields before minting a replacement", async () => {
    authFindUnique
      .mockResolvedValueOnce({
        id: "auth1",
        caseId: "c1",
        status: "REVOKED",
        mandateJti: "jti-old",
        mandateJws: "old.jws",
        mandateStatusIndex: 4,
        code: "ZK-OLD",
      })
      // code uniqueness check inside the reissue loop
      .mockResolvedValueOnce(null);

    caseFindUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      provider: "partner",
      user: { name: "Ada", email: "a@example.com", phone: "050", country: "IL" },
    });

    await createAuthorization("c1");

    expect(publishRevocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jti: "jti-old",
        reason: "reissue",
        statusIndex: 4,
      }),
    );
    expect(authUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "ACTIVE",
        mandateJti: null,
        mandateJws: null,
        mandateStatusIndex: null,
      }),
    );
    expect(allocateStatusIndex).toHaveBeenCalled();
  });
});

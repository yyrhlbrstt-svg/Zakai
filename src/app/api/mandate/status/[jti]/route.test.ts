import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const allocFindUniqueMock = vi.fn();
const authFindFirstMock = vi.fn();
const aggregateMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mandateRevocation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => transactionMock(fn),
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/security/timingSafe", () => ({
  secretsMatch: (a: string, b: string) => a.length > 0 && a === b,
}));

import { POST } from "./route";

describe("POST /api/mandate/status/[jti]", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    allocFindUniqueMock.mockReset();
    authFindFirstMock.mockReset();
    aggregateMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    transactionMock.mockReset();
    process.env.MANDATE_REVOKE_KEY = "test-revoke-key";

    const tx = {
      mandateRevocation: {
        findUnique: findUniqueMock,
        aggregate: aggregateMock,
        create: createMock,
        update: updateMock,
      },
      mandateStatusAllocation: {
        findUnique: allocFindUniqueMock,
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      authorization: {
        aggregate: vi.fn(),
        findFirst: authFindFirstMock,
      },
    };
    transactionMock.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it("reuses the issue-time allocation so the signed list flips the claimed bit", async () => {
    findUniqueMock.mockResolvedValue(null);
    allocFindUniqueMock.mockResolvedValue({ statusIndex: 5 });
    createMock.mockResolvedValue({
      jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      statusIndex: 5,
      revokedAt: new Date("2026-08-03T12:00:00.000Z"),
      reason: "ops",
    });

    const res = await POST(
      new Request("http://localhost/api/mandate/status/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-zakai-revoke-key": "test-revoke-key",
        },
        body: JSON.stringify({ reason: "ops" }),
      }),
      { params: Promise.resolve({ jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("revoked");
    expect(body.statusIndex).toBe(5);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusIndex: 5 }),
      }),
    );
  });

  it("repairs a null statusIndex when allocation is known", async () => {
    findUniqueMock.mockResolvedValue({
      jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      statusIndex: null,
      revokedAt: new Date("2026-08-03T11:00:00.000Z"),
      reason: "user_request",
    });
    allocFindUniqueMock.mockResolvedValue({ statusIndex: 10 });
    updateMock.mockResolvedValue({
      jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      statusIndex: 10,
      revokedAt: new Date("2026-08-03T11:00:00.000Z"),
      reason: "user_request",
    });

    const res = await POST(
      new Request("http://localhost/api/mandate/status/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
        method: "POST",
        headers: { "x-zakai-revoke-key": "test-revoke-key" },
        body: "{}",
      }),
      { params: Promise.resolve({ jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.statusIndex).toBe(10);
    expect(updateMock).toHaveBeenCalled();
  });

  it("fails closed with status_index_unknown when no issue-time bit exists", async () => {
    findUniqueMock.mockResolvedValue(null);
    allocFindUniqueMock.mockResolvedValue(null);
    authFindFirstMock.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/mandate/status/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
        method: "POST",
        headers: { "x-zakai-revoke-key": "test-revoke-key" },
        body: "{}",
      }),
      { params: Promise.resolve({ jti: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }) },
    );

    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("status_index_unknown");
    expect(createMock).not.toHaveBeenCalled();
  });
});

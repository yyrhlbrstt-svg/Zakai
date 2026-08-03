import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();
const publishMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorization: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => transactionMock(fn),
  },
}));

vi.mock("@/lib/mandate/statusIndex", () => ({
  publishRevocation: (...args: unknown[]) => publishMock(...args),
}));

import { revokeAuthority } from "./authorityControl";

describe("revokeAuthority publishes machine jti", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    publishMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        authorization: { update: updateMock },
      }),
    );
  });

  it("publishes Mandate jti, never the human ZK code", async () => {
    findFirstMock.mockResolvedValue({
      code: "ZK-ABC-TEST",
      status: "ACTIVE",
      mandateJti: "11111111-2222-3333-4444-555555555555",
    });
    publishMock.mockResolvedValue({
      jti: "11111111-2222-3333-4444-555555555555",
      statusIndex: 0,
      revokedAt: new Date(),
      reason: "user_request",
    });

    const result = await revokeAuthority("user_1", "zk-abc-test");
    expect(result).toEqual({ ok: true, code: "ZK-ABC-TEST", alreadyRevoked: false });
    expect(publishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jti: "11111111-2222-3333-4444-555555555555",
        reason: "user_request",
      }),
    );
    expect(publishMock.mock.calls[0][1].jti).not.toMatch(/^ZK-/);
  });

  it("skips status-list publish when no machine mandate was issued", async () => {
    findFirstMock.mockResolvedValue({
      code: "ZK-NO-MND",
      status: "ACTIVE",
      mandateJti: null,
    });

    const result = await revokeAuthority("user_1", "ZK-NO-MND");
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});

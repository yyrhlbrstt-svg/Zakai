import { beforeEach, describe, expect, it, vi } from "vitest";

const authFindUnique = vi.fn();
const referenceVerifierFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorization: {
      findUnique: (...args: unknown[]) => authFindUnique(...args),
    },
    referenceVerifier: {
      findUnique: (...args: unknown[]) => referenceVerifierFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/mandate/statusIndex", () => ({
  allocateStatusIndex: vi.fn(),
  statusIndexForJti: vi.fn(),
  publishRevocation: vi.fn(),
  statusListUriForIssuer: () => "https://issuer.example/api/mandate/revocations",
}));

vi.mock("@/lib/mandate/mandate", () => ({
  issueMandate: vi.fn(),
  loadSigningKeyFromEnv: vi.fn(),
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

import { getPublicAuthorization } from "./authorization";

describe("getPublicAuthorization", () => {
  beforeEach(() => {
    authFindUnique.mockReset();
    referenceVerifierFindUnique.mockReset();
  });

  it("returns the masked row for a real code", async () => {
    authFindUnique.mockResolvedValue({
      code: "ZK-A1B2-C3D4",
      status: "ACTIVE",
      principalName: "Ada",
      principalPhone: "0501234567",
      provider: "cellcom",
      mandateAudience: null,
    });
    referenceVerifierFindUnique.mockResolvedValue(null);

    const result = await getPublicAuthorization("zk-a1b2-c3d4");
    expect(result?.code).toBe("ZK-A1B2-C3D4");
    expect(authFindUnique).toHaveBeenCalledWith({ where: { code: "ZK-A1B2-C3D4" } });
  });

  it("returns null (not a throw) when no such code exists — the page 404s on null", async () => {
    authFindUnique.mockResolvedValue(null);
    await expect(getPublicAuthorization("ZK-NONE-0000")).resolves.toBeNull();
  });

  it(
    "returns null rather than throwing when the DB is unreachable — this is a public, " +
      "unauthenticated page reachable by anyone with a code, so a DB blip must 404, not 500",
    async () => {
      authFindUnique.mockRejectedValue(new Error("db down"));
      await expect(getPublicAuthorization("ZK-A1B2-C3D4")).resolves.toBeNull();
    },
  );
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const authFindUnique = vi.fn();
const referenceVerifierFindUnique = vi.fn();
const caseFindUnique = vi.fn();
const outboxFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorization: {
      findUnique: (...args: unknown[]) => authFindUnique(...args),
    },
    referenceVerifier: {
      findUnique: (...args: unknown[]) => referenceVerifierFindUnique(...args),
    },
    case: {
      findUnique: (...args: unknown[]) => caseFindUnique(...args),
    },
    outbox: {
      findMany: (...args: unknown[]) => outboxFindMany(...args),
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
    caseFindUnique.mockReset();
    outboxFindMany.mockReset();
    caseFindUnique.mockResolvedValue(null);
    outboxFindMany.mockResolvedValue([]);
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

  it("returns the written-demand trail with Outbox honesty intact (QUEUED is not SENT)", async () => {
    authFindUnique.mockResolvedValue({
      caseId: "case-1",
      code: "ZK-A1B2-C3D4",
      status: "ACTIVE",
      principalName: "Ada",
      principalPhone: "0501234567",
      provider: "cellcom",
      mandateAudience: null,
    });
    referenceVerifierFindUnique.mockResolvedValue(null);
    caseFindUnique.mockResolvedValue({ vertical: "subscription" });
    outboxFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-08-01T10:00:00Z"),
        sentAt: null,
        subject: "הודעת ביטול — מנוי",
        status: "QUEUED",
      },
      {
        createdAt: new Date("2026-08-10T10:00:00Z"),
        sentAt: new Date("2026-08-10T10:00:05Z"),
        subject: "חיוב שנמשך לאחר הודעת ביטול",
        status: "SENT",
      },
    ]);

    const result = await getPublicAuthorization("ZK-A1B2-C3D4");
    expect(result?.writtenDemands).toHaveLength(2);
    expect(result?.writtenDemands?.[0]).toMatchObject({ delivery: "QUEUED", sentAt: null });
    expect(result?.writtenDemands?.[1]).toMatchObject({ delivery: "SENT" });
    // Subjects only, never bodies — the trail adds dates, not content.
    expect(JSON.stringify(result?.writtenDemands)).not.toContain("body");
  });

  it("attaches the statutory basis from the Rights Graph for the statutory-cancel vertical only", async () => {
    authFindUnique.mockResolvedValue({
      caseId: "case-1",
      code: "ZK-A1B2-C3D4",
      status: "ACTIVE",
      principalName: "Ada",
      principalPhone: "0501234567",
      provider: "cellcom",
      mandateAudience: null,
    });
    referenceVerifierFindUnique.mockResolvedValue(null);

    caseFindUnique.mockResolvedValue({ vertical: "subscription" });
    const withBasis = await getPublicAuthorization("ZK-A1B2-C3D4");
    expect(withBasis?.statutoryBasis?.law).toContain("חוק הגנת הצרכן");
    expect(withBasis?.statutoryBasis?.sourceUrl).toMatch(/^https:/);

    caseFindUnique.mockResolvedValue({ vertical: "telecom" });
    const withoutBasis = await getPublicAuthorization("ZK-A1B2-C3D4");
    expect(withoutBasis?.statutoryBasis).toBeNull();
  });

  it("degrades to an empty trail — never a throw — when the case/outbox lookups fail", async () => {
    authFindUnique.mockResolvedValue({
      caseId: "case-1",
      code: "ZK-A1B2-C3D4",
      status: "ACTIVE",
      principalName: "Ada",
      principalPhone: "0501234567",
      provider: "cellcom",
      mandateAudience: null,
    });
    referenceVerifierFindUnique.mockResolvedValue(null);
    caseFindUnique.mockRejectedValue(new Error("db down"));

    const result = await getPublicAuthorization("ZK-A1B2-C3D4");
    expect(result?.code).toBe("ZK-A1B2-C3D4");
    expect(result?.writtenDemands).toEqual([]);
  });
});

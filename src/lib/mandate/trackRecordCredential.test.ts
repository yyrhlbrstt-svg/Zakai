import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK } from "jose";

const aggregate = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savingsProof: {
      aggregate: (...args: unknown[]) => aggregate(...args),
      count: (...args: unknown[]) => count(...args),
    },
    case: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import {
  loadTrackRecordStats,
  issueTrackRecordCredential,
  verifyTrackRecordCredential,
  TrackRecordUnavailableError,
  TrackRecordVerifyError,
  TRACK_RECORD_TYPE,
} from "./trackRecordCredential";
import { publicJwkFor, type SigningKey } from "./mandate";

describe("loadTrackRecordStats", () => {
  beforeEach(() => {
    aggregate.mockReset();
    count.mockReset();
    findFirst.mockReset();
  });

  it("sums only verified (non-self-reported) savings for this user", async () => {
    aggregate.mockResolvedValue({ _sum: { savingMonthly: 12_000 } });
    count.mockResolvedValue(3);
    findFirst.mockResolvedValue({ createdAt: new Date("2025-01-01T00:00:00.000Z") });

    const stats = await loadTrackRecordStats("user_1");

    expect(aggregate).toHaveBeenCalledWith({
      where: { selfReported: false, case: { userId: "user_1" } },
      _sum: { savingMonthly: true },
    });
    expect(stats).toEqual({
      resolvedCases: 3,
      documentedMonthlySavingAgorot: 12_000,
      activeSince: "2025-01-01T00:00:00.000Z",
    });
  });

  it("throws rather than returning fabricated zeros when the DB is unreachable", async () => {
    aggregate.mockRejectedValue(new Error("db down"));
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    await expect(loadTrackRecordStats("user_1")).rejects.toThrow(TrackRecordUnavailableError);
  });
});

describe("issueTrackRecordCredential + verifyTrackRecordCredential", () => {
  let key: SigningKey;

  beforeEach(async () => {
    aggregate.mockReset();
    count.mockReset();
    findFirst.mockReset();
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    key = { kid: "test-key", privateJwk: await exportJWK(privateKey) };
  });

  it("refuses to issue a credential with zero resolved cases", async () => {
    aggregate.mockResolvedValue({ _sum: { savingMonthly: null } });
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    await expect(issueTrackRecordCredential("user_1", "https://zakai.test", key)).rejects.toThrow(
      TrackRecordUnavailableError,
    );
  });

  it("issues a real, verifiable credential carrying the actual stats", async () => {
    aggregate.mockResolvedValue({ _sum: { savingMonthly: 5_000 } });
    count.mockResolvedValue(2);
    findFirst.mockResolvedValue({ createdAt: new Date("2025-06-01T00:00:00.000Z") });

    const { token, stats } = await issueTrackRecordCredential("user_1", "https://zakai.test", key);
    expect(stats.resolvedCases).toBe(2);

    const publicJwk = await publicJwkFor(key);
    const claims = await verifyTrackRecordCredential(token, [publicJwk]);
    expect(claims.iss).toBe("https://zakai.test");
    expect(claims.stats).toEqual(stats);
  });

  it("rejects a mandate token presented as a track-record credential (wrong typ)", async () => {
    const { SignJWT, importJWK } = await import("jose");
    const privateKey = await importJWK(key.privateJwk, "EdDSA");
    const notATrackRecord = await new SignJWT({ scope: "contract:cancel" })
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "JWT" })
      .setIssuer("https://zakai.test")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(privateKey);

    const publicJwk = await publicJwkFor(key);
    await expect(verifyTrackRecordCredential(notATrackRecord, [publicJwk])).rejects.toMatchObject({
      code: "WRONG_TYPE",
    } satisfies Partial<TrackRecordVerifyError>);
  });

  it("rejects a credential signed by a key not in the caller's JWKS", async () => {
    aggregate.mockResolvedValue({ _sum: { savingMonthly: 1_000 } });
    count.mockResolvedValue(1);
    findFirst.mockResolvedValue({ createdAt: new Date() });
    const { token } = await issueTrackRecordCredential("user_1", "https://zakai.test", key);

    const { privateKey: otherPriv } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const otherKey: SigningKey = { kid: "other", privateJwk: await exportJWK(otherPriv) };
    const otherPublicJwk = await publicJwkFor(otherKey);

    await expect(verifyTrackRecordCredential(token, [otherPublicJwk])).rejects.toMatchObject({
      code: "INVALID_SIGNATURE",
    });
  });
});

it("has a distinct typ so it can never be mistaken for a Mandate authorisation", () => {
  expect(TRACK_RECORD_TYPE).not.toBe("JWT");
  expect(TRACK_RECORD_TYPE).toContain("track-record");
});

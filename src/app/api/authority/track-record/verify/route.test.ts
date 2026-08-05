import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK } from "jose";

const rateLimit = vi.fn();
let signingKey: { kid: string; privateJwk: JsonWebKey };

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savingsProof: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { savingMonthly: 12000 } }),
      count: vi.fn().mockResolvedValue(3),
    },
    case: {
      findFirst: vi.fn().mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
    },
  },
}));

vi.mock("@/lib/mandate/mandate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mandate/mandate")>("@/lib/mandate/mandate");
  return {
    ...actual,
    loadSigningKeyFromEnv: () => signingKey,
  };
});

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { POST } from "./route";
import { issueTrackRecordCredential } from "@/lib/mandate/trackRecordCredential";

function req(body: unknown) {
  return new Request("http://localhost/api/authority/track-record/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/authority/track-record/verify", () => {
  beforeEach(async () => {
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, remaining: 59 });
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    signingKey = { kid: "k1", privateJwk: (await exportJWK(privateKey)) as JsonWebKey };
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies a real credential and returns the real stats it carries", async () => {
    const { token, stats } = await issueTrackRecordCredential("user_1", "https://zakai.test", signingKey as never);
    const res = await POST(req({ token }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.stats).toEqual(stats);
    expect(body.issuer).toBe("https://zakai.test");
  });

  it("reports a tampered/garbage token as verified:false, not a crash", async () => {
    const res = await POST(req({ token: "not.a.real.credential.at.all.zzz" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.verified).toBe(false);
    expect(body.reason).toBeDefined();
  });

  it("rejects a token signed by a different key", async () => {
    const { privateKey: otherPriv } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const otherKey = { kid: "other", privateJwk: (await exportJWK(otherPriv)) as JsonWebKey };
    const { token } = await issueTrackRecordCredential("user_1", "https://zakai.test", otherKey as never);
    const res = await POST(req({ token }));
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("INVALID_SIGNATURE");
  });

  it("rejects a malformed request body", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("enforces the rate limit", async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await POST(req({ token: "whatever" }));
    expect(res.status).toBe(429);
  });
});

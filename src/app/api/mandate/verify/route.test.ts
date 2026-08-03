import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/mandate/verifyWithRegistry", () => ({
  verifyMandateWithTrustRegistry: (...args: unknown[]) => verifyMock(...args),
  RegistryVerifyError: class RegistryVerifyError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mandateRevocation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "./route";

const claims = {
  jti: "jti_test_1",
  aud: "bank-demo",
  sub: "user_1",
  scopes: ["negotiate_fees"],
  market: "IL",
  exp: Math.floor(Date.now() / 1000) + 3600,
  principal: { name: "Test" },
  statement: "test",
};

function verifyRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/mandate/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mandate/verify", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    findUniqueMock.mockReset();
    verifyMock.mockResolvedValue({
      claims,
      issuer: {
        iss: "https://zakai.example",
        name: "Zakai",
        status: "active",
        jwksUri: "https://zakai.example/.well-known/zakai-jwks.json",
      },
    });
  });

  it("denies when revocation store is unavailable (never valid:true)", async () => {
    findUniqueMock.mockRejectedValue(new Error("db down"));
    const res = await POST(verifyRequest({ token: "eyJ.fake", audience: "bank-demo" }));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("revocation_unknown");
    expect(body.jti).toBe("jti_test_1");
  });

  it("returns 410 when jti is revoked", async () => {
    findUniqueMock.mockResolvedValue({ jti: "jti_test_1" });
    const res = await POST(verifyRequest({ mandate: "eyJ.fake", audience: "bank-demo" }));
    const body = await res.json();
    expect(res.status).toBe(410);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("revoked");
  });

  it("returns valid when signature ok and revocation row absent", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await POST(verifyRequest({ token: "eyJ.fake", audience: "bank-demo" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.status).toBe("active");
    expect(body.via).toBe("live_status");
    expect(body.claims.jti).toBe("jti_test_1");
  });

  it("rejects missing audience", async () => {
    const res = await POST(verifyRequest({ token: "eyJ.fake" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_fields");
  });
});

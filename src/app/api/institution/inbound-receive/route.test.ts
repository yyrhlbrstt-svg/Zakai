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
import { resetInboundIdempotencyForTests } from "@/lib/protocol/inboundReceiver";

function fakeJws(aud: string) {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ aud, jti: "jti-inb-1" })).toString("base64url");
  return `${header}.${payload}.sig`;
}

const bodyBase = {
  mandate_jti: "jti-inb-1",
  intent: "dispute" as const,
  vertical: "bank-fees",
};

describe("POST /api/institution/inbound-receive", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    findUniqueMock.mockReset();
    resetInboundIdempotencyForTests();
    verifyMock.mockResolvedValue({
      claims: {
        jti: "jti-inb-1",
        aud: "bank-demo",
        scopes: ["dispute:charge"],
      },
    });
  });

  it("returns 503 revocation_unknown when store is down (never accepted:true)", async () => {
    findUniqueMock.mockRejectedValue(new Error("db down"));
    const res = await POST(
      new Request("http://localhost/api/institution/inbound-receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bodyBase,
          mandate_jws: fakeJws("bank-demo"),
        }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.error).toBe("revocation_unknown");
    expect(body.accepted).toBeUndefined();
  });

  it("allows retry after store failure (idempotency only after accept)", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(null);
    const payload = {
      ...bodyBase,
      mandate_jws: fakeJws("bank-demo"),
    };
    const first = await POST(
      new Request("http://localhost/api/institution/inbound-receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(first.status).toBe(503);

    const second = await POST(
      new Request("http://localhost/api/institution/inbound-receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    const body = await second.json();
    expect(second.status).toBe(202);
    expect(body.accepted).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mandateRevocation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

const verifyMock = vi.fn();

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

describe("POST /api/mandate/verify", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    verifyMock.mockResolvedValue({
      claims: {
        jti: "jti-1",
        aud: "bank-demo",
        sub: "user-1",
        scopes: ["contract:cancel"],
        market: "IL",
        exp: Math.floor(Date.now() / 1000) + 3600,
        principal: { name: "Test" },
        statement: "Cancel",
      },
      issuer: { iss: "https://zakai.example", name: "Zakai", status: "active" },
    });
  });

  it("accepts mandate as an alias for token", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/mandate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate: "a.b.c", audience: "bank-demo" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith("a.b.c", { audience: "bank-demo" });
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("rejects missing audience with a clear hint", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/mandate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate: "a.b.c" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_fields");
    expect(body.hint).toMatch(/audience/);
  });
});

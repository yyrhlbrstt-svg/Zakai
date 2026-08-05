import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const resolveMock = vi.fn();

vi.mock("@/lib/mandate/verifyWithRegistry", () => ({
  verifyMandateWithTrustRegistry: (...args: unknown[]) => verifyMock(...args),
  RegistryVerifyError: class RegistryVerifyError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/mandate/revocationCheck", () => ({
  resolveRevocationState: (...args: unknown[]) => resolveMock(...args),
}));

vi.mock("@/lib/mandate/decision", () => ({
  decide: vi.fn().mockReturnValue({
    decision: "permit",
    reason: undefined,
    obligations: [],
    jti: "jti-1",
    action: "request:records",
    expiresInSeconds: 60,
  }),
  permittedActions: vi.fn().mockReturnValue(["request:records"]),
}));

vi.mock("@/lib/settlement/records", () => ({
  buildMandateRef: vi.fn().mockReturnValue({ jti: "jti-1", hash: "h" }),
  draftDecisionRecord: vi.fn().mockReturnValue({ kind: "decision" }),
}));

import { acceptMandateOnPipe } from "./acceptMandate";

function fakeJws(aud: string) {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ aud, jti: "jti-1", iss: "https://zakai.example" })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

describe("acceptMandateOnPipe", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    resolveMock.mockReset();
    verifyMock.mockResolvedValue({
      claims: {
        jti: "jti-1",
        aud: "bank-demo",
        sub: "u1",
        scopes: ["request:records"],
        market: "IL",
        exp: Math.floor(Date.now() / 1000) + 3600,
        principal: { name: "T" },
        statement: "s",
        status: { idx: 3, uri: "https://zakai.example/api/mandate/revocations" },
      },
      issuer: {
        iss: "https://zakai.example",
        jwksUri: "https://zakai.example/.well-known/zakai-jwks.json",
        name: "Zakai",
        status: "active",
      },
    });
    resolveMock.mockResolvedValue({ state: "active", via: "status_list" });
  });

  it("resolves revocation via status list when zkm.status is present", async () => {
    const live = vi.fn().mockResolvedValue("active");
    const result = await acceptMandateOnPipe({
      mandateJws: fakeJws("bank-demo"),
      action: "request:records",
      lookupRevocation: live,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accepted).toBe(true);
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: "jti-1",
        status: { idx: 3, uri: "https://zakai.example/api/mandate/revocations" },
        issuer: "https://zakai.example",
        liveLookup: live,
      }),
    );
  });

  it("denies when status list says revoked", async () => {
    resolveMock.mockResolvedValue({ state: "revoked", via: "status_list" });
    const { decide } = await import("@/lib/mandate/decision");
    vi.mocked(decide).mockReturnValueOnce({
      decision: "deny",
      reason: "revoked",
      obligations: [],
      jti: "jti-1",
      action: "request:records",
      expiresInSeconds: 60,
    });
    const result = await acceptMandateOnPipe({
      mandateJws: fakeJws("bank-demo"),
      action: "request:records",
      lookupRevocation: vi.fn().mockResolvedValue("active"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accepted).toBe(false);
      expect(result.decision).toBe("deny");
    }
  });
});

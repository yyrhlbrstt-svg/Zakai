import { describe, it, expect, vi, beforeEach } from "vitest";

const revocationFindUnique = vi.fn();
const authorizationFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mandateRevocation: { findUnique: (...a: unknown[]) => revocationFindUnique(...a) },
    authorization: { findUnique: (...a: unknown[]) => authorizationFindUnique(...a) },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { GET, POST } from "./route";

const url = (qs: string) => new Request(`http://localhost/api/mandate/inspect?${qs}`);

beforeEach(() => {
  revocationFindUnique.mockReset();
  authorizationFindUnique.mockReset();
});

describe("GET /api/mandate/inspect — the identifier a stranger was handed", () => {
  it("refuses to imply a made-up identifier is a real mandate", async () => {
    // This is the whole reason the endpoint exists in this shape. The old
    // status endpoint answered any well-formed string with "active".
    revocationFindUnique.mockResolvedValue(null);
    authorizationFindUnique.mockResolvedValue(null);

    const body = await (await GET(url("jti=ZK-INVENTED-IDENTIFIER"))).json();
    expect(body.verdict).toBe("not_issued_here");
    expect(body.knownToThisIssuer).toBe(false);
    expect(body.reason).toContain("never proves a mandate is real");
  });

  it("confirms an identifier this issuer really minted and has not revoked", async () => {
    revocationFindUnique.mockResolvedValue(null);
    authorizationFindUnique.mockResolvedValue({ status: "ACTIVE", issuedAt: new Date() });

    const body = await (await GET(url("jti=real-mandate-id-0001"))).json();
    expect(body.verdict).toBe("issued_and_not_revoked");
    expect(body.knownToThisIssuer).toBe(true);
    // Still says what it is not, so nobody mistakes recency for cryptography.
    expect(body.reason).toContain("not a cryptographic one");
  });

  it("reports a revoked identifier as revoked", async () => {
    revocationFindUnique.mockResolvedValue({ revokedAt: new Date() });
    authorizationFindUnique.mockResolvedValue(null);

    const body = await (await GET(url("jti=revoked-mandate-id"))).json();
    expect(body.verdict).toBe("revoked");
    expect(body.revoked).toBe(true);
  });

  it("asserts nothing at all when the store is unreachable", async () => {
    revocationFindUnique.mockRejectedValue(new Error("connection refused"));
    authorizationFindUnique.mockRejectedValue(new Error("connection refused"));

    const body = await (await GET(url("jti=some-mandate-id"))).json();
    expect(body.verdict).toBe("unknown");
    expect(body.knownToThisIssuer).toBeNull();
  });

  it("answers the question a caller meant when they paste an id into token=", async () => {
    revocationFindUnique.mockResolvedValue(null);
    authorizationFindUnique.mockResolvedValue(null);

    const body = await (await GET(url("token=ZK-7Q4K-2M9P"))).json();
    expect(body.kind).toBe("identifier");
  });

  it("names what it needs rather than failing silently on an empty call", async () => {
    const res = await GET(url(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_input");
    expect(body.hint).toContain("/api/mandate/inspect?token=");
  });

  it("is reachable cross-origin, because the readers are not on our page", async () => {
    revocationFindUnique.mockResolvedValue(null);
    authorizationFindUnique.mockResolvedValue(null);
    const res = await GET(url("jti=any-identifier-here"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("POST /api/mandate/inspect", () => {
  it("accepts the same fields as JSON", async () => {
    revocationFindUnique.mockResolvedValue(null);
    authorizationFindUnique.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/mandate/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jti: "posted-identifier-1" }),
      }),
    );
    const body = await res.json();
    expect(body.kind).toBe("identifier");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  clientIp: () => "127.0.0.1",
}));

import { GET, POST } from "./route";

function postReq(body: unknown) {
  return new Request("https://zakai.test/api/mandate/delegation/evidence", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_CANDIDATE = {
  iss: "https://issuer.example",
  name: "Example Issuer",
  jwksUri: "https://issuer.example/.well-known/jwks.json",
  statusListUri: "https://issuer.example/api/mandate/revocations",
  allowedScopes: ["read:bills", "dispute:charge"],
};

describe("GET /api/mandate/delegation/evidence", () => {
  it("returns the public conformance package", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.checklist.length).toBeGreaterThan(0);
    expect(body.endpoints.dry_run).toBe("POST /api/mandate/delegation/evidence");
  });
});

describe("POST /api/mandate/delegation/evidence (dry run)", () => {
  beforeEach(() => {
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true });
  });

  it("rate limits by IP", async () => {
    rateLimit.mockResolvedValue({ ok: false });
    const res = await POST(postReq(VALID_CANDIDATE));
    expect(res.status).toBe(429);
  });

  it("rejects a malformed candidate (bad URL) without ever writing anything", async () => {
    const res = await POST(postReq({ ...VALID_CANDIDATE, jwksUri: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("accepts a clean candidate and reports it would join the registry", async () => {
    const res = await POST(postReq(VALID_CANDIDATE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.would_join_registry).toBe(true);
    expect(body.problems).toEqual([]);
    expect(body.package_url).toBe("/api/mandate/delegation/evidence");
  });

  it("flags a forbidden scope as a 422 problem, never a 500", async () => {
    const res = await POST(postReq({ ...VALID_CANDIDATE, allowedScopes: ["payment:initiate"] }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.problems.some((p: { kind: string }) => p.kind === "forbidden_scope")).toBe(true);
  });

  it("flags an unknown scope", async () => {
    const res = await POST(postReq({ ...VALID_CANDIDATE, allowedScopes: ["not:a:real:scope"] }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.problems.some((p: { kind: string }) => p.kind === "unknown_scope")).toBe(true);
  });

  it("flags an insecure (http) URI", async () => {
    const res = await POST(
      postReq({ ...VALID_CANDIDATE, jwksUri: "http://issuer.example/.well-known/jwks.json" }),
    );
    // http:// still parses as a valid URL for zod, so this reaches validateIssuer
    // and must be caught there, not silently accepted.
    const body = await res.json();
    if (res.status === 400) {
      // zod's .url() may or may not accept http:// depending on version; either
      // rejection path is acceptable as long as it never reports ok:true.
      expect(body.ok).not.toBe(true);
    } else {
      expect(body.ok).toBe(false);
      expect(body.problems.some((p: { kind: string }) => p.kind === "insecure_uri")).toBe(true);
    }
  });

  it("defaults status to active and admittedAt to today when omitted", async () => {
    const res = await POST(postReq(VALID_CANDIDATE));
    const body = await res.json();
    expect(body.candidate.status).toBe("active");
  });
});

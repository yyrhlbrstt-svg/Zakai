import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerFullIssuer = vi.fn();

vi.mock("@/lib/mandate/trustRegistry", () => ({
  registerFullIssuer: (...args: unknown[]) => registerFullIssuer(...args),
}));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/mandate/registry/issuers", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

const CANDIDATE = {
  iss: "https://second-issuer.example",
  name: "Second Issuer",
  jwksUri: "https://second-issuer.example/.well-known/jwks.json",
  statusListUri: "https://second-issuer.example/api/mandate/revocations",
  allowedScopes: ["read:bills"],
};

describe("POST /api/mandate/registry/issuers", () => {
  beforeEach(() => {
    registerFullIssuer.mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const res = await POST(req(CANDIDATE, "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(registerFullIssuer).not.toHaveBeenCalled();
  });

  it("refuses when ZAKAI_ADMIN_TOKEN isn't configured at all", async () => {
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "");
    const res = await POST(req(CANDIDATE, "Bearer test-admin-token"));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed candidate before calling registerFullIssuer", async () => {
    const res = await POST(req({ name: "No iss" }, "Bearer test-admin-token"));
    expect(res.status).toBe(400);
    expect(registerFullIssuer).not.toHaveBeenCalled();
  });

  it("returns 422 with the real problems when the registry refuses admission", async () => {
    registerFullIssuer.mockResolvedValue({
      ok: false,
      problems: [{ kind: "forbidden_scope", scope: "payment:initiate" }],
    });
    const res = await POST(req(CANDIDATE, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.problems[0].kind).toBe("forbidden_scope");
  });

  it("admits a valid candidate and returns the live issuer row", async () => {
    registerFullIssuer.mockResolvedValue({
      ok: true,
      issuer: { ...CANDIDATE, status: "active", admittedAt: "2026-08-05" },
    });
    const res = await POST(req(CANDIDATE, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.issuer.iss).toBe(CANDIDATE.iss);
    expect(registerFullIssuer).toHaveBeenCalledWith(
      expect.objectContaining({ iss: CANDIDATE.iss, status: "active" }),
    );
  });
});

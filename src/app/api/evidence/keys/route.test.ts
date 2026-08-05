import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerEvidenceKey = vi.fn();

vi.mock("@/lib/evidence/keys", () => ({
  registerEvidenceKey: (...args: unknown[]) => registerEvidenceKey(...args),
}));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/evidence/keys", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/evidence/keys", () => {
  beforeEach(() => {
    registerEvidenceKey.mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const res = await POST(req({ label: "Firm" }, "Bearer wrong-token"));
    expect(res.status).toBe(401);
    expect(registerEvidenceKey).not.toHaveBeenCalled();
  });

  it("requires a label", async () => {
    const res = await POST(req({}, "Bearer test-admin-token"));
    expect(res.status).toBe(400);
  });

  it("mints and returns a key for a valid admin request", async () => {
    registerEvidenceKey.mockResolvedValue("ev_live_abc123");
    const res = await POST(req({ label: "Plaintiff Firm LLP" }, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.api_key).toBe("ev_live_abc123");
    expect(registerEvidenceKey).toHaveBeenCalledWith("Plaintiff Firm LLP");
  });
});

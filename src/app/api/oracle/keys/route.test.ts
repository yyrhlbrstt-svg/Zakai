import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerOracleKey = vi.fn();

vi.mock("@/lib/oracle/keys", () => ({
  registerOracleKey: (...args: unknown[]) => registerOracleKey(...args),
}));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/oracle/keys", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/oracle/keys", () => {
  beforeEach(() => {
    registerOracleKey.mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const res = await POST(req({ label: "Acme" }, "Bearer wrong-token"));
    expect(res.status).toBe(401);
    expect(registerOracleKey).not.toHaveBeenCalled();
  });

  it("requires a label", async () => {
    const res = await POST(req({}, "Bearer test-admin-token"));
    expect(res.status).toBe(400);
    expect(registerOracleKey).not.toHaveBeenCalled();
  });

  it("mints and returns a key for a valid admin request", async () => {
    registerOracleKey.mockResolvedValue("ok_live_abc123");
    const res = await POST(req({ label: "Acme Insurance" }, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.api_key).toBe("ok_live_abc123");
    expect(registerOracleKey).toHaveBeenCalledWith("Acme Insurance");
  });

  it("refuses when ZAKAI_ADMIN_TOKEN is not configured at all", async () => {
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "");
    const res = await POST(req({ label: "Acme" }, "Bearer test-admin-token"));
    expect(res.status).toBe(401);
  });
});

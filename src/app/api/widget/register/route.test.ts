import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerWidgetKey = vi.fn();

vi.mock("@/lib/widget/keys", () => ({
  registerWidgetKey: (...args: unknown[]) => registerWidgetKey(...args),
}));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/widget/register", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/widget/register", () => {
  beforeEach(() => {
    registerWidgetKey.mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const res = await POST(req({ domain: "example.com" }, "Bearer wrong-token"));
    expect(res.status).toBe(401);
    expect(registerWidgetKey).not.toHaveBeenCalled();
  });

  it("requires a domain", async () => {
    const res = await POST(req({}, "Bearer test-admin-token"));
    expect(res.status).toBe(400);
    expect(registerWidgetKey).not.toHaveBeenCalled();
  });

  it("mints and returns a key for a valid admin request", async () => {
    registerWidgetKey.mockResolvedValue("wk_live_abc123");
    const res = await POST(req({ domain: "partner.example" }, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.api_key).toBe("wk_live_abc123");
    expect(registerWidgetKey).toHaveBeenCalledWith("partner.example");
  });

  it("refuses when ZAKAI_ADMIN_TOKEN is not configured at all", async () => {
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "");
    const res = await POST(req({ domain: "partner.example" }, "Bearer test-admin-token"));
    expect(res.status).toBe(401);
  });
});

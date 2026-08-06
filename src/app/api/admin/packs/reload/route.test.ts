import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleReloadNotification = vi.fn();
const clearZmlCatalogCache = vi.fn();

vi.mock("@/lib/protocol/packs/loader", () => ({
  handleReloadNotification: (...args: unknown[]) => handleReloadNotification(...args),
}));
vi.mock("@/lib/protocol/zml/catalog", () => ({
  clearZmlCatalogCache: (...args: unknown[]) => clearZmlCatalogCache(...args),
}));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/admin/packs/reload", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/packs/reload", () => {
  beforeEach(() => {
    handleReloadNotification.mockReset();
    clearZmlCatalogCache.mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const res = await POST(req({ commit: "abc123" }, "Bearer wrong-token"));
    expect(res.status).toBe(401);
    expect(handleReloadNotification).not.toHaveBeenCalled();
    expect(clearZmlCatalogCache).not.toHaveBeenCalled();
  });

  it("refuses when ZAKAI_ADMIN_TOKEN is not configured at all", async () => {
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "");
    const res = await POST(req({ commit: "abc123" }, "Bearer test-admin-token"));
    expect(res.status).toBe(401);
  });

  it("reloads packs and clears the ZML cache for a valid admin request", async () => {
    const res = await POST(req({ commit: "abc123" }, "Bearer test-admin-token"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.commit).toBe("abc123");
    expect(handleReloadNotification).toHaveBeenCalledWith("abc123");
    expect(clearZmlCatalogCache).toHaveBeenCalledTimes(1);
  });

  it("tolerates a missing/empty body instead of erroring", async () => {
    const request = new Request("http://localhost/api/admin/packs/reload", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const res = await POST(request);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.commit).toBe("unknown");
    expect(handleReloadNotification).toHaveBeenCalledWith("unknown");
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { requireCronAuth } from "./cronAuth";

function requestWithAuth(authorization?: string): Request {
  return new Request("http://localhost/api/cron/vigil", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireCronAuth", () => {
  it("admits the exact Bearer token when CRON_SECRET is set", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-cron-token");
    expect(requireCronAuth(requestWithAuth("Bearer s3cret-cron-token"))).toBeNull();
  });

  it("rejects a wrong token with 401", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-cron-token");
    const res = requireCronAuth(requestWithAuth("Bearer wrong"));
    expect(res?.status).toBe(401);
  });

  it("rejects a missing Authorization header with 401", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-cron-token");
    const res = requireCronAuth(requestWithAuth());
    expect(res?.status).toBe(401);
  });

  it("fails closed in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = requireCronAuth(requestWithAuth());
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "cron_secret_not_configured" });
  });

  it("stays open outside production when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(requireCronAuth(requestWithAuth())).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const predict = vi.fn();
const assessOracleCalibration = vi.fn();
const resolveOracleKey = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/oracle/store", () => ({
  predict: (...args: unknown[]) => predict(...args),
  assessOracleCalibration: (...args: unknown[]) => assessOracleCalibration(...args),
}));

vi.mock("@/lib/oracle/keys", () => ({
  resolveOracleKey: (...args: unknown[]) => resolveOracleKey(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/oracle/predict", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

const QUERY = { market: "IL", vertical: "telecom", counterparty: "cellcom" };

describe("POST /api/oracle/predict", () => {
  beforeEach(() => {
    predict.mockReset();
    assessOracleCalibration.mockReset();
    resolveOracleKey.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, remaining: 599 });
    predict.mockResolvedValue({
      paidProbability: 0.7,
      interval: [0.5, 0.9],
      expectedAmountMinor: 1000,
      expectedDays: 14,
      expectedValueMinor: 700,
      evidence: 42,
      confident: true,
    });
    assessOracleCalibration.mockResolvedValue({ verdict: "ok", samples: 100, ece: 0.02, skill: 0.3 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("closes the endpoint when no key is presented and no master key is configured", async () => {
    vi.stubEnv("ORACLE_API_KEY", "");
    resolveOracleKey.mockResolvedValue(null);
    const res = await POST(req(QUERY));
    expect(res.status).toBe(503);
    expect(predict).not.toHaveBeenCalled();
  });

  it("accepts the legacy master key and rate-limits by 'master'", async () => {
    vi.stubEnv("ORACLE_API_KEY", "the-master-key");
    const res = await POST(req(QUERY, "Bearer the-master-key"));
    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith("oracle_predict", "master", 600, 60);
    expect(resolveOracleKey).not.toHaveBeenCalled();
  });

  it("accepts a valid per-customer key and rate-limits by that customer's identity", async () => {
    vi.stubEnv("ORACLE_API_KEY", "");
    resolveOracleKey.mockResolvedValue({ label: "Acme Insurance" });
    const res = await POST(req(QUERY, "Bearer ok_live_acme"));
    expect(res.status).toBe(200);
    expect(resolveOracleKey).toHaveBeenCalledWith("ok_live_acme");
    expect(rateLimit).toHaveBeenCalledWith("oracle_predict", "key:Acme Insurance", 600, 60);
  });

  it(
    "falls through to per-customer lookup when a master key IS configured but the " +
      "presented key doesn't match it — a customer key must still work",
    async () => {
      vi.stubEnv("ORACLE_API_KEY", "the-master-key");
      resolveOracleKey.mockResolvedValue({ label: "Acme Insurance" });
      const res = await POST(req(QUERY, "Bearer ok_live_acme"));
      expect(res.status).toBe(200);
      expect(rateLimit).toHaveBeenCalledWith("oracle_predict", "key:Acme Insurance", 600, 60);
    },
  );

  it("rejects a key that matches neither the master key nor any customer key", async () => {
    vi.stubEnv("ORACLE_API_KEY", "the-master-key");
    resolveOracleKey.mockResolvedValue(null);
    const res = await POST(req(QUERY, "Bearer garbage"));
    expect(res.status).toBe(401);
    expect(predict).not.toHaveBeenCalled();
  });

  it("enforces the rate limit even for a valid key", async () => {
    vi.stubEnv("ORACLE_API_KEY", "the-master-key");
    rateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await POST(req(QUERY, "Bearer the-master-key"));
    expect(res.status).toBe(429);
    expect(predict).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadInstitutionRiskTrend = vi.fn();
const resolveEvidenceKey = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/services/institutionRiskTrend", () => ({
  loadInstitutionRiskTrend: (...args: unknown[]) => loadInstitutionRiskTrend(...args),
}));

vi.mock("@/lib/evidence/keys", () => ({
  resolveEvidenceKey: (...args: unknown[]) => resolveEvidenceKey(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { POST } from "./route";

function req(authHeader?: string) {
  return new Request("http://localhost/api/evidence/institution-risk-trend", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe("POST /api/evidence/institution-risk-trend", () => {
  beforeEach(() => {
    loadInstitutionRiskTrend.mockReset();
    resolveEvidenceKey.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, remaining: 119 });
    loadInstitutionRiskTrend.mockResolvedValue([
      { institutionId: "bank-leumi", recentWindowCases: 30, priorWindowCases: 20, changePct: 50 },
    ]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("closes the endpoint when no key is presented and no master key is configured", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "");
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(loadInstitutionRiskTrend).not.toHaveBeenCalled();
  });

  it("accepts the legacy master key", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    const res = await POST(req("Bearer the-master-key"));
    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith("evidence_institution_risk_trend", "master", 120, 60);
  });

  it("accepts a valid per-customer key and rate-limits by that customer's identity", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "");
    resolveEvidenceKey.mockResolvedValue({ label: "Regulator X" });
    const res = await POST(req("Bearer ev_live_reg"));
    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith(
      "evidence_institution_risk_trend",
      "key:Regulator X",
      120,
      60,
    );
  });

  it("rejects a key that matches neither the master key nor any customer key", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    resolveEvidenceKey.mockResolvedValue(null);
    const res = await POST(req("Bearer garbage"));
    expect(res.status).toBe(401);
    expect(loadInstitutionRiskTrend).not.toHaveBeenCalled();
  });

  it("enforces the rate limit", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    rateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await POST(req("Bearer the-master-key"));
    expect(res.status).toBe(429);
    expect(loadInstitutionRiskTrend).not.toHaveBeenCalled();
  });

  it("returns the real trend data with snake_case fields and the honesty note", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    const res = await POST(req("Bearer the-master-key"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.institutions[0]).toEqual({
      institution_id: "bank-leumi",
      recent_window_cases: 30,
      prior_window_cases: 20,
      change_pct: 50,
    });
    expect(body.note).toContain("not a fitted forecast");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadSystemicPatternReport = vi.fn();
const resolveEvidenceKey = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/services/systemicPatternEvidence", () => ({
  loadSystemicPatternReport: (...args: unknown[]) => loadSystemicPatternReport(...args),
}));

vi.mock("@/lib/evidence/keys", () => ({
  resolveEvidenceKey: (...args: unknown[]) => resolveEvidenceKey(...args),
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { POST } from "./route";

function req(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/evidence/systemic-pattern", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

const QUERY = { market: "IL", provider: "cellcom" };

describe("POST /api/evidence/systemic-pattern", () => {
  beforeEach(() => {
    loadSystemicPatternReport.mockReset();
    resolveEvidenceKey.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, remaining: 119 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("closes the endpoint when no key is presented and no master key is configured", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "");
    const res = await POST(req(QUERY));
    expect(res.status).toBe(503);
    expect(loadSystemicPatternReport).not.toHaveBeenCalled();
  });

  it("accepts the legacy master key and rate-limits by 'master'", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    loadSystemicPatternReport.mockResolvedValue(null);
    const res = await POST(req(QUERY, "Bearer the-master-key"));
    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith("evidence_systemic_pattern", "master", 120, 60);
  });

  it("accepts a valid per-customer key and rate-limits by that customer's identity", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "");
    resolveEvidenceKey.mockResolvedValue({ label: "Plaintiff Firm LLP" });
    loadSystemicPatternReport.mockResolvedValue(null);
    const res = await POST(req(QUERY, "Bearer ev_live_firm"));
    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith(
      "evidence_systemic_pattern",
      "key:Plaintiff Firm LLP",
      120,
      60,
    );
  });

  it("rejects a key that matches neither the master key nor any customer key", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    resolveEvidenceKey.mockResolvedValue(null);
    const res = await POST(req(QUERY, "Bearer garbage"));
    expect(res.status).toBe(401);
    expect(loadSystemicPatternReport).not.toHaveBeenCalled();
  });

  it("enforces the rate limit even for a valid key", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    rateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await POST(req(QUERY, "Bearer the-master-key"));
    expect(res.status).toBe(429);
    expect(loadSystemicPatternReport).not.toHaveBeenCalled();
  });

  it(
    "reports insufficient_sample honestly (never a fabricated report) when below MIN_SAMPLE",
    async () => {
      vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
      loadSystemicPatternReport.mockResolvedValue(null);
      const res = await POST(req(QUERY, "Bearer the-master-key"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.available).toBe(false);
      expect(body.reason).toBe("insufficient_sample");
    },
  );

  it("returns the real report with the legal-neutrality note attached", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    loadSystemicPatternReport.mockResolvedValue({
      documentedCases: 12,
      paidCases: 9,
      paidRatePct: 75,
      totalRecoveredMinor: 90000,
      avgRecoveredMinor: 10000,
      medianDays: 14,
      firstDocumentedAt: "2026-01-01",
      lastDocumentedAt: "2026-06-01",
    });
    const res = await POST(req(QUERY, "Bearer the-master-key"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.documented_cases).toBe(12);
    expect(body.legal_note).toContain("no legal conclusion");
  });

  it("rejects an invalid query before touching the data layer", async () => {
    vi.stubEnv("EVIDENCE_API_KEY", "the-master-key");
    const res = await POST(req({ market: "ISR", provider: "" }, "Bearer the-master-key"));
    expect(res.status).toBe(400);
    expect(loadSystemicPatternReport).not.toHaveBeenCalled();
  });
});

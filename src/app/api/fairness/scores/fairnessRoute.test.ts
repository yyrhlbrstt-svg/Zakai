import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/fairness/scores/route";

vi.mock("@/lib/services/fairnessScores", () => ({
  loadFairnessScores: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: async () => ({ ok: true }),
}));

describe("GET /api/fairness/scores", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 503 with empty providers when loader throws", async () => {
    const { loadFairnessScores } = await import("@/lib/services/fairnessScores");
    vi.mocked(loadFairnessScores).mockRejectedValueOnce(new Error("db down"));

    const res = await GET(new Request("https://zakai.test/api/fairness/scores?market=IL"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.providers).toEqual([]);
    expect(body.unavailable).toBe(true);
  });

  it("returns scores when loader succeeds", async () => {
    const { loadFairnessScores } = await import("@/lib/services/fairnessScores");
    vi.mocked(loadFairnessScores).mockResolvedValueOnce([
      {
        provider: "cellcom",
        fairnessScore: 72,
        observations: 10,
        wins: 7,
        methodology: "strategy_outcome_win_rate",
      },
    ]);

    const res = await GET(new Request("https://zakai.test/api/fairness/scores?market=IL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toHaveLength(1);
  });
});

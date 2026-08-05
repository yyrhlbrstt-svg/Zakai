import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const loadTrackRecordStats = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/mandate/trackRecordCredential", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mandate/trackRecordCredential")>(
    "@/lib/mandate/trackRecordCredential",
  );
  return {
    ...actual,
    loadTrackRecordStats: (...args: unknown[]) => loadTrackRecordStats(...args),
  };
});

vi.mock("@/lib/report-error", () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

import { GET } from "./route";
import { TrackRecordUnavailableError } from "@/lib/mandate/trackRecordCredential";

describe("GET /api/authority/recap", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    loadTrackRecordStats.mockReset();
    reportError.mockReset();
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "mustLogin" }), { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the caller's real stats without signing anything", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    loadTrackRecordStats.mockResolvedValue({
      resolvedCases: 2,
      documentedMonthlySavingAgorot: 4_500,
      activeSince: "2025-03-01T00:00:00.000Z",
    });
    const res = await GET();
    const body = await res.json();
    expect(loadTrackRecordStats).toHaveBeenCalledWith("user_1");
    expect(body.ok).toBe(true);
    expect(body.stats.resolvedCases).toBe(2);
  });

  it("returns real zero stats (not an error) for a user with no resolved cases yet — the UI decides how to show that, the API doesn't fabricate or refuse", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    loadTrackRecordStats.mockResolvedValue({
      resolvedCases: 0,
      documentedMonthlySavingAgorot: 0,
      activeSince: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats.resolvedCases).toBe(0);
  });

  it("returns 503 (not a fabricated response) when the DB is unreachable", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    loadTrackRecordStats.mockRejectedValue(new TrackRecordUnavailableError("stats_unavailable"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.error).toBe("stats_unavailable");
  });
});

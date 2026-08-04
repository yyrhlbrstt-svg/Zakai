import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const issueTrackRecordCredential = vi.fn();
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
    issueTrackRecordCredential: (...args: unknown[]) => issueTrackRecordCredential(...args),
  };
});

vi.mock("@/lib/report-error", () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

import { GET } from "./route";
import { TrackRecordUnavailableError } from "@/lib/mandate/trackRecordCredential";
import { MandateKeyUnavailableError } from "@/lib/mandate/mandate";

describe("GET /api/authority/track-record", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    issueTrackRecordCredential.mockReset();
    reportError.mockReset();
  });

  it("requires login", async () => {
    requireUserId.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "mustLogin" }), { status: 401 }),
    });
    const res = await GET(new Request("https://zakai.test/api/authority/track-record"));
    expect(res.status).toBe(401);
    expect(issueTrackRecordCredential).not.toHaveBeenCalled();
  });

  it("issues the caller's own credential, never anyone else's by id", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    issueTrackRecordCredential.mockResolvedValue({
      token: "signed.jwt.here",
      stats: { resolvedCases: 3, documentedMonthlySavingAgorot: 9_000, activeSince: "2025-01-01T00:00:00.000Z" },
    });

    const res = await GET(new Request("https://zakai.test/api/authority/track-record"));
    const body = await res.json();

    expect(issueTrackRecordCredential.mock.calls[0]?.[0]).toBe("user_1");
    expect(body.ok).toBe(true);
    expect(body.credential).toBe("signed.jwt.here");
    expect(body.stats.resolvedCases).toBe(3);
    expect(body.verify.jwks).toContain("/.well-known/zakai-jwks.json");
  });

  it("returns 404 (not 500) for a user with no resolved cases yet", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    issueTrackRecordCredential.mockRejectedValue(new TrackRecordUnavailableError("no_history"));
    const res = await GET(new Request("https://zakai.test/api/authority/track-record"));
    expect(res.status).toBe(404);
  });

  it("returns 503 when the DB is unreachable, not a fabricated credential", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    issueTrackRecordCredential.mockRejectedValue(new TrackRecordUnavailableError("stats_unavailable"));
    const res = await GET(new Request("https://zakai.test/api/authority/track-record"));
    expect(res.status).toBe(503);
  });

  it("returns 503 when the signing key isn't configured", async () => {
    requireUserId.mockResolvedValue({ userId: "user_1" });
    issueTrackRecordCredential.mockRejectedValue(new MandateKeyUnavailableError("missing"));
    const res = await GET(new Request("https://zakai.test/api/authority/track-record"));
    expect(res.status).toBe(503);
  });
});

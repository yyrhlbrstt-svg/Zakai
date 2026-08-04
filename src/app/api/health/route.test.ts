import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/ops/internalAdminGate", () => ({
  isInternalOpsRequest: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
    vi.mocked(isInternalOpsRequest).mockReset();
    vi.mocked(isInternalOpsRequest).mockReturnValue(false);
  });

  it("public response omits ai provider and endpoints map", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x.test/api/health"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).not.toHaveProperty("aiProvider");
    expect(body).not.toHaveProperty("mandateKeys");
    expect(body).not.toHaveProperty("endpoints");
    expect(body).toHaveProperty("time");
  });

  it("returns 503 when database unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("db down"));
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x.test/api/health"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

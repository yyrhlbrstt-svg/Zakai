import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    delegatedIssuer: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

describe("GET /api/mandate/delegation/issuers", () => {
  beforeEach(() => {
    vi.mocked(prisma.delegatedIssuer.findMany).mockReset();
  });

  it("returns slugs without key material", async () => {
    vi.mocked(prisma.delegatedIssuer.findMany).mockResolvedValue([
      {
        id: "c1",
        slug: "pilot-agent",
        name: "Pilot Agent",
        keyHash: "hash",
        status: "active",
        allowedScopes: ["read:bills"],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        lastUsedAt: null,
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.issuers[0].slug).toBe("pilot-agent");
    expect(JSON.stringify(body)).not.toContain("keyHash");
  });
});

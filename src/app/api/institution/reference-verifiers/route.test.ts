import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    referenceVerifier: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/referenceVerifier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/referenceVerifier")>();
  return {
    ...actual,
    serverSideReadinessOk: vi.fn().mockResolvedValue(true),
  };
});

import { prisma } from "@/lib/prisma";

describe("/api/institution/reference-verifiers", () => {
  beforeEach(() => {
    vi.mocked(prisma.referenceVerifier.findMany).mockReset();
    vi.mocked(prisma.referenceVerifier.count).mockReset();
    vi.mocked(prisma.referenceVerifier.create).mockReset();
  });

  it("GET lists leaders without contact email", async () => {
    vi.mocked(prisma.referenceVerifier.findMany).mockResolvedValue([
      {
        institutionId: "bank-demo",
        displayNameHe: "בנק דמו",
        displayNameEn: "Demo Bank",
        contactEmail: "secret@example.com",
        tier: "pioneer",
        listedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.leaders).toHaveLength(1);
    expect(body.leaders[0]).not.toHaveProperty("contactEmail");
    expect(body.leaders[0].institutionId).toBe("bank-demo");
  });

  it("POST rejects invalid institution id", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/institution/reference-verifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: "x",
          displayNameHe: "שם",
          displayNameEn: "Name",
          contactEmail: "a@b.co",
          clientCompletedChecks: true,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

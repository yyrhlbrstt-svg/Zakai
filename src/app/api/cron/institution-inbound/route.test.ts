import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    referenceVerifier: { findMany: vi.fn() },
    case: { findMany: vi.fn() },
    outbox: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/security/cronAuth", () => ({
  requireCronAuth: vi.fn().mockReturnValue(null),
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { requireCronAuth } from "@/lib/security/cronAuth";

describe("/api/cron/institution-inbound", () => {
  beforeEach(() => {
    vi.mocked(requireCronAuth).mockReturnValue(null);
    vi.mocked(prisma.referenceVerifier.findMany).mockReset();
    vi.mocked(prisma.case.findMany).mockReset();
    vi.mocked(prisma.outbox.findFirst).mockReset();
    vi.mocked(sendEmail).mockClear();
  });

  it("requires cron auth", async () => {
    vi.mocked(requireCronAuth).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/institution-inbound"));
    expect(res.status).toBe(401);
  });

  it("sends digest when verifiers exist", async () => {
    vi.mocked(requireCronAuth).mockReturnValue(null);
    vi.mocked(prisma.referenceVerifier.findMany).mockResolvedValue([
      {
        institutionId: "bank-leumi",
        displayNameEn: "Bank Leumi",
        contactEmail: "risk@example.com",
      },
    ]);
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        provider: "leumi",
        status: "SENT",
        updatedAt: new Date(),
        authorization: { mandateAudience: "bank-leumi" },
      },
    ]);
    vi.mocked(prisma.outbox.findFirst).mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/institution-inbound", {
      headers: { authorization: "Bearer test" },
    }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});

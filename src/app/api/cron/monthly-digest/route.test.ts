import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    outbox: { findFirst: vi.fn() },
    receipt: { findMany: vi.fn() },
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

const USER = {
  id: "user_1",
  email: "ada@zakai.test",
  name: "Ada",
  cases: [],
};

describe("/api/cron/monthly-digest", () => {
  beforeEach(() => {
    vi.mocked(requireCronAuth).mockReturnValue(null);
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.outbox.findFirst).mockReset();
    vi.mocked(prisma.receipt.findMany).mockReset();
    vi.mocked(sendEmail).mockClear();

    vi.mocked(prisma.user.findMany).mockResolvedValue([USER] as never);
    vi.mocked(prisma.outbox.findFirst).mockResolvedValue(null as never);
  });

  it("requires cron auth", async () => {
    vi.mocked(requireCronAuth).mockReturnValueOnce(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/monthly-digest"));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the base digest with no attachment when there are no deductible receipts", async () => {
    vi.mocked(prisma.receipt.findMany).mockResolvedValue([] as never);
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/cron/monthly-digest"));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.attachments).toBeUndefined();
    expect(call.body).not.toContain("הוצאות מוכרות");
  });

  it("attaches a CSV and mentions the count/total when deductible receipts exist in the window", async () => {
    vi.mocked(prisma.receipt.findMany).mockResolvedValue([
      {
        vendor: "Office Depot",
        amountAgorot: 45000,
        currency: "ILS",
        occurredAt: new Date("2026-08-01"),
        category: "business_deductible",
        hasVat: true,
        flaggedAt: null,
      },
    ] as never);

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/cron/monthly-digest"));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments![0].filename).toBe("zakai-deductible-expenses.csv");
    expect(call.attachments![0].content).toContain("Office Depot");
    expect(call.body).toContain("הוצאות מוכרות");
  });

  it("scopes the receipts query to business_deductible only, per user", async () => {
    vi.mocked(prisma.receipt.findMany).mockResolvedValue([] as never);
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/cron/monthly-digest"));

    expect(prisma.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1", category: "business_deductible" }),
      }),
    );
  });
});

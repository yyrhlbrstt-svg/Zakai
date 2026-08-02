import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fee: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { dashboardFeeRedirectPath } from "./paymentRedirect";

describe("dashboardFeeRedirectPath", () => {
  beforeEach(() => {
    vi.mocked(prisma.fee.findUnique).mockReset();
  });

  it("uses locale hint when fee is unknown", async () => {
    const path = await dashboardFeeRedirectPath("paid", null, "en");
    expect(path).toBe("/en/dashboard?fee=paid");
  });

  it("uses user country when fee resolves", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      case: { id: "case_1", user: { country: "GB" } },
    } as never);
    const path = await dashboardFeeRedirectPath("paid", "fee_1", "he");
    expect(path).toBe("/en/dashboard?fee=paid&case=case_1");
  });
});

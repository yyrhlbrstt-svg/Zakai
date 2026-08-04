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

  it("lands paid fees on /money finish surface", async () => {
    const path = await dashboardFeeRedirectPath("paid", null, "en");
    expect(path).toBe("/en/money?fee=paid");
  });

  it("deep-links paid fee to /money?case=", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      case: { id: "case_1", user: { country: "GB" } },
    } as never);
    const path = await dashboardFeeRedirectPath("paid", "fee_1", "he");
    expect(path).toBe("/en/money?case=case_1&fee=paid");
  });

  it("sends fee errors back to /money without inventing payFee under mock", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      case: { id: "case_1", user: { country: "IL" } },
    } as never);
    const path = await dashboardFeeRedirectPath("error", "fee_1", "he");
    expect(path).toBe("/he/money?case=case_1&fee=error");
  });

  it("lands confirming (webhook in flight) on /money with case deep-link", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      case: { id: "case_1", user: { country: "IL" } },
    } as never);
    const path = await dashboardFeeRedirectPath("confirming", "fee_1", "he");
    expect(path).toBe("/he/money?case=case_1&fee=confirming");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    referenceVerifier: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { notifyInstitutionOnOutboundSend } from "./institutionOutboundNotify";

describe("notifyInstitutionOnOutboundSend", () => {
  beforeEach(() => {
    vi.mocked(prisma.referenceVerifier.findUnique).mockReset();
    vi.mocked(sendEmail).mockClear();
  });

  it("skips non-institution audience", async () => {
    await notifyInstitutionOnOutboundSend("cellcom");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails registered verifier", async () => {
    vi.mocked(prisma.referenceVerifier.findUnique).mockResolvedValue({
      institutionId: "bank-leumi",
      displayNameHe: "בנק",
      contactEmail: "risk@bank.example",
      displayNameEn: "Bank",
      tier: "reference",
      listedAt: new Date(),
    });
    await notifyInstitutionOnOutboundSend("bank-leumi");
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});

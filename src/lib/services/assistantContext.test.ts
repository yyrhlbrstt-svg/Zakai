import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/proposedSaving", () => ({
  getProposedSavingsMap: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/services/agentFollowUp", () => ({
  getAgentRoundMap: vi.fn(async () => new Map()),
  MAX_AGENT_ROUNDS: 4,
}));

import { prisma } from "@/lib/prisma";
import { buildAssistantCasesSnapshot } from "./assistantContext";

describe("buildAssistantCasesSnapshot", () => {
  beforeEach(() => {
    vi.mocked(prisma.case.findMany).mockReset();
  });

  it("mentions proposed saving when inbound mapped", async () => {
    const { getProposedSavingsMap } = await import("@/lib/services/proposedSaving");
    vi.mocked(getProposedSavingsMap).mockResolvedValue(
      new Map([
        [
          "case_1",
          {
            newAmountShekels: 120,
            confidence: 0.9,
            authorizationCode: "ZK-ABCD",
            from: "a@b.com",
            subject: "ok",
            receivedAt: new Date(),
          },
        ],
      ]),
    );
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        id: "case_1",
        provider: "cellcom",
        status: "SENT",
        vertical: "telecom",
        amountOriginal: 20_000,
        targetAmount: 15_000,
        savingsProof: null,
        fee: null,
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("PROPOSED_SAVING");
    expect(snap).toContain("case_1");
    expect(snap).toContain("120");
    expect(snap).toContain("NEXT_ACTION: One-tap record SavingsProof");
  });

  it("points empty users at /money", async () => {
    vi.mocked(prisma.case.findMany).mockResolvedValue([] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("/money");
    expect(snap).toContain("NEXT_ACTION: Start in /money");
  });

  it("prioritizes Mandate send over new doors", async () => {
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        id: "case_pre",
        provider: "partner",
        status: "VERIFIED",
        vertical: "telecom",
        amountOriginal: 10_000,
        targetAmount: 8_000,
        savingsProof: null,
        fee: null,
        authorization: { status: "ACTIVE" },
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("NEXT_ACTION: Finish Mandate send");
    expect(snap).toContain("case_pre");
  });

  it("surfaces inactive Mandate on SENT above wait", async () => {
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        id: "case_dead",
        provider: "cellcom",
        status: "SENT",
        vertical: "telecom",
        amountOriginal: 20_000,
        targetAmount: 15_000,
        savingsProof: null,
        fee: null,
        authorization: { status: "REVOKED" },
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("NEXT_ACTION: Re-issue ACTIVE Mandate");
    expect(snap).toContain("case_dead");
  });
});

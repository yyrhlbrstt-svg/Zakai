import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findMany: vi.fn() },
    strategyOutcome: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/services/proposedSaving", () => ({
  getProposedSavingsMap: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/services/agentFollowUp", () => ({
  getAgentRoundMap: vi.fn(async () => new Map()),
  MAX_AGENT_ROUNDS: 4,
}));

vi.mock("@/lib/services/priorityBoosts", () => ({
  getPriorityCatalogBoosts: vi.fn(async () => ({})),
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
        counterpartyEmail: "billing@cellcom.co.il",
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("NEXT_ACTION: Re-issue ACTIVE Mandate");
    expect(snap).toContain("case_dead");
  });

  it("surfaces missing outreach email on SENT when catalog has none", async () => {
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        id: "case_mail",
        provider: "unknown-landlord",
        status: "SENT",
        vertical: "deposit",
        amountOriginal: 5_000,
        targetAmount: 0,
        savingsProof: null,
        fee: null,
        authorization: { status: "ACTIVE" },
        counterpartyEmail: null,
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("NEXT_ACTION: Enter provider outreach email");
    expect(snap).toContain("case_mail");
  });

  it("ranks multi-case by expected recovery and emits NEXT_ACTION_HREF", async () => {
    vi.mocked(prisma.case.findMany).mockResolvedValue([
      {
        id: "small",
        provider: "cellcom",
        status: "SENT",
        vertical: "telecom",
        amountOriginal: 10_000,
        targetAmount: 9_000,
        savingsProof: null,
        fee: null,
        authorization: { status: "ACTIVE" },
        counterpartyEmail: "service@cellcom.co.il",
      },
      {
        id: "big",
        provider: "partner",
        status: "SENT",
        vertical: "telecom",
        amountOriginal: 30_000,
        targetAmount: 15_000,
        savingsProof: null,
        fee: null,
        authorization: { status: "ACTIVE" },
        counterpartyEmail: "service@partner.co.il",
      },
    ] as never);
    const snap = await buildAssistantCasesSnapshot("user_1");
    expect(snap).toContain("MULTI_CASE_RANK");
    expect(snap).toContain("NEXT_ACTION_HREF: /money?case=big");
    expect(snap).toContain("OPEN_LOOP_RULE");
    expect(snap).toContain("NEGOTIATION_BRIEF");
  });
});

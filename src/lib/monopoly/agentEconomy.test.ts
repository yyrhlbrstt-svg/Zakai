import { describe, expect, it } from "vitest";
import { buildAgentEconomyDocument } from "./agentEconomy";

describe("buildAgentEconomyDocument", () => {
  it("publishes handoff + protocol URLs without claiming filings", () => {
    const doc = buildAgentEconomyDocument("https://zakai-3uxj.vercel.app/");
    expect(doc.spec).toBe("zakai-agent-economy");
    expect(doc.handoff.consumer_must_have).toContain("/he/must-have");
    expect(doc.handoff.attribution_query).toContain("utm_source=agent");
    expect(doc.protocol.trillion_gates).toContain("/api/network/trillion-gates");
    expect(doc.join_kit).toContain("/api/network/join-kit");
    expect(doc.delegation.evidence).toContain("/evidence");
    expect(doc.laws.some((l) => /proposes/i.test(l))).toBe(true);
    expect(doc.win_condition).toMatch(/Mandate/i);
  });
});

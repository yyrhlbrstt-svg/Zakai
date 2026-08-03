import { describe, expect, it } from "vitest";
import {
  buildHandoffUrl,
  buildZakaiPipeDocument,
  isPipeDoor,
  PIPE_SPEC,
} from "./zakaiPipe";

describe("zakaiPipe", () => {
  it("publishes four rails with accept + handoff + ledger", () => {
    const doc = buildZakaiPipeDocument("https://zakai.example/");
    expect(doc.spec).toBe(PIPE_SPEC);
    expect(doc.rails.authority.accept).toContain("/api/pipe/accept");
    expect(doc.rails.authority.acceptor_mark).toContain("/api/pipe/mark");
    expect(doc.rails.intake.reference_post).toContain("/inbound-receive");
    expect(doc.rails.outcomes.savings_ledger).toContain("/savings-ledger");
    expect(doc.rails.agents.handoff).toContain("/api/pipe/handoff");
    expect(doc.related.this_manifest).toContain("zakai-pipe.json");
    expect(doc.laws.some((l) => l.id === "no_outbound_money_scopes")).toBe(true);
  });

  it("builds attributed handoff URLs across expanded doors", () => {
    const doc = buildZakaiPipeDocument("https://zakai.example");
    expect(isPipeDoor("cancel/universal")).toBe(true);
    expect(isPipeDoor("flights")).toBe(true);
    expect(isPipeDoor("must-have")).toBe(true);
    expect(isPipeDoor("not-a-door")).toBe(false);
    expect(doc.rails.agents.agents_index).toContain("zakai-agents.json");
    const url = buildHandoffUrl({
      origin: "https://zakai.example",
      locale: "he",
      door: "cancel",
      agent: "Claude Code",
    });
    expect(url).toContain("/he/cancel?");
    expect(url).toContain("utm_source=agent");
    expect(url).toContain("ref_agent=claude-code");
  });
});

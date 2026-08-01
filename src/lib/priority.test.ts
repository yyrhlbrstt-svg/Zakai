import { describe, expect, it } from "vitest";
import { rankPriorityActions, formatPotentialHe, formatPotentialEn, priorityDigestHe } from "./priority";
import { RULE_PACKS } from "./verticals";

describe("priority cadence", () => {
  it("never renders a monthly suffix for a one-time or hidden entry", () => {
    // The bug this guards: every catalog entry used to render as "/mo" on the
    // dashboard and inside the assistant's own system prompt regardless of
    // whether the underlying event was actually recurring — a one-time
    // incident payout and a dormant-account count both claimed to repeat
    // every month. That claim could reach a real conversation via
    // priorityDigestHe(), not only a UI label.
    for (const a of rankPriorityActions(20)) {
      if (a.cadence === "monthly") continue;
      expect(formatPotentialHe(a)).not.toMatch(/\/ח׳/);
      expect(formatPotentialEn(a)).not.toMatch(/\/mo\b/);
    }
  });

  it("renders nothing at all for a hidden-cadence entry", () => {
    const dormant = rankPriorityActions(20).find((a) => a.id === "dormant");
    expect(dormant).toBeDefined();
    expect(dormant!.cadence).toBe("hidden");
    expect(formatPotentialHe(dormant!)).toBe("");
    expect(formatPotentialEn(dormant!)).toBe("");
  });

  it("marks a one-time entry as one-time in both languages", () => {
    const incident = rankPriorityActions(20).find((a) => a.id === "incident");
    expect(incident!.cadence).toBe("oneTime");
    expect(formatPotentialHe(incident!)).toContain("חד-פעמי");
    expect(formatPotentialEn(incident!)).toContain("one-time");
  });

  it("still renders a genuine monthly entry with a monthly suffix", () => {
    const cancel = rankPriorityActions(20).find((a) => a.id === "cancel");
    expect(cancel!.cadence).toBe("monthly");
    expect(formatPotentialHe(cancel!)).toContain("/ח׳");
    expect(formatPotentialEn(cancel!)).toContain("/mo");
  });

  it("the assistant's own digest never claims a hidden or one-time figure repeats monthly", () => {
    const digest = priorityDigestHe();
    expect(digest).not.toMatch(/₪\d+\/ח׳.*(דחוי|נפצעת|שכחת)/);
  });

  it("includes the vehicle-check door, previously missing from this ranking entirely", () => {
    expect(rankPriorityActions(20).some((a) => a.id === "vehicleCheck")).toBe(true);
  });

  it("includes every calculator named in the assistant's own KNOWLEDGE ANCHORS, not just pension-fees", () => {
    // pension-fees, payslip, severance, maternity, unemployment and miluim
    // were all built, tested, and already named in assistantSystem.ts's own
    // KNOWLEDGE ANCHORS — but absent from this catalog, so priorityDigestHe()
    // (the ranked list actually injected into the agent's prompt) could never
    // mention them. Same class of bug as the full-service-rule-pack check
    // below, just for calculators instead of Case+Mandate verticals.
    const ids = new Set(rankPriorityActions(50).map((a) => a.id));
    for (const id of ["pension-fees", "payslip", "severance", "maternity", "unemployment", "miluim"]) {
      expect(ids.has(id), `priority.ts CATALOG has no "${id}" entry`).toBe(true);
    }
  });

  // Three packs deliberately live at a differently-named page (telecom's
  // negotiation flow is /check, subscription's is /cancel, airline's is
  // /flights) — everything else's href is exactly /{vertical key}.
  const VERTICAL_HREF: Record<string, string> = {
    telecom: "/check",
    subscription: "/cancel",
    airline: "/flights",
  };

  it("every full-service rule pack has a door into this catalog, by href", () => {
    // parking, transport-fine, late-payment were real Case+Mandate+send
    // verticals that were simply never added here — invisible to both the
    // assistant's own digest and the dashboard's next-best-action ranking,
    // however good the underlying vertical was. This is the guard against
    // that recurring class of bug: a full-service pack existing is not the
    // same as the recommendation engine knowing it exists.
    const hrefs = new Set(rankPriorityActions(50).map((a) => a.href));
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(hrefs.has(href), `no priority.ts entry links to ${href} (pack "${pack.key}")`).toBe(true);
    }
  });

  it("ranking is unaffected by cadence — only potentialShekels and effort matter", () => {
    const ranked = rankPriorityActions(20);
    // A sanity check on the ranking function itself, not a cadence test: it
    // must still be sorted by descending weight regardless of what mix of
    // cadences the top results happen to have.
    const weight = (a: (typeof ranked)[number]) =>
      (a.potentialShekels / (a.effort === "low" ? 1 : a.effort === "medium" ? 1.4 : 2)) *
      (a.agentic ? 1.35 : 1);
    for (let i = 1; i < ranked.length; i++) {
      expect(weight(ranked[i - 1])).toBeGreaterThanOrEqual(weight(ranked[i]));
    }
  });
});

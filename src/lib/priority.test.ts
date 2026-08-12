import { describe, expect, it } from "vitest";
import {
  CATALOG,
  rankPriorityActions,
  formatPotentialHe,
  formatPotentialEn,
  priorityDigestHe,
  priorityWeight,
  MONTHLY_LEAK_PIN_IDS,
} from "./priority";
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
    const dormant = rankPriorityActions(80).find((a) => a.id === "dormant");
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
    const monthly = rankPriorityActions(50).find((a) => a.cadence === "monthly");
    expect(monthly).toBeDefined();
    expect(formatPotentialHe(monthly!)).toContain("/ח׳");
    expect(formatPotentialEn(monthly!)).toContain("/mo");
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
    // Membership, not rank. The catalog is larger than any fixed page size, so
    // `rankPriorityActions(50)` quietly meant "must be in the top 50" — which
    // fails for a real vertical that correctly ranks low because it recovers
    // no money (a debt-verification demand has no amount, and inventing one
    // would be a claim about somebody else's debt). Knowing a door exists and
    // ranking it highly are different questions; this guard is about the
    // first. It still catches the original bug, where parking, transport-fine
    // and late-payment were absent from the catalog altogether.
    const hrefs = new Set(CATALOG.map((a) => a.href));
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(hrefs.has(href), `no priority.ts entry links to ${href} (pack "${pack.key}")`).toBe(true);
    }
  });

  it("ranking stays sorted by descending priorityWeight", () => {
    const ranked = rankPriorityActions(20);
    for (let i = 1; i < ranked.length; i++) {
      expect(priorityWeight(ranked[i - 1])).toBeGreaterThanOrEqual(priorityWeight(ranked[i]));
    }
  });

  it("cash already recovered is not buried under a projection", () => {
    /**
     * This test used to assert the opposite, and the reversal is deliberate.
     *
     * It read "monthly agent doors outrank one-time calculator doors" and was
     * satisfied by a cadence factor of twelve — a claim nobody here has
     * verified. Every monthly pack verifies with `before_after_bill`, which
     * proves one billing cycle, and `computeFee` charges 18% of one month. So
     * the ordering asserted eleven months that were neither observed nor
     * charged for, and put a ₪40/month bank-fee door above a ₪400 warranty
     * recovery — the smaller, slower money first, which is also the money this
     * product earns least on.
     *
     * What replaces it is narrower and checkable: a one-time recovery worth
     * several hundred shekels must not rank below a monthly door worth tens.
     * Monthly doors are still valuable and still rank well; they no longer get
     * an unearned multiplier.
     */
    const ranked = rankPriorityActions(40);
    const idx = (id: string) => ranked.findIndex((a) => a.id === id);

    const warranty = idx("warranty");
    const bankFees = idx("bank-fees");
    expect(warranty, "warranty missing from the ranking").toBeGreaterThanOrEqual(0);
    expect(bankFees, "bank-fees missing from the ranking").toBeGreaterThanOrEqual(0);
    // ₪400 in hand against ₪40 a month.
    expect(warranty).toBeLessThan(bankFees);

    // And the general rule, not just that one pair.
    for (const a of ranked) {
      if (a.cadence !== "oneTime" || !a.agentic || a.potentialShekels < 400) continue;
      for (const b of ranked) {
        if (b.cadence !== "monthly" || b.potentialShekels > 50) continue;
        expect(
          idx(a.id),
          `${a.id} (₪${a.potentialShekels} one-time) ranks below ${b.id} (₪${b.potentialShekels}/mo)`,
        ).toBeLessThan(idx(b.id));
      }
    }
  });

  it("still surfaces the monthly agent doors — they are demoted, not dropped", () => {
    const top = rankPriorityActions(40).map((a) => a.id);
    for (const id of ["cancel", "bank-fees", "check"]) {
      expect(top, `${id} fell out of the ranking entirely`).toContain(id);
    }
  });

  it("pinIds put the monthly-leak trio first on /money", () => {
    const top = rankPriorityActions(
      3,
      {},
      {
        pinIds: [...MONTHLY_LEAK_PIN_IDS],
        excludeIds: ["money"],
      },
    ).map((a) => a.id);
    expect(top).toEqual(["cancel", "check", "bank-fees"]);
  });
});

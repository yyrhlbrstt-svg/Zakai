import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RULE_PACKS } from "./verticals";

/**
 * The in-app assistant's knowledge is plain English/Hebrew text baked into a
 * prompt string — it can't import RULE_PACKS at runtime the way UI code can,
 * so nothing forces it to stay in sync as verticals are added or graduate to
 * full-service. That's exactly how it drifted: /parking and /transport-fine
 * became real Case+Mandate+send verticals but the assistant kept telling
 * users they were "self-help templates the user sends themselves", and
 * /late-payment, /overtime-backpay, /contract-check weren't mentioned at all.
 * These tests don't fix drift automatically — they fail loudly the next time
 * it happens, on both files that carry this hardcoded knowledge.
 */
const VERTICAL_HREF: Record<string, string> = {
  telecom: "/check",
  subscription: "/cancel",
  airline: "/flights",
};

describe("assistant + playbook knowledge stays in sync with real verticals", () => {
  // The assistant's system prompt is built by buildAssistantSystem() in
  // assistantSystem.ts (ai.ts just calls it) — that's the file that actually
  // carries this hardcoded knowledge now.
  const aiSource = readFileSync("src/lib/assistantSystem.ts", "utf8");
  const playbookSource = readFileSync("src/lib/agentPlaybook.ts", "utf8");
  const leaksSource = readFileSync("src/app/[locale]/leaks/page.tsx", "utf8");
  const faqSource = readFileSync("src/lib/faq.ts", "utf8");

  it("every full-service vertical's screen is mentioned in the assistant's system prompt", () => {
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(aiSource.includes(href), `ai.ts never mentions ${href} (pack "${pack.key}")`).toBe(true);
    }
  });

  it("every full-service vertical's screen is mentioned in the playbook injected into the assistant", () => {
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(
        playbookSource.includes(href),
        `agentPlaybook.ts never mentions ${href} (pack "${pack.key}")`,
      ).toBe(true);
    }
  });

  it("playbook finishes Cases on /money — not the dashboard portfolio", () => {
    // The assistant used to contradict NEXT_ACTION_HREF by calling dashboard
    // the "command center" after send. Finish surface is /money?case=.
    expect(playbookSource).not.toMatch(/dashboard is the command center/i);
    expect(playbookSource).toContain("/money?case=");
    expect(playbookSource).toMatch(/Never prefer \/dashboard for finish work/);
  });

  it("every full-service vertical's screen is a door on the leaks map — same gap as priority.ts/ai.ts had", () => {
    // parking, transport-fine and late-payment were absent from /leaks despite
    // its own header comment promising "every leak points at an agent path" —
    // the same class of bug as the assistant's stale knowledge, just on a
    // third surface.
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(
        leaksSource.includes(`href: "${href}"`),
        `/leaks never links to ${href} (pack "${pack.key}")`,
      ).toBe(true);
    }
  });

  it("a full-service vertical is never described as a self-help template the user sends themselves", () => {
    // The exact bug: parking/transport-fine were real agent+Mandate services
    // mislabeled as self-help in the assistant's own knowledge block.
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      const linesWithHref = aiSource.split("\n").filter((l) => l.includes(href));
      for (const line of linesWithHref) {
        expect(
          /self-help/i.test(line),
          `line mentioning ${href} claims self-help, but it's a full-service pack: "${line.trim()}"`,
        ).toBe(false);
      }
    }
  });

  it("every full-service vertical's screen is mentioned in the FAQ digest fed straight into the assistant prompt", () => {
    // faq.ts's faqDigest() is concatenated directly into buildAssistantSystem()
    // (see assistantSystem.ts) — a vertical missing here is missing from the
    // assistant's prompt a second, independent way, on top of the KNOWLEDGE
    // block above.
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      expect(faqSource.includes(href), `faq.ts never mentions ${href} (pack "${pack.key}")`).toBe(true);
    }
  });

  it("the FAQ frames every full-service vertical as agent-driven, not a bare letter template", () => {
    // parking/transport-fine's FAQ answer used to say only "appeal letter at
    // /parking" — true but misleading, since both are agent+Mandate services,
    // not a template the user fills in themselves. Every FAQ entry answering
    // for a full-service href must at least say so (Mandate, or "הסוכן"/agent).
    for (const pack of RULE_PACKS.filter((p) => p.level === "full")) {
      const href = VERTICAL_HREF[pack.key] ?? `/${pack.key}`;
      const answerLines = faqSource
        .split("\n")
        .filter((l) => l.includes(href) && (l.trim().startsWith("a_he:") || l.trim().startsWith("a_en:")));
      expect(answerLines.length, `no FAQ answer line mentions ${href}`).toBeGreaterThan(0);
      for (const line of answerLines) {
        expect(
          /mandate|הסוכן|agent/i.test(line),
          `FAQ answer for ${href} doesn't frame it as agent-driven: "${line.trim()}"`,
        ).toBe(true);
      }
    }
  });
});

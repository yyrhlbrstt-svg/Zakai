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
  const aiSource = readFileSync("src/lib/ai.ts", "utf8");
  const playbookSource = readFileSync("src/lib/agentPlaybook.ts", "utf8");
  const leaksSource = readFileSync("src/app/[locale]/leaks/page.tsx", "utf8");

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
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The last screen of the product may not be written for us either.
 *
 * `heroPlainLanguage.test.ts` guards the front door. This guards the far end
 * — the screen somebody reaches after signing up, opening a case, proving
 * ownership and sending a letter, where they finally record what they saved.
 * A stranger walked the whole journey in a browser and arrived at:
 *
 *   "סגירת הלופ — רשמו SavingsProof"
 *   "זו המטרה של התיק. בלי רישום אין עמלה, אין הוכחה, ואין Gravity."
 *
 * `SavingsProof` is a table. `Gravity` is a metric on an internal dashboard.
 * At the single moment the product asks somebody for the number the whole
 * thing exists to capture, it told them that without it we would have no
 * Gravity. They have no idea what that is and no reason to want it.
 *
 * WHAT IS BANNED AND WHAT IS NOT
 *
 * Not "Mandate". That word is the product's actual noun — the signed,
 * verifiable authority a provider can check — and the company's stated
 * long-term asset. Teaching a reader a real name for a real thing is how
 * every product names its own machinery. What is banned is naming our
 * *storage and our metrics* at somebody: a table name, a KPI, a key format.
 * They carry no meaning outside this repository, so they can only ever
 * subtract.
 *
 * Scans source rather than message bundles because these screens keep their
 * copy in per-locale objects inside the component, which is where the drift
 * happened and where no message-bundle test would ever have looked.
 */

/** Storage and metric names. Never a word said to a person. */
const INTERNAL_NAMES = ["SavingsProof", "StrategyOutcome", "Gravity", "JWKS", "Money OS"];

/** The screens somebody actually walks through to recover money. */
const LOOP_COMPONENTS = [
  "src/components/CaseNextStep.tsx",
  "src/components/MoneyLoopCloser.tsx",
  "src/components/MoneyHub.tsx",
  "src/components/CheckFlow.tsx",
];

/**
 * Lines carrying prose, by line rather than by literal.
 *
 * The first version of this tokenized double-quoted strings and found nothing
 * at all in a file that visibly contained four offenders. A single `"` inside
 * a single-quoted string or a JSX attribute shifts the quote pairing for
 * everything after it, so real sentences end up split across pairs that never
 * match. A tokenizer that is subtly wrong reports zero problems, which is
 * indistinguishable from a clean file — the exact failure this whole test
 * exists to prevent.
 *
 * Working line-by-line cannot drift out of sync. It over-collects (a line can
 * hold code and prose at once) and over-collecting is the safe direction here.
 */
function proseLines(source: string): string[] {
  const out: string[] = [];
  let inBlockComment = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlockComment = true;
      continue;
    }
    if (line.startsWith("//") || line.startsWith("*")) continue;
    if (!line.includes('"') && !line.includes("`")) continue;
    const hebrew = /[֐-׿]/.test(line);
    const englishSentence = /[a-z]{2,}\s[a-z]{2,}\s[a-z]{2,}/i.test(line);
    if (hebrew || englishSentence) out.push(line);
  }
  return out;
}

describe("the loop screens do not name our storage at the reader", () => {
  const loaded = LOOP_COMPONENTS.map((rel) => ({
    rel,
    literals: proseLines(readFileSync(join(process.cwd(), rel), "utf8")),
  }));

  it("actually found copy to examine in every guarded file", () => {
    // A renamed file, or a refactor that moved this copy into a message
    // bundle, would otherwise leave this suite passing on nothing at all.
    // Per-file floor is low on purpose — MoneyLoopCloser is mostly a wrapper
    // and legitimately carries only a handful of strings — so the total is
    // asserted too, which is what would collapse if these screens stopped
    // holding their own copy.
    for (const { rel, literals } of loaded) {
      expect(literals.length, `${rel} yielded no user-facing strings`).toBeGreaterThanOrEqual(5);
    }
    const total = loaded.reduce((n, f) => n + f.literals.length, 0);
    expect(total, "the loop screens stopped carrying their own copy").toBeGreaterThan(200);
  });

  for (const term of INTERNAL_NAMES) {
    it(`never says "${term}" to a person`, () => {
      const offenders: string[] = [];
      for (const { rel, literals } of loaded) {
        for (const value of literals) {
          if (value.includes(term)) offenders.push(`${rel} → ${value.slice(0, 120)}`);
        }
      }
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The authorized-practice shield as a lint — Master Build Prompt v2,
 * constraint 8.
 *
 * Zakai is a self-help tool acting in the client's name under agency
 * (שליחוּת). It is never legal counsel, and no template, message, or letter
 * may ever describe it as one. The product's copy today is clean — every
 * mention of lawyers is either a negation ("אינה עורכת דין", "not legal
 * advice") or a counsel-handoff ("מחברים אותך לעורך דין"), both allowed.
 * This test is the ratchet that keeps it that way: it scans every locale
 * file and every letter-building module for AFFIRMATIVE self-descriptions
 * as a law practice, and fails the build on the first one.
 *
 * Patterns are deliberately phrase-level, not word-level: "power of
 * attorney" and "refer you to a lawyer" must keep passing; "we are
 * lawyers" must never.
 */

const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  // Hebrew — claiming to BE lawyers / a law firm
  { pattern: /אנחנו עורכי דין|אנו עורכי דין/u, label: "we-are-lawyers (he)" },
  { pattern: /זכאי (היא|הינה) (עורכת דין|משרד עורכי דין)/u, label: "zakai-is-a-law-firm (he)" },
  { pattern: /משרד עורכי הדין זכאי|משרד עו"ד זכאי/u, label: "zakai-law-office (he)" },
  // Hebrew — claiming to PROVIDE legal advice / representation. The
  // lookbehind keeps the honest negations passing ("אינה נותנת ייעוץ
  // משפטי") while an affirmative claim still fails.
  {
    pattern: /(?<!אינה |אינו |לא |ואינה |ואינו |איננה )(מעניקים|מעניקה|נותנים|נותנת|מספקים|מספקת) ייעוץ משפטי/u,
    label: "provides-legal-advice (he)",
  },
  { pattern: /ייצוג משפטי (על ידי|מטעם|באמצעות) זכאי/u, label: "legal-representation-by-zakai (he)" },
  { pattern: /עורך דין (מטעם|של) זכאי/u, label: "lawyer-of-zakai (he)" },
  // English
  { pattern: /we are (lawyers|attorneys|a law firm)/i, label: "we-are-lawyers (en)" },
  { pattern: /zakai is (a law firm|an attorney|a lawyer|legal counsel)/i, label: "zakai-is-a-law-firm (en)" },
  {
    // "does not provide legal advice" must keep passing; "provides legal
    // advice" must never.
    pattern: /(?<!not |never |n't )(provides?|offers?|giving|gives) legal advice/i,
    label: "provides-legal-advice (en)",
  },
  { pattern: /legal representation (by|from) zakai/i, label: "legal-representation-by-zakai (en)" },
  { pattern: /robot lawyer/i, label: "robot-lawyer (the DoNotPay mistake)" },
];

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(p, acc);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("authorized-practice lint — the product never calls itself a lawyer", () => {
  const roots = [
    ...readdirSync(join(process.cwd(), "src/messages")).map((f) =>
      join(process.cwd(), "src/messages", f),
    ),
    ...walkTsFiles(join(process.cwd(), "src/lib")),
  ];

  it("scans a real, non-trivial surface", () => {
    // Guard against the lint silently passing because the walk broke.
    expect(roots.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN.map((f) => [f.label, f] as const))(
    "no file contains: %s",
    (_label, forbidden) => {
      const offenders: string[] = [];
      for (const file of roots) {
        const text = readFileSync(file, "utf8");
        if (forbidden.pattern.test(text)) offenders.push(file.replace(process.cwd(), ""));
      }
      expect(offenders, `forbidden self-description found in: ${offenders.join(", ")}`).toEqual([]);
    },
  );
});

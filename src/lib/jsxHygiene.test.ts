import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

/**
 * The build error this repository fought eight commits in a row —
 * `Expected '</', got 'ho'` — comes from one pattern: user-facing text written
 * inline inside JSX, typically as {he ? "..." : "..."}. It broke production
 * repeatedly, and the eventual workaround was to strip the Hebrew out of the
 * homepage and hardcode English, which is how an Israeli visitor ended up
 * reading "Markets: IL GB" above a version number.
 *
 * The real fix is that user-facing strings live in message catalogues, which
 * also makes Arabic and Russian a translation task instead of a rewrite. That
 * migration is not finished: the count below is the debt that remains.
 *
 * This test does not pretend it is fixed. It stops it growing, and it makes the
 * number visible so it can only go down — a ratchet is worth more than a
 * cleanup that quietly reverts.
 *
 * THE BLIND SPOT THIS ONCE HAD
 *
 * The check below used to grep only for double-quoted strings
 * (`{he ? "..."`), so five call sites that wrote the exact same literal-text
 * hazard with backticks instead — {he ? `Your year with Zakai` : `...`} in
 * wrapped/page.tsx, two more in documents/page.tsx, one in
 * PriorityActions.tsx — passed a CEILING of 0 while sitting in the tree.
 * They were not a parse hazard (SWC tolerates backticks the same as any
 * other JSX-embedded expression), but they were exactly the thing this
 * ratchet exists to catch: literal Hebrew/English text a screen reader
 * cannot repoint to Arabic or Russian. All five are migrated to message
 * catalogues now; the regex covers both quote styles so the next one does
 * not get the same free pass.
 */
const CEILING = 0;

/**
 * A separate, smaller problem left standing on purpose: ternaries that pick
 * between two *variables* rather than two string literals — {he ? a.titleHe :
 * a.titleEn}. Those are data carrying both languages, which is an
 * architectural choice to unwind deliberately, not a parse hazard.
 *
 * This one used to be a comment with a number nobody checked — the same
 * failure mode as the CEILING blind spot above, just one paragraph down.
 * It is a real assertion now, for the same reason: an unenforced count is a
 * number that can only be trusted the day it was written.
 */
const DATA_DRIVEN_TERNARIES_CEILING = 13;

// Literal text: `{he ? "..."` or the backtick-string equivalent — user-facing
// copy typed directly into JSX instead of pulled from a message catalogue.
function literalTextOffenders(): string[] {
  try {
    const out = execSync(
      `grep -rlE '\\{he \\? ["\\\`]' 'src/app/[locale]' src/components || true`,
      { encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// Data-driven: `{he ? x.foo : x.bar}` — a ternary over two fields, not two
// literals. Counted at the line level (a file can carry more than one).
function dataDrivenOffenders(): string[] {
  try {
    const out = execSync(
      `grep -rnE '\\{he \\?' 'src/app/[locale]' src/components | grep -vE '\\{he \\? ["\\\`]' || true`,
      { encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

describe("inline JSX text — the pattern that broke the build", () => {
  it("never grows", () => {
    const found = literalTextOffenders();
    expect(
      { count: found.length, ceiling: CEILING, worst: found.slice(0, 5) },
      `New inline-text JSX detected. Put user-facing strings in src/messages and use t() — this is the pattern that produces "Expected '</', got 'ho'" on Vercel.`,
    ).toMatchObject({ count: expect.any(Number) });
    expect(found.length).toBeLessThanOrEqual(CEILING);
  });

  it("keeps the entry point clean, whatever the rest still owes", () => {
    // The homepage is the file that actually broke, and the one every visitor
    // loads. It stays free of the pattern even while the backlog drains.
    expect(literalTextOffenders()).not.toContain("src/app/[locale]/page.tsx");
  });

  it("data-driven he/en field ternaries never grow past the known backlog", () => {
    const found = dataDrivenOffenders();
    expect(
      { count: found.length, ceiling: DATA_DRIVEN_TERNARIES_CEILING, worst: found.slice(0, 5) },
      `New {he ? x.foo : x.bar}-shaped ternary detected. This isn't the JSX parse hazard, but it's still text that should live in src/messages so Arabic and Russian don't need a rewrite.`,
    ).toMatchObject({ count: expect.any(Number) });
    expect(found.length).toBeLessThanOrEqual(DATA_DRIVEN_TERNARIES_CEILING);
  });
});

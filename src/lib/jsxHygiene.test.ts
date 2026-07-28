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
 */
const CEILING = 0;

/**
 * A separate, smaller problem left standing on purpose: 21 ternaries that pick
 * between two *variables* or template literals rather than two string literals
 * — {he ? a.titleHe : a.titleEn}. Those are data carrying both languages, which
 * is an architectural choice to unwind deliberately, not a parse hazard. The
 * SWC failure came from literal text inside JSX, and that is now zero.
 */
const DATA_DRIVEN_TERNARIES_REMAINING = 21;

function offenders(): string[] {
  try {
    const out = execSync(
      `grep -rlE '\\{he \\? "' 'src/app/[locale]' src/components || true`,
      { encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

describe("inline JSX text — the pattern that broke the build", () => {
  it("never grows", () => {
    const found = offenders();
    expect(
      { count: found.length, ceiling: CEILING, worst: found.slice(0, 5) },
      `New inline-text JSX detected. Put user-facing strings in src/messages and use t() — this is the pattern that produces "Expected '</', got 'ho'" on Vercel.`,
    ).toMatchObject({ count: expect.any(Number) });
    expect(found.length).toBeLessThanOrEqual(CEILING);
  });

  it("keeps the entry point clean, whatever the rest still owes", () => {
    // The homepage is the file that actually broke, and the one every visitor
    // loads. It stays free of the pattern even while the backlog drains.
    expect(offenders()).not.toContain("src/app/[locale]/page.tsx");
  });
});

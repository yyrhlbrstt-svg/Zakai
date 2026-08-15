import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A failed fetch must leave a state that is not "loading".
 *
 * THE BUG THIS COMES FROM
 *
 * `CommitmentsBoard` loaded its list with `if (!res.ok) return;`, which left
 * the rows state null forever. The list is behind a session, so every
 * logged-out visitor to /commitments sat looking at "Loading…" — no error, no
 * sign-in prompt, no way onward, indefinitely.
 *
 * Nothing caught it. The unit suite was green, the page returned 200, and the
 * browser sweep passed it on the run where the local database happened to have
 * rows in it. The data was hiding the bug; recreating the database exposed it.
 *
 * `DeadlineTracker` had the same line with a milder symptom: a failed load
 * rendered neither the list nor the empty message, so the person saw blank
 * space where their own data should be and could not tell "nothing saved" from
 * "we could not fetch it".
 *
 * WHAT THIS CHECKS
 *
 * The bare early return. `if (!res.ok) return;` inside a component discards the
 * failure and leaves whatever state the render is guarded on untouched. Every
 * legitimate version of that line does something first — sets an error, sets an
 * empty array, redirects — so requiring a body is a low-noise way to force the
 * question "and what does the person see now?".
 *
 * It is a ceiling of zero rather than a count: both sites are fixed, so a new
 * one is a new mistake rather than inherited debt.
 */

const BARE_EARLY_RETURN = /if\s*\(\s*!\s*(?:res|response|r)\s*\.\s*ok\s*\)\s*return\s*;/;

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("a failed fetch never leaves the screen loading", () => {
  const files = [...tsxFiles("src/components"), ...tsxFiles("src/app")];

  it("finds the component tree at all", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no component discards a failed response with a bare return", () => {
    const offenders = files.filter((f) => BARE_EARLY_RETURN.test(readFileSync(f, "utf8")));
    expect(
      offenders,
      offenders.length > 0
        ? `Bare "if (!res.ok) return;" in: ${offenders.join(", ")}. Discarding the ` +
          `failure leaves whatever state the render is guarded on untouched — ` +
          `usually a spinner that never resolves, or blank space where the ` +
          `person's own data should be. Set an error, set an empty value, or ` +
          `redirect, so the screen says something.`
        : "",
    ).toEqual([]);
  });

  it("catches the exact shape it was written for", () => {
    // Proven against the real line, not a paraphrase of it.
    for (const sample of [
      "if (!res.ok) return;",
      "if (!response.ok) return;",
      "if ( ! res.ok ) return ;",
    ]) {
      expect(BARE_EARLY_RETURN.test(sample), `missed: ${sample}`).toBe(true);
    }
    // And leaves the versions that do say something alone.
    for (const sample of [
      "if (!res.ok) { setErr(m); return; }",
      "if (!res.ok) return null;",
      "if (!res.ok) throw new Error('x');",
    ]) {
      expect(BARE_EARLY_RETURN.test(sample), `false positive: ${sample}`).toBe(false);
    }
  });
});

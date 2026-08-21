import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * `toLocaleString()` with no argument is a hydration bug waiting for a
 * visitor who is not Israeli.
 *
 * The runtime picks the default locale, and the two runtimes involved do not
 * agree: Next renders on the server with Node's default (en-US here), the
 * browser re-renders with the *visitor's* — so a German phone loading /de
 * produces `1.200` where the server produced `1,200`. React sees a mismatch,
 * throws away the server HTML, and re-renders the whole tree. The QA sweep of
 * 2026-08-21 caught exactly this as `Minified React error #418` on
 * /credit-card in de, fr and ru, and only there: he, en and ar happen to
 * share en-US's separators, so the bug is invisible in every locale the
 * founder tests in.
 *
 * A second call sat latent on /protocol, formatting a counter that was still
 * zero. Zero needs no separator, so it looked fine — it would have started
 * failing on the day the outcome graph reached four digits, which is the
 * worst possible day to discover it.
 *
 * The fix is always the same one line: pass the page's own locale, via
 * `bcp47[locale]`. So this ratchet is a flat zero rather than a countdown —
 * there is no legitimate reason to ask the runtime what language it feels
 * like today.
 */
describe("locale-aware number formatting", () => {
  it("never calls toLocaleString() without a locale in rendered code", () => {
    // Scan the source with comments stripped. Grep alone cannot do this, and
    // it matters here: the comment beside each fixed call site names the very
    // pattern being banned, and so does this file.
    const files = execSync(
      "find src/app src/components -name '*.tsx' -o -name '*.ts' | sort",
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);

    const offenders: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      code.split("\n").forEach((line, i) => {
        if (line.includes("toLocaleString()")) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }

    expect(
      offenders,
      `toLocaleString() with no locale argument formats with the runtime's default, ` +
        `which differs between the server and the visitor's browser and costs a ` +
        `hydration error. Pass bcp47[locale] instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

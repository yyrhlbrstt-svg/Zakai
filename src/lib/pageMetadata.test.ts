import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Every page declares its own title.
 *
 * Twenty-one pages did not. The visible cost was a browser tab reading
 * "zakai-3uxj.vercel.app" — which is what somebody sees when they have six
 * tabs open and are trying to find the one with their money in it — and, for
 * the public ones, a search result with no title of its own.
 *
 * It is a ceiling of zero rather than a count, because unlike the ad-hoc font
 * sizes there is no migration debt left to pay down: the set is closed, it is
 * at zero now, and adding a page without a title is a new mistake rather than
 * an old one.
 */
function pages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

function declares(src: string): boolean {
  return src.includes("generateMetadata") || src.includes("export const metadata");
}

/**
 * A page's title may live on the page or on the layout beside it.
 *
 * The second is not a loophole, it is the only option a client page has: a
 * `"use client"` file cannot export `generateMetadata` at all, so a route
 * whose screen reads a one-time token out of the URL has to put its title on
 * the layout. Refusing to look there would push those routes back to having no
 * title, which is the thing this test is for.
 */
function declaresMetadata(pageFile: string): boolean {
  if (declares(readFileSync(pageFile, "utf8"))) return true;
  const layout = join(dirname(pageFile), "layout.tsx");
  return existsSync(layout) && declares(readFileSync(layout, "utf8"));
}

describe("page metadata", () => {
  const files = pages("src/app/[locale]");

  it("finds the route tree at all", () => {
    // Without this, a moved directory would leave the check passing over
    // nothing — the silent no-op these guards exist to prevent.
    expect(files.length).toBeGreaterThan(100);
  });

  it("every page declares a title", () => {
    const missing = files.filter((f) => !declaresMetadata(f));
    expect(
      missing,
      missing.length > 0
        ? `Pages without metadata: ${missing.join(", ")}. Use publicPageMetadata() ` +
          `for an indexable page or privatePageMetadata() for one behind a login.`
        : "",
    ).toEqual([]);
  });

  it("a page that is not indexable says so, rather than being left to chance", () => {
    // The screens that show one person's own money, documents or authority.
    // Each of these is reachable by URL, so "nobody will link to it" is not
    // the same as "it will not be indexed".
    const mustBeNoindex = [
      "src/app/[locale]/dashboard/page.tsx",
      "src/app/[locale]/settings/page.tsx",
      "src/app/[locale]/authority/page.tsx",
      "src/app/[locale]/activity/page.tsx",
      "src/app/[locale]/coupons/page.tsx",
      "src/app/[locale]/founder/page.tsx",
      "src/app/[locale]/check/page.tsx",
      "src/app/[locale]/scan/page.tsx",
    ];
    for (const f of mustBeNoindex) {
      const src = readFileSync(f, "utf8");
      const declared = src.includes("privatePageMetadata") || src.includes("index: false");
      expect(declared, `${f} is a private screen but does not declare noindex`).toBe(true);
    }
  });
});

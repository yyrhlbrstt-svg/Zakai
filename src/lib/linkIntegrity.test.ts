import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * Every internal link in a hand-maintained registry must point at a page that
 * exists.
 *
 * Three separate lists — the tools catalog, the next-best-action ranking, and
 * the leaks map — are written by hand and reference routes by string. Nothing
 * connects an entry to the page it names, so renaming or removing a route
 * leaves a link that still looks correct in the source and 404s in a browser.
 * These are the lists that feed the primary navigation surfaces, so a stale
 * entry is a dead end on the exact paths meant to carry someone to a case.
 *
 * Reading the sources as text rather than importing them keeps this free of
 * the module graph: priority.ts and the leaks page pull in server-only code
 * that a unit test has no business booting.
 */
const SOURCES: [string, string][] = [
  ["tools catalog", "src/lib/toolsCatalog.ts"],
  ["priority ranking", "src/lib/priority.ts"],
  ["leaks map", "src/app/[locale]/leaks/page.tsx"],
];

function internalHrefs(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...new Set([...src.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]))];
}

/** Strip the fragment and query — /money#scan is served by /money. */
function routeOf(href: string): string {
  return href.split("#")[0].split("?")[0].replace(/\/+$/, "");
}

describe("internal links resolve to real pages", () => {
  for (const [label, file] of SOURCES) {
    it(`${label}: every href has a page`, () => {
      const hrefs = internalHrefs(file);
      // Guards against a refactor that changes the shape and silently leaves
      // this asserting over an empty list.
      expect(hrefs.length, `${file} yielded no hrefs — has the shape changed?`).toBeGreaterThan(5);

      const dead = hrefs.filter((href) => {
        const route = routeOf(href);
        if (route === "" || route === "/") return false; // home
        return !existsSync(`src/app/[locale]${route}/page.tsx`);
      });
      expect(dead, `${file} links to routes with no page: ${dead.join(", ")}`).toEqual([]);
    });
  }
});

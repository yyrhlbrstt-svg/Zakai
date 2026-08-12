import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * No page that nothing points at.
 *
 * THE DEFECT THIS EXISTS FOR
 *
 * `/commitments` was built, tested, translated, swept in a browser and shipped
 * — and nothing anywhere linked to it. It was reachable only by typing the URL.
 * Every check in this repository passed: the unit suite was green, the route
 * sweep loaded it fine and reported no dead end, because a dead end is about
 * where a page leads and this is about whether anyone can get there.
 *
 * That is the second half of a defect class this codebase already names as an
 * anti-pattern — "built and wired to nothing" — and it had no check.
 *
 * WHAT COUNTS AS REACHABLE
 *
 * A literal mention of the path anywhere in `src/` outside the route's own
 * directory: a `<Link href>`, an entry in `toolsCatalog.ts`, a target in
 * `priority.ts`, a redirect. Self-references do not count, or every page would
 * vouch for itself.
 *
 * WHAT IS ALLOWED TO BE UNREFERENCED
 *
 * Two kinds, both listed explicitly rather than pattern-matched away:
 *
 *  - Dynamic segments. `/companies/[provider]` is linked as
 *    `/companies/${slug}`, which no literal search can see. The parent path
 *    being referenced is the real evidence, and that is what is checked.
 *  - Pages whose only entry point is outside the app — a link in an email, a
 *    QR code on a printed document. Each one needs a reason written next to it.
 */

const BASE = join("src", "app", "[locale]");

/**
 * Routes reached from somewhere this repository cannot see, with the reason.
 * Adding a line here is a decision; leaving a page unreferenced by accident is
 * what the test is for.
 */
const REACHED_FROM_OUTSIDE: Record<string, string> = {};

function routes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routes(full, acc);
    else if (entry === "page.tsx") {
      const rel = relative(BASE, dir);
      acc.push(rel === "" ? "/" : `/${rel.split(sep).join("/")}`);
    }
  }
  return acc;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    // Tests are excluded from the evidence set on purpose. A test that names a
    // route — including this file's own comments — is not a way for a person to
    // reach it, and counting it would let this check vouch for itself.
    else if (/\.(ts|tsx|json)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * The path a literal search should look for.
 *
 * For a dynamic route the parameter cannot appear literally, so the parent is
 * what gets checked: if nothing links to `/companies` at all, the detail page
 * under it is unreachable too, which is the thing worth knowing.
 */
function searchablePath(route: string): string {
  const parts = route.split("/").filter(Boolean);
  const firstDynamic = parts.findIndex((p) => p.startsWith("["));
  if (firstDynamic === -1) return route;
  const parent = parts.slice(0, firstDynamic);
  return parent.length === 0 ? "/" : `/${parent.join("/")}`;
}

describe("no page that nothing points at", () => {
  const all = routes(BASE);
  const files = sourceFiles("src");
  const contents = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

  it("finds the routes and the sources at all", () => {
    expect(all.length).toBeGreaterThan(100);
    expect(files.length).toBeGreaterThan(200);
  });

  it("every route is linked from somewhere outside itself", () => {
    const orphans: string[] = [];

    for (const route of all) {
      if (route === "/") continue;
      if (route in REACHED_FROM_OUTSIDE) continue;

      const target = searchablePath(route);
      if (target === "/") continue;

      const ownDir = join(BASE, ...route.split("/").filter(Boolean));
      // Boundaries on both sides. The right one stops /bank counting as a
      // link to /bank-fees. The left one matters more and was missing at
      // first: without it "/api/commitments" and an import of
      // "@/lib/services/commitments" both read as links to the /commitments
      // page, and the check silently passed over the very orphan it was
      // written for. An API route is not a page a person can open.
      const pattern = new RegExp(
        `(?<![A-Za-z0-9_-])${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`,
      );

      let found = false;
      for (const [file, text] of contents) {
        if (file.startsWith(ownDir + sep) || file === join(ownDir, "page.tsx")) continue;
        if (pattern.test(text)) {
          found = true;
          break;
        }
      }
      if (!found) orphans.push(route);
    }

    expect(
      orphans,
      orphans.length > 0
        ? `Pages nothing links to: ${orphans.join(", ")}. A page reachable only ` +
          `by typing its URL is the same as one that was never shipped. Link it ` +
          `from src/lib/toolsCatalog.ts, priority.ts, or a real screen — or, if ` +
          `its entry point is genuinely outside the app (an email, a printed ` +
          `code), add it to REACHED_FROM_OUTSIDE with the reason.`
        : "",
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A link must not point at the page it is rendered on.
 *
 * Navigating to the URL you are already on scrolls to the top and changes
 * nothing else. To a reader that is indistinguishable from a broken control,
 * and it is worse than a dead link because the label promises somewhere to go:
 * the one this test was written for said "My dashboard" and linked to /money,
 * on /money. It was reported as "these buttons do nothing, they are
 * misleading" — an accurate description.
 *
 * The check is deliberately narrow. It only looks at a page file and the
 * components that page imports directly, and it only fires on a literal href
 * exactly equal to that page's own route. A first draft of this scan also
 * flagged ResetPasswordForm's link to /forgot, because /forgot's page imports
 * the same module for a *different* export — so scoping is by rendered export,
 * not by module, and shared components used from many pages are skipped.
 */
const APP = "src/app/[locale]";

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) pageFiles(p, out);
    else if (entry === "page.tsx") out.push(p);
  }
  return out;
}

/** "src/app/[locale]/money/page.tsx" -> "/money" */
function routeOf(pageFile: string): string {
  const rel = pageFile.slice(APP.length).replace(/\/?page\.tsx$/, "");
  return rel === "" ? "/" : rel;
}

/** Components a page imports by name, so a shared module is not blamed. */
function importedComponents(src: string): { file: string; names: string[] }[] {
  const out: { file: string; names: string[] }[] = [];
  for (const m of src.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*"@\/components\/([A-Za-z0-9_/]+)"/g,
  )) {
    out.push({
      file: `src/components/${m[2]}.tsx`,
      names: m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean),
    });
  }
  return out;
}

/**
 * Body of one exported function, so a link inside an export the page never
 * renders is not attributed to that page.
 */
function exportBody(src: string, name: string): string | null {
  const start = src.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
  if (start === -1) return null;

  // Skip the parameter list before looking for the body. Nearly every
  // component here destructures its props — `function MoneyHub({ ... })` — so
  // the first `{` after the name opens the *parameters*, not the body. An
  // earlier version of this helper stopped there and searched only the props,
  // which made the whole suite pass while the bug it was written for sat six
  // hundred lines below, untouched.
  const open = src.indexOf("(", start);
  if (open === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return null;

  const from = src.indexOf("{", afterParams);
  if (from === -1) return null;
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  return src.slice(from);
}

function selfLinksIn(body: string, route: string): string[] {
  // Only a bare href equal to the route. `/money#anchor` and `/money?case=x`
  // both go somewhere new on the page, so they are not self-links.
  const re = new RegExp(`href=\\{?["\`]${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["\`]`, "g");
  return body.split("\n").filter((line) => {
    re.lastIndex = 0;
    return re.test(line);
  });
}

describe("no link points at its own page", () => {
  const pages = pageFiles(APP);

  it("finds pages to check at all", () => {
    // A silent zero here would make every assertion below vacuous.
    expect(pages.length).toBeGreaterThan(50);
  });

  it("has no self-link on any page or in the components it renders", () => {
    const offenders: string[] = [];

    for (const pageFile of pages) {
      const route = routeOf(pageFile);
      if (route === "/") continue; // the home route is a prefix of everything
      const pageSrc = readFileSync(pageFile, "utf8");

      for (const line of selfLinksIn(pageSrc, route)) {
        offenders.push(`${pageFile} [page ${route}] ${line.trim()}`);
      }

      for (const { file, names } of importedComponents(pageSrc)) {
        let compSrc: string;
        try {
          compSrc = readFileSync(file, "utf8");
        } catch {
          continue; // barrel or non-file import
        }
        for (const name of names) {
          const body = exportBody(compSrc, name);
          if (!body) continue;
          for (const line of selfLinksIn(body, route)) {
            offenders.push(`${file} <${name}> [page ${route}] ${line.trim()}`);
          }
        }
      }
    }

    expect(
      offenders,
      "A link whose href equals the page it renders on scrolls to the top and " +
        "changes nothing — it reads as a broken button:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

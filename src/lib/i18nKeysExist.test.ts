import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import he from "../messages/he.json";

/**
 * A `t("key")` that resolves to nothing renders the raw key to a real reader.
 *
 * That is not theoretical: `RefundChaseTool` asked for a `company` key that
 * existed in no locale, and the readiness checklist on /refund-chase and
 * /price-protection labelled its own missing field with a raw string. Nothing
 * caught it — TypeScript cannot see inside the string, and the component
 * rendered fine in tests because next-intl only fails at render time, in a
 * browser, with a console error nobody was reading.
 *
 * Hebrew is the catalogue every fallback chain ends at, so a key missing here
 * is missing everywhere. Checking against it is checking the floor.
 */

const SRC = join(process.cwd(), "src");

/** Static `useTranslations("ns")` + `t("key")` pairs, per file. */
function usages(): { file: string; ns: string; key: string; bare: boolean; raw: boolean }[] {
  const out: { file: string; ns: string; key: string; bare: boolean; raw: boolean }[] = [];

  const walk = (dir: string): string[] => {
    const acc: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) acc.push(...walk(full));
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") && !e.name.endsWith(".test.tsx"))
        acc.push(full);
    }
    return acc;
  };

  for (const file of walk(SRC)) {
    // Comments are stripped first: a doc comment explaining a t("…") call is
    // not a call site, and counting one made this guard report a key that had
    // just been fixed.
    const src = stripComments(readFileSync(file, "utf8"));
    /**
     * Declarations of translator variables, with their position.
     *
     * Position matters: one file legitimately declares `t` more than once —
     * VatReport binds "vat" in one component and "vat.findings" in another —
     * and a name→namespace map keeps only the last, which made this guard
     * report thirty keys that were perfectly fine. Each call site resolves
     * against the nearest preceding declaration of that name instead.
     */
    const decls: { at: number; name: string; ns: string }[] = [];
    // The string form: useTranslations("ns")
    for (const m of src.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']\s*\)/g,
    )) {
      decls.push({ at: m.index ?? 0, name: m[1], ns: m[2] });
    }
    /**
     * The object form: getTranslations({ locale, namespace: "ns" }).
     *
     * Matched separately and deliberately — it is how every server component
     * in this app gets its translator, roughly 146 call sites, and a detector
     * that only knew the string form silently skipped all of them while
     * reporting success.
     */
    for (const m of src.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\{[^}]*namespace:\s*["']([^"']+)["'][^}]*\}\s*\)/g,
    )) {
      decls.push({ at: m.index ?? 0, name: m[1], ns: m[2] });
    }
    /**
     * The root form: getTranslations() / useTranslations() with no namespace,
     * where call sites pass the full dotted path themselves.
     *
     * Recorded with an empty namespace so it correctly shadows an earlier
     * namespaced declaration of the same variable — /companies declares a
     * namespaced `t` in generateMetadata and a root `t` in the page, and
     * ignoring the second made every key in that file look doubled.
     */
    for (const m of src.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\)/g,
    )) {
      decls.push({ at: m.index ?? 0, name: m[1], ns: "" });
    }
    // And the object form carrying no namespace — getTranslations({ locale })
    // — which is equally a root translator. The layout uses exactly this.
    for (const m of src.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\{(?![^}]*namespace:)[^}]*\}\s*\)/g,
    )) {
      decls.push({ at: m.index ?? 0, name: m[1], ns: "" });
    }
    decls.sort((a, b) => a.at - b.at);

    if (decls.length === 0) continue;

    for (const name of new Set(decls.map((d) => d.name))) {
      // Only literal keys — a computed key cannot be checked here, and is not
      // pretended to be.
      // Captures the closing character so a call with no values argument
      // (")") is distinguishable from one that passes them (",").
      const re = new RegExp(`(\\.raw)?\\b${name}(?:\\.raw)?\\(\\s*["']([^"'\`$]+)["']\\s*([,)])`, "g");
      for (const m of src.matchAll(re)) {
        const at = m.index ?? 0;
        const scope = decls
          .filter((d) => d.name === name && d.at < at)
          .sort((a, b) => b.at - a.at)[0];
        if (!scope) continue;
        out.push({
          file,
          ns: scope.ns,
          key: m[2],
          bare: m[3] === ")",
          raw: src.slice(Math.max(0, at), at + name.length + 5).includes(`${name}.raw`),
        });
      }
    }
  }
  return out;
}

/** Block and line comments, removed without disturbing string contents. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/**
 * The catalogue node a key points at, or undefined when nothing is there.
 *
 * Returns the node rather than a string on purpose: `t.raw()` legitimately
 * fetches arrays and objects (page step lists, FAQ entries), and treating
 * those as missing would report dozens of perfectly good keys.
 */
function nodeAt(ns: string, key: string): unknown {
  let node: unknown = he;
  const path = ns ? [...ns.split("."), ...key.split(".")] : key.split(".");
  for (const part of path) {
    if (!node || typeof node !== "object" || !(part in (node as Record<string, unknown>))) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** The string at a key, or null when it is absent or not a string. */
function messageAt(ns: string, key: string): string | null {
  const node = nodeAt(ns, key);
  return typeof node === "string" ? node : null;
}

describe("every translation key a component asks for exists", () => {
  it("resolves in he.json, the catalogue every fallback ends at", () => {
    const missing = usages()
      .filter((u) => nodeAt(u.ns, u.key) === undefined)
      .map((u) => `${u.ns}.${u.key}  (${u.file.replace(process.cwd() + "/", "")})`);

    expect(
      [...new Set(missing)],
      missing.length
        ? `These render as raw keys to a reader:\n  ${[...new Set(missing)].join("\n  ")}`
        : "",
    ).toEqual([]);
  });

  /**
   * A message like "GET /api/mandate/status/{jti}" fetched with a plain
   * t("key") and no values makes next-intl throw a formatting error and
   * render the key path instead. It looks identical to a missing key to the
   * reader, and it is what /institutions/leader and /domains were doing:
   * both deliberately want the raw template so a client component can fill it
   * in later, which is what t.raw() is for.
   */
  it("does not fetch a templated message without values", () => {
    const bad = usages()
      .filter((u) => u.bare && !u.raw)
      .filter((u) => {
        const msg = messageAt(u.ns, u.key);
        return msg !== null && /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(msg);
      })
      .map(
        (u) =>
          `${u.ns ? u.ns + "." : ""}${u.key} = "${messageAt(u.ns, u.key)}"  (${u.file.replace(
            process.cwd() + "/",
            "",
          )})`,
      );

    expect(
      [...new Set(bad)],
      bad.length
        ? "These throw a formatting error and render the key path:\n  " +
            `${[...new Set(bad)].join("\n  ")}\nPass the values, or use t.raw() when the template is filled in later.`
        : "",
    ).toEqual([]);
  });

  it("actually inspects a meaningful number of call sites", () => {
    // A regex that silently stopped matching would make this suite pass by
    // checking nothing, which is the failure mode of every guard built this
    // way. Assert it is still finding work to do.
    expect(usages().length).toBeGreaterThan(600);
  });
});

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import he from "../messages/he.json";
import en from "../messages/en.json";

/**
 * The small-business hub is a hand-written list of links in the message
 * catalogue, not a derived one — nothing connects an entry to the page it
 * points at. A renamed or removed route leaves a link that looks fine in the
 * JSON and 404s in a browser, and the hub is one of the few places a paying
 * business actually lands.
 *
 * It also drifts the other way: /late-payment and /advance-tax were real,
 * working tools aimed squarely at the self-employed that the hub never
 * listed, so the audience they were built for could not find them.
 */
type Tool = { href: string; title: string; sub: string };

const hubs: [string, Tool[]][] = [
  ["he", (he as { smallBusiness: { tools: Tool[] } }).smallBusiness.tools],
  ["en", (en as { smallBusiness: { tools: Tool[] } }).smallBusiness.tools],
];

describe("small-business hub", () => {
  for (const [locale, tools] of hubs) {
    it(`${locale}: every link points at a route that exists`, () => {
      for (const tool of tools) {
        expect(tool.href.startsWith("/"), `${tool.href} should be app-relative`).toBe(true);
        const page = `src/app/[locale]${tool.href}/page.tsx`;
        expect(existsSync(page), `${locale} hub links ${tool.href} but ${page} does not exist`).toBe(
          true,
        );
      }
    });

    it(`${locale}: every entry has real copy, not a placeholder`, () => {
      for (const tool of tools) {
        expect(tool.title.trim().length, `${tool.href} has no title`).toBeGreaterThan(0);
        expect(tool.sub.trim().length, `${tool.href} has no subtitle`).toBeGreaterThan(0);
      }
    });
  }

  it("he and en list the same tools, so neither locale hides one", () => {
    const [, heTools] = hubs[0];
    const [, enTools] = hubs[1];
    expect(enTools.map((t) => t.href).sort()).toEqual(heTools.map((t) => t.href).sort());
  });

  it("has no duplicate links", () => {
    for (const [locale, tools] of hubs) {
      const hrefs = tools.map((t) => t.href);
      expect(new Set(hrefs).size, `${locale} hub repeats a link`).toBe(hrefs.length);
    }
  });
});

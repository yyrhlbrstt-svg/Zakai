import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every "start here" link in the product must land on the camera.
 *
 * WHAT HAPPENED
 *
 * Sixteen places link to `/money#zakai-money-scan`: the homepage hero, the
 * Zakameter's "צלמו חשבונית — התחילו בכסף שלי", the header, the footer, the
 * signup redirect, the empty dashboard, the nudge emails. Every route into
 * this product, in other words.
 *
 * That anchor sat on the *paste* card — a textarea asking for a CSV export
 * from your bank. The screenshot card, which is the only way in that works on
 * a phone, was one card above the fold somebody arrived at, and therefore
 * invisible. A button that says "photograph your bill" delivered a box asking
 * you to paste a spreadsheet, and the founder reported exactly that: "I press
 * photograph-an-invoice and it brings me here."
 *
 * The id moved rather than the sixteen links, so all of them became honest at
 * once and any new one inherits it. This test is what keeps it there — the
 * two cards are adjacent and near-identical in shape, and a refactor that
 * swaps them back would be invisible in review and silent at runtime.
 */

const HUB = "src/components/MoneyHub.tsx";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the way into the product points at the way in", () => {
  const hub = readFileSync(join(process.cwd(), HUB), "utf8");

  it("gives the screenshot card the anchor everything links to", () => {
    const scanIdx = hub.indexOf('id="zakai-money-scan"');
    expect(scanIdx, "no element carries id=zakai-money-scan").toBeGreaterThan(-1);

    // The card's own heading follows its opening tag. The screenshot card is
    // the one that talks about a screenshot; the paste card is the one that
    // talks about pasting. Asserting on the copy rather than on ordering is
    // what makes this survive the cards being reordered for any other reason.
    const after = hub.slice(scanIdx, scanIdx + 400);
    expect(after, "zakai-money-scan is not on the screenshot card").toMatch(/shotTitle/);
    expect(after).not.toMatch(/pasteTitle/);
  });

  it("keeps the paste card reachable under its own name", () => {
    const pasteIdx = hub.indexOf('id="zakai-money-paste"');
    expect(pasteIdx).toBeGreaterThan(-1);
    expect(hub.slice(pasteIdx, pasteIdx + 400)).toMatch(/pasteTitle/);
  });

  it("links to no /money anchor that does not exist on the page", () => {
    // A hash that matches nothing scrolls nowhere and looks, from the outside,
    // exactly like a button that does not work.
    const ids = new Set(
      [...hub.matchAll(/id="(zakai-money-[a-z-]+)"/g)].map((m) => m[1]),
    );
    const dangling: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/\/money#(zakai-money-[a-z-]+)/g)) {
        // `zakai-money-start` is deliberately still honoured by MoneyHub's
        // scroll effect — it shipped once and may sit in a sent nudge email.
        if (m[1] === "zakai-money-start") continue;
        if (!ids.has(m[1])) dangling.push(`${file.replace(process.cwd() + "/", "")} → #${m[1]}`);
      }
    }
    expect(dangling, dangling.join("\n")).toEqual([]);
  });

  it("still honours the anchor it shipped under for one release", () => {
    expect(hub).toContain('"#zakai-money-start"');
  });
});

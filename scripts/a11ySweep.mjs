#!/usr/bin/env node
/**
 * Every page, checked against WCAG 2.1 AA, in a real browser.
 *
 * WHY THIS EXISTS
 *
 * The first time this ran it found 271 violations across 136 routes, and three
 * of them were critical: a blind person reached the institutional contact form
 * and the bank-fee flow and found inputs announced as unnamed edit boxes, with
 * no way to know what any of them wanted. Nothing else in this repository could
 * have caught that — the unit suite was green, every page returned 200, and the
 * route sweep was clean, because none of them ask what a screen reader hears.
 *
 * On a product built to recover money for people without the time or leverage
 * to chase it themselves, locking out the people with the least of both is the
 * wrong failure to leave standing. In Israel it is also a legal duty.
 *
 * It is at zero now, so this is a ratchet at zero rather than a count to work
 * down: a new violation is a new mistake, not inherited debt.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 node scripts/a11ySweep.mjs
 *   node scripts/a11ySweep.mjs --locale en
 */

import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const LOCALE = process.argv.includes("--locale")
  ? process.argv[process.argv.indexOf("--locale") + 1]
  : "he";
const ROUTES_DIR = join("src", "app", "[locale]");
const VIEWPORT = { width: 390, height: 900 };

/** WCAG 2.1 A and AA — the level Israeli regulation points at. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

function routes(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routes(full, acc);
    else if (entry === "page.tsx") {
      const rel = relative(ROUTES_DIR, dir);
      // Dynamic segments need a real id to render; the route sweep covers them.
      if (rel.includes("[")) continue;
      acc.push(rel === "" ? "/" : `/${rel.split(sep).join("/")}`);
    }
  }
  return acc;
}

async function main() {
  const axe = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
  const list = routes(ROUTES_DIR).sort();
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );
  const page = await (await browser.newContext({ viewport: VIEWPORT })).newPage();

  const byRule = new Map();
  let checked = 0;

  for (const route of list) {
    const url = `${BASE}/${LOCALE}${route === "/" ? "" : route}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
      // Client components render after hydration; auditing sooner reports an
      // empty page for every interactive screen in the app.
      await page.waitForTimeout(400);
      await page.evaluate(axe);
      const result = await page.evaluate(
        async (tags) => await window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
        TAGS,
      );
      checked += 1;
      for (const v of result.violations) {
        if (!byRule.has(v.id)) {
          byRule.set(v.id, { impact: v.impact, help: v.help, nodes: 0, where: [] });
        }
        const row = byRule.get(v.id);
        row.nodes += v.nodes.length;
        if (row.where.length < 3) row.where.push(`${route}: ${v.nodes[0]?.html?.slice(0, 90) ?? ""}`);
      }
    } catch (err) {
      console.log(`  ${route}: could not audit — ${String(err).split("\n")[0].slice(0, 90)}`);
    }
  }
  await browser.close();

  console.log(`\nAudited ${checked}/${list.length} routes at ${VIEWPORT.width}px against ${BASE}/${LOCALE}\n`);

  /**
   * A run that reached nothing must never read as a pass. This is the exact
   * shape of the silent no-op the other guards in this repo exist to prevent,
   * and the first version of this script had it: with the server down it
   * printed "0 violations" and exited zero.
   */
  if (checked === 0) {
    console.error("FATAL: no route was reachable — nothing was audited. Is the server running?");
    process.exit(1);
  }

  const total = [...byRule.values()].reduce((s, r) => s + r.nodes, 0);
  if (total === 0) {
    console.log("No WCAG 2.1 AA violations.\n");
    return;
  }

  console.log(`WCAG 2.1 AA violations: ${total} across ${byRule.size} rules\n`);
  for (const [id, r] of [...byRule.entries()].sort((a, b) => b[1].nodes - a[1].nodes)) {
    console.log(`${String(r.nodes).padStart(5)}  [${r.impact}] ${id}`);
    console.log(`       ${r.help}`);
    for (const w of r.where) console.log(`       ${w}`);
  }
  console.log("\nThis is a ratchet at zero. Fix it where it comes from, not at the call site.\n");
  process.exit(1);
}

main();

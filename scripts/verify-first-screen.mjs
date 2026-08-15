#!/usr/bin/env node
/**
 * The first screen of an entry page must offer the thing the page is for.
 *
 * WHY THIS EXISTS
 *
 * `/money` is where this entire product funnels. Measured on an iPhone 13 it
 * opened with fifteen blocks of text, ninety words, and no action of any kind
 * — the first thing on it was a card of our own public counters reading
 * 0 / 0 / 0. The screens above the fold were: a headline naming our internal
 * machinery, a subtitle that was an architecture pipeline, and three zeros.
 * The scan — the one thing a visitor came to do — was two screens down.
 *
 * Nobody shipped that on purpose. It accreted: each addition was individually
 * defensible and each one pushed the action further down, and no screenshot
 * shows you what is *below* it. Which is exactly the kind of decay a machine
 * should be watching for instead of a person noticing it months later.
 *
 * WHAT IT CHECKS
 *
 * On a 390×844 viewport — the smallest phone we design for — for each entry
 * route, after the boot splash has cleared:
 *
 *   1. There is an <h1> at all.
 *   2. At least one enabled control (button or link) is *fully* inside the
 *      first screen — not clipped by the fold, not covered by a fixed banner.
 *   3. That control is inside <main>, so the header's nav toggle and a cookie
 *      bar do not count as "the page offers you something".
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *
 * Word count. A dense first screen can be right — the flight claim's is —
 * and a check that fails on density is a check that gets switched off. The
 * word count is printed for a human to read and never fails the run.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 node scripts/verify-first-screen.mjs
 *   node scripts/verify-first-screen.mjs --locale en --json
 */

import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const args = process.argv.slice(2);
const LOCALE = valueOf("--locale") ?? "he";
const AS_JSON = args.includes("--json");

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/**
 * Entry routes only — the doors somebody arrives through from a search result,
 * a share or the app icon. A page reached mid-flow (a case, the dashboard)
 * legitimately opens with state rather than an offer, and holding those to the
 * same rule would mean loosening the rule until it caught nothing.
 */
const ENTRY_ROUTES = [
  "/",
  "/money",
  "/start",
  "/leaks",
  "/cancel",
  "/check",
  "/flights",
  "/bank-fees",
  "/what-am-i-owed",
  "/pricing",
];

const VIEWPORT = { width: 390, height: 844 };

/** The splash holds ~0.9s and fades over 0.5s; anything measured before that
 *  is measuring the logo, not the page. */
const SPLASH_CLEAR_MS = 2200;

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    undefined,
});
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await context.newPage();

const results = [];

for (const route of ENTRY_ROUTES) {
  const url = `${BASE}/${LOCALE}${route === "/" ? "" : route}`;
  let measured;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    if (!res || res.status() >= 400) {
      results.push({ route, ok: false, problems: [`HTTP ${res ? res.status() : "no response"}`] });
      continue;
    }
    await page.waitForTimeout(SPLASH_CLEAR_MS);
    measured = await page.evaluate((fold) => {
      const main = document.querySelector("main");
      const isDisabled = (el) =>
        el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

      /**
       * Fully above the fold and actually hittable. `elementFromPoint` is the
       * browser's own answer to "would a tap here reach this control" — the
       * only way to see a fixed banner sitting on top of it, which a bounding
       * box cannot.
       */
      const usable = (el) => {
        if (isDisabled(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        if (r.top < 0 || r.bottom > fold) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return Boolean(hit && (hit === el || el.contains(hit) || hit.contains(el)));
      };

      const controls = main
        ? [...main.querySelectorAll("button, a[href], input, select, textarea")].filter(usable)
        : [];

      const h1 = document.querySelector("h1");
      const h1r = h1 ? h1.getBoundingClientRect() : null;

      const textBlocks = main
        ? [...main.querySelectorAll("*")].filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              el.children.length === 0 &&
              (el.textContent || "").trim().length > 0 &&
              r.top < fold &&
              r.bottom > 0
            );
          })
        : [];

      return {
        hasMain: Boolean(main),
        h1Text: h1 ? (h1.textContent || "").trim() : null,
        h1InFirstScreen: Boolean(h1r && h1r.top < fold && h1r.bottom > 0),
        actions: controls.map((el) => (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 60)),
        words: textBlocks.reduce((n, el) => n + el.textContent.trim().split(/\s+/).length, 0),
        blocks: textBlocks.length,
      };
    }, VIEWPORT.height);
  } catch (err) {
    results.push({ route, ok: false, problems: [`load failed: ${err.message}`] });
    continue;
  }

  const problems = [];
  if (!measured.hasMain) problems.push("no <main> element");
  if (!measured.h1Text) problems.push("no <h1> on the page");
  else if (!measured.h1InFirstScreen) problems.push("<h1> is below the fold");
  if (measured.actions.length === 0)
    problems.push("no usable control inside the first screen — the page opens with nothing to do");

  results.push({ route, ok: problems.length === 0, problems, ...measured });
}

await browser.close();

const failed = results.filter((r) => !r.ok);

if (AS_JSON) {
  console.log(JSON.stringify({ base: BASE, locale: LOCALE, results }, null, 2));
} else {
  for (const r of results) {
    const head = r.ok ? "ok  " : "FAIL";
    console.log(
      `${head} ${r.route.padEnd(18)} actions=${(r.actions ?? []).length} words=${r.words ?? "?"} blocks=${r.blocks ?? "?"}`,
    );
    if (r.actions?.length) console.log(`       first action: ${r.actions[0]}`);
    for (const p of r.problems) console.log(`       ✗ ${p}`);
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} entry routes open with something to do.`,
  );
}

process.exit(failed.length === 0 ? 0 : 1);

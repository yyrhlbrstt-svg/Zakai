#!/usr/bin/env node
/**
 * Walk every page and check that the things on it can actually be used.
 *
 * WHY THIS EXISTS, SEPARATELY FROM routeSweep
 *
 * `routeSweep` loads each page and looks at it. That catches a 500, a raw
 * translation key, a spinner that never resolves — everything visible in a
 * still photograph of the screen.
 *
 * It cannot catch the defect that a person actually reports, which is not
 * "the page is broken" but "I got here and then I could not go on". The
 * founder found three of those in one sitting, and every one was invisible to
 * a screenshot:
 *
 *   - The install banner is `position: fixed` at the bottom of the viewport.
 *     On the flight claim it sat directly on top of the route field, the
 *     airline's email address and the button that opens the claim. The page
 *     rendered perfectly. Nothing was missing. You just could not reach it.
 *
 *   - The airline was a free-text box feeding a resolver that only knew Latin
 *     spellings, and the submit button stayed disabled until it resolved. Type
 *     "לופטהנזה" and the button is dead, with nothing on screen saying why.
 *
 *   - Two buttons of near-equal weight, one of them named after our own
 *     machinery, so the next step was a guess.
 *
 * The first two are mechanical, and this finds them. The third is judgement
 * and is only ever reported.
 *
 * WHAT FAILS vs WHAT IS REPORTED
 *
 * Occlusion fails: a control the browser itself says you cannot click is not a
 * design opinion. Everything else — a disabled button, a lonely form — is
 * printed for a human and never fails a build, for the same reason routeSweep
 * refuses to fail on "this screen looks thin": a job that fails on opinions is
 * switched off within a week and then catches nothing at all.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 node scripts/flowSweep.mjs
 *   node scripts/flowSweep.mjs --locale he --json
 *   node scripts/flowSweep.mjs --only /flights,/money
 *   node scripts/flowSweep.mjs --auth ./auth.json      # signed-in pass
 */

import { chromium, devices } from "playwright";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const args = process.argv.slice(2);
const LOCALE = valueOf("--locale") ?? "he";
const AS_JSON = args.includes("--json");
const ONLY = valueOf("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
/**
 * A saved signed-in session.
 *
 * Half this product is behind a login — the dashboard, the case, the ledger,
 * every screen where somebody is actually recovering money. A sweep that only
 * ever sees the logged-out site checks the brochure and calls it the product.
 */
const STORAGE_STATE = valueOf("--auth");

/**
 * Long enough for the timed overlays to appear. The install banner waits
 * 2.5s on most pages; a sweep that settles at 2s would have passed every day
 * while the banner sat on the claim form of the page it was checking.
 */
const SETTLE_MS = 3600;

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function routes() {
  const root = join(process.cwd(), "src", "app", "[locale]");
  const found = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[") || entry.name.startsWith("(") || entry.name.startsWith("_")) {
          continue;
        }
        walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        found.push(prefix === "" ? "/" : prefix);
      }
    }
  };
  walk(root, "");
  return found.sort();
}

/**
 * Ask the browser who is actually at each control's coordinates.
 *
 * `elementFromPoint` is the honest test — it is the same hit-testing the
 * browser does when a finger lands there, so it accounts for stacking order,
 * transforms and pointer-events without this script having to model any of it.
 * A control is reachable if the element at its centre is itself, an ancestor
 * of it, or something inside it (the label text on a button).
 */
const PROBE = () => {
  const SELECTOR = 'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"]';
  const out = { occluded: [], disabled: [], small: [], controls: 0 };
  /**
   * WCAG 2.2's Target Size (Minimum). Reported, not failed: an inline link
   * inside a sentence is explicitly exempt from that rule, and this probe
   * cannot tell one of those from a genuinely cramped button.
   */
  const MIN_TARGET = 24;

  /**
   * The largest of an element's line boxes, not its bounding box.
   *
   * A link inside `flex-wrap` that breaks across two lines has a bounding
   * rectangle spanning both of them, and the centre of that rectangle lands in
   * the gap between the lines — where the parent container is painted and the
   * link is not. The first version of this probe reported forty-odd footer
   * links as "covered by ul.flex.flex-wrap", which is not a bug in the footer,
   * it is a bug in asking a rectangle to describe a shape that is not one.
   */
  const visible = (el) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
      return null;
    }
    /**
     * Inside a collapsed accordion, and therefore not on screen at all.
     *
     * Chrome renders a closed `<details>` with `content-visibility: hidden`,
     * which skips painting but still hands out geometry: the fields inside a
     * folded card report a fifty-pixel rectangle somewhere near the top of the
     * viewport. The second version of this probe took that at face value and
     * declared a hundred invisible inputs on /warranty and /telecom-exit to be
     * "covered by the footer" — the footer being simply whatever was actually
     * painted at those phantom coordinates.
     */
    if (el.closest("details:not([open])")) return null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cv = getComputedStyle(a).contentVisibility;
      if (cv === "hidden") return null;
    }
    let best = null;
    for (const r of el.getClientRects()) {
      if (r.width < 8 || r.height < 8) continue;
      if (!best || r.width * r.height > best.width * best.height) best = r;
    }
    return best;
  };

  const describe = (el) => {
    if (!el) return "nothing";
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };

  const label = (el) =>
    (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.name || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 48) || describe(el);

  for (const el of document.querySelectorAll(SELECTOR)) {
    const rect = visible(el);
    if (!rect) continue;
    out.controls++;

    if (el.disabled) {
      out.disabled.push(label(el));
      continue;
    }

    // Buttons only: a link inside running text is exempt from the rule and
    // reporting it would bury the real ones.
    if (
      (el.tagName === "BUTTON" || el.getAttribute("role") === "button") &&
      (rect.width < MIN_TARGET || rect.height < MIN_TARGET)
    ) {
      out.small.push(`${label(el)} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
    }

    /**
     * Only judge a control that is entirely on screen.
     *
     * A first version accepted anything whose centre was in the viewport, and
     * immediately reported the login page's "forgot password?" link as covered
     * by the sticky header — it was 99% scrolled off the top, and the sliver
     * left over happened to sit under the header. That is not a person unable
     * to press something, it is a person who has scrolled past it. Content
     * passing under a sticky header on the way out is what a sticky header is.
     *
     * The defect worth reporting is the other one: a control the reader is
     * looking straight at, fully visible, that does not respond.
     */
    if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
    if (rect.left < 0 || rect.right > window.innerWidth) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const hit = document.elementFromPoint(cx, cy);
    if (!hit) continue;
    if (hit === el || el.contains(hit) || hit.contains(el)) continue;

    // Name the covering layer, not the leaf text node inside it — "the install
    // banner" is actionable, "a div" is not.
    let blocker = hit;
    let layer = "flow";
    while (blocker && blocker !== document.body) {
      const pos = getComputedStyle(blocker).position;
      if (pos === "fixed" || pos === "sticky") {
        layer = pos;
        break;
      }
      blocker = blocker.parentElement;
    }
    /**
     * Sticky chrome is not an occlusion.
     *
     * A sticky header exists so that content scrolls under it. Reporting that
     * is reporting the feature. Every one of the twenty-one hits the first
     * version produced was a control that had simply scrolled up beneath the
     * header, at a scroll offset this script had chosen arbitrarily — the
     * reader moves a finger and it is back. A `fixed` layer is different: it
     * does not move, it was not summoned, and the reader has no way to get it
     * off the button except to find the dismiss cross.
     */
    if (layer === "sticky") continue;
    out.occluded.push({
      control: label(el),
      by: describe(blocker && blocker !== document.body ? blocker : hit),
      layer,
    });
  }
  return out;
};

async function sweep(page, route) {
  const url = `${BASE}/${LOCALE}${route === "/" ? "" : route}`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  let status = 0;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    status = res?.status() ?? 0;
  } catch (e) {
    return { route, status: 0, fatal: `did not load: ${String(e).slice(0, 100)}` };
  }
  await page.waitForTimeout(SETTLE_MS);

  const top = await page.evaluate(PROBE);
  // Scroll to the bottom too: a fixed banner covers whatever happens to be
  // under it, and what is under it changes as the page moves.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const bottom = await page.evaluate(PROBE);

  const seen = new Set();
  const occluded = [...top.occluded, ...bottom.occluded].filter((o) => {
    const key = `${o.control}|${o.by}|${o.layer}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  /**
   * A page with nothing on it to press is not a passing page.
   *
   * This check exists because the sweep briefly reported "ok, 0 controls" for
   * nine routes in a row and looked like a clean run. The server was serving
   * chunks from a previous build and every page had died with a
   * ChunkLoadError, so the probe examined nothing and found nothing wrong with
   * it. Silence and success are not the same result, and a check that cannot
   * tell them apart is worse than no check — it is a green light nobody
   * inspected.
   */
  const controls = Math.max(top.controls, bottom.controls);
  if (controls === 0) {
    return {
      route,
      status,
      controls: 0,
      fatal:
        "no interactive elements at all — the page did not render (check the " +
        "console for a client-side exception, and that the server is serving " +
        "the build you think it is)",
    };
  }

  return {
    route,
    status,
    controls,
    occluded,
    disabled: [...new Set([...top.disabled, ...bottom.disabled])],
    small: [...new Set([...top.small, ...bottom.small])],
    errors,
  };
}

async function main() {
  const list = (ONLY ?? routes()).filter(Boolean);
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    locale: `${LOCALE}-IL`,
    ...(STORAGE_STATE ? { storageState: STORAGE_STATE } : {}),
  });
  const page = await ctx.newPage();

  const results = [];
  for (const route of list) {
    const r = await sweep(page, route);
    results.push(r);
    if (!AS_JSON) {
      const bad = r.fatal || r.occluded?.length;
      const mark = r.fatal ? "FAIL" : r.occluded?.length ? "FAIL" : "ok  ";
      console.log(
        `${mark} ${route.padEnd(30)} ${String(r.status).padStart(3)}  ` +
          `${r.controls ?? 0} controls` +
          (r.disabled?.length ? `, ${r.disabled.length} disabled` : ""),
      );
      if (r.fatal) console.log(`       ${r.fatal}`);
      for (const o of r.occluded ?? []) {
        console.log(`       unreachable: "${o.control}" is covered by ${o.by} [${o.layer}]`);
      }
      if (bad === undefined) console.log("");
    }
  }
  await browser.close();

  if (AS_JSON) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const failed = results.filter((r) => r.fatal || r.occluded?.length);
    const withDisabled = results.filter((r) => r.disabled?.length);
    const withSmall = results.filter((r) => r.small?.length);
    console.log(`\n${results.length} routes, ${failed.length} with an unreachable control.`);
    if (withDisabled.length) {
      console.log(`\nDisabled controls (reported, never a failure — a form that has not been`);
      console.log(`filled in yet is supposed to have one):`);
      for (const r of withDisabled) {
        console.log(`  ${r.route}: ${r.disabled.join(" · ")}`);
      }
    }
    if (withSmall.length) {
      console.log(`\nButtons under 24x24 (WCAG 2.2 target size, reported only):`);
      for (const r of withSmall) console.log(`  ${r.route}: ${r.small.join(" · ")}`);
    }
    if (failed.length) process.exitCode = 1;
  }
}

await main();

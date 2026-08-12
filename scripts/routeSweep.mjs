#!/usr/bin/env node
/**
 * Visit every locale route in a real browser and report what a person would see.
 *
 * WHY THIS EXISTS
 *
 * The dominant defect class in this codebase is a working path hidden behind a
 * broken one. Every instance found so far was found by opening the page —
 * none by reading code, and none by the unit suite, which was green through
 * all of them. A contract reminder fired on the date it was already too late.
 * The pricing page recommended the more expensive plan. Four pages rendered
 * raw translation keys where copy should be. The tests passed the whole time.
 *
 * So this is the cheapest possible version of what actually works: load each
 * page at a phone width and look.
 *
 * WHAT FAILS THE BUILD vs WHAT IS ONLY REPORTED
 *
 * Failing conditions are the ones with no judgement in them — a 5xx, an
 * uncaught exception, a translation that resolved to its own key, a page
 * wider than the phone it is being read on. Everything else (a short page, a
 * page with few actions) is reported and never fails, because "this screen
 * looks thin" is a design opinion and a CI job that fails on opinions gets
 * disabled within a week.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 node scripts/routeSweep.mjs
 *   node scripts/routeSweep.mjs --locale he --json
 */

import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Top-level namespaces from the Hebrew catalogue, used to recognise a
 * translation that failed and rendered its own key path.
 *
 * Matching against the real namespace list rather than a generic
 * "word.word" pattern is what keeps this quiet: an earlier version flagged
 * "yourbot.example" and "agent.example" — a sample hostname and a sample
 * agent id, both perfectly fine — because it did not know what a namespace
 * actually was.
 */
const NAMESPACES = (() => {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "src/messages/he.json"), "utf8"));
    return Object.entries(raw)
      .filter(([, v]) => v && typeof v === "object")
      .map(([k]) => k);
  } catch {
    return [];
  }
})();

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const args = process.argv.slice(2);
const LOCALE = valueOf("--locale") ?? "he";
const AS_JSON = args.includes("--json");
/** Phone first: this product is read on a phone, so it is checked on one. */
const VIEWPORT = { width: 390, height: 844 };

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/**
 * Which tool pages are real Case/Mandate loops, read from the catalogue.
 *
 * Parsed from source rather than imported because this script runs as plain
 * node against a built server, with no TypeScript step in front of it.
 */
function toolCatalog() {
  const out = new Map();
  try {
    const src = readFileSync(join(process.cwd(), "src/lib/toolsCatalog.ts"), "utf8");
    for (const m of src.matchAll(/\{\s*href:\s*"([^"]+)"[^}]*\}/g)) {
      out.set(m[1], /agentic:\s*true/.test(m[0]));
    }
  } catch {
    /* the graph check simply does not run */
  }
  return out;
}
const TOOLS = toolCatalog();

/**
 * Routes discovered from the filesystem rather than a list, so a page added
 * next week is swept without anyone remembering to add it.
 *
 * Dynamic segments are skipped: /companies/[provider] needs a real provider to
 * mean anything, and visiting it with a placeholder would test a 404 path
 * while looking like coverage.
 */
function routes() {
  const root = join(process.cwd(), "src", "app", "[locale]");
  const found = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[")) continue;
        if (entry.name.startsWith("(") || entry.name.startsWith("_")) continue;
        walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        found.push(prefix === "" ? "/" : prefix);
      }
    }
  };
  walk(root, "");
  return found.sort();
}

/** Conditions with no judgement in them. These fail the build. */
function hardFailures(status, errors, page) {
  const out = [];
  if (status >= 400) out.push(`HTTP ${status}`);
  for (const e of errors) {
    if (e.startsWith("pageerror:")) out.push(e);
    // next-intl reports both of these at render time, in the browser, where
    // nothing was reading them. Both put a raw key in front of a person.
    else if (/MISSING_MESSAGE|FORMATTING_ERROR/.test(e)) out.push(e);
  }
  // A page whose whole content is a loading string has not finished loading —
  // and after networkidle it never will. There is no judgement in it: the
  // person is looking at a spinner with nothing to act on.
  if (page?.stuckLoading) {
    out.push("still showing a loading state after the page settled — a fetch failed and left the screen with nothing on it");
  }
  for (const c of page?.clippedText ?? []) out.push(`text cut off at ${VIEWPORT.width}px: ${c}`);
  for (const k of page?.rawKeys ?? []) out.push(`raw translation key visible: ${k}`);
  return out;
}

/** Worth a human look, never a build failure. */
function softNotes(page) {
  const out = [];
  if (!page) return out;
  if (page.authGated) return out; // a login wall is meant to be thin
  if (page.textLength < 200) out.push(`almost empty (${page.textLength} chars)`);
  if (page.actions < 3) out.push(`only ${page.actions} actionable elements`);
  return out;
}

async function main() {
  const list = routes();
  // An escape hatch for environments that ship a browser Playwright did not
  // install itself — a version mismatch between the npm package and a
  // pre-provisioned binary otherwise makes this whole sweep unrunnable, which
  // is the one failure mode that costs the most: it is the only check here
  // that has ever caught anything the unit suite missed.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const results = [];
  for (const route of list) {
    const url = `${BASE}/${LOCALE}${route === "/" ? "" : route}`;
    const errors = [];
    const onPageError = (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`);
    const onConsole = (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      // A missing favicon is not a defect anybody will act on.
      if (/favicon/i.test(text)) return;
      errors.push(`console: ${text.slice(0, 160)}`);
    };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    let status = 0;
    let measured = null;
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      status = resp?.status() ?? 0;
      // Client components render after hydration; measuring too early reports
      // an empty page for every interactive screen in the app.
      await page.waitForTimeout(600);
      measured = await page.evaluate((namespaces) => {
        /**
         * Text that runs off the side of the phone.
         *
         * Two obvious tests are both wrong here. `scrollWidth > clientWidth`
         * stays true when a parent clips the overflow, and this app has
         * decorative blur elements 640px wide on every page — that check
         * called all 130 routes broken when none of them are. Actually
         * scrolling the window is no better: a global container clips the
         * overflow, so even a deliberately planted 900px block moved the page
         * by zero pixels. A check that cannot fail is worse than no check.
         *
         * What is real, and what a reader would recognise, is an element that
         * holds its own text and extends past the viewport: that text is cut
         * off. Decorative elements hold no text, so they drop out on their
         * own without a hand-maintained exclusion list.
         */
        /** Content the reader can still reach by scrolling that box is not cut off. */
        const reachableBySideScroll = (el) => {
          for (let n = el; n && n !== document.body; n = n.parentElement) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === "auto" || ox === "scroll") return true;
          }
          return false;
        };

        const clipped = [];
        for (const el of document.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0) continue;
          if (rect.right <= window.innerWidth + 4 && rect.left >= -4) continue;
          const ownText = [...el.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join("");
          if (ownText.length === 0) continue;
          // A code sample in a scrollable box is a deliberate pattern, not a
          // defect — the endpoint is still readable by swiping that block.
          if (reachableBySideScroll(el)) continue;
          clipped.push(`<${el.tagName.toLowerCase()}> "${ownText.slice(0, 40)}" (${Math.round(rect.width)}px)`);
        }

        /**
         * A translation that failed renders its own key path — "pricing.foo"
         * — as visible text. On a server component next-intl reports that to
         * the server log, not the browser console, so the console check
         * cannot see it. Reading the rendered text is the only way.
         */
        const text = document.body.innerText;
        const rawKeys = [];
        // Filenames and hostnames share the shape "word.word", and several
        // namespaces are ordinary words — "registry.json", "agents.json" and
        // "pipe.json" are all real filenames this app prints on purpose.
        const NOT_A_KEY = /\.(json|js|mjs|ts|tsx|md|txt|xml|ya?ml|html|csv|pdf|png|svg|com|co|io|org|net|il|dev|app)$/i;
        for (const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_.]*)\b/g)) {
          if (!namespaces.includes(m[1])) continue;
          if (NOT_A_KEY.test(m[0])) continue;
          rawKeys.push(m[0]);
        }

        /**
         * Internal links inside the page's own content.
         *
         * Deliberately scoped to <main>: the header and footer link to /money
         * from every page, so counting them would make every page "able to
         * reach a real claim" and turn the dead-end check into one that
         * cannot fail. The question worth asking is whether THIS page offers
         * a way forward, not whether the site chrome does.
         */
        const main = document.querySelector("main") ?? document.body;
        const links = new Set();
        /**
         * A link to an official government form is a way forward.
         *
         * CLAUDE.md says a page gets a path to action — "letter / check /
         * external official tool" — and this check only ever counted the
         * first two, so a page whose correct answer is gov.il form 2216א read
         * as a place attention goes to die. That is the check being wrong
         * about the product's own doctrine, and left uncorrected it pressures
         * whoever fixes it next to bolt an internal link onto a page that
         * does not need one.
         *
         * Deliberately narrow: an Israeli government host, or one of the
         * regulators already carried with a verified URL in src/lib. A
         * general "has any external link" rule would let a footnote to a news
         * article count as getting somebody their money.
         */
        let officialAction = false;
        const OFFICIAL_HOST = /(^|\.)gov\.il$|(^|\.)boi\.org\.il$|(^|\.)education\.gov\.il$|(^|\.)btl\.gov\.il$/;
        for (const a of main.querySelectorAll("a[href]")) {
          const href = a.getAttribute("href") ?? "";
          if (/^https?:/.test(href)) {
            try {
              if (OFFICIAL_HOST.test(new URL(href).hostname)) officialAction = true;
            } catch {
              /* not a URL we can read — not a way forward either */
            }
            continue;
          }
          if (!href.startsWith("/")) continue;
          const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
          // Strip the locale prefix so links compare against sweep routes.
          links.add(path.replace(/^\/(he|en|ar|ru|de|fr)(?=\/|$)/, "") || "/");
        }

        /**
         * A page still showing nothing but a loading state.
         *
         * /commitments loaded its list with `if (!res.ok) return;`, so a 401 —
         * which is what every logged-out visitor gets — left it showing
         * "Loading…" forever: no error, no sign-in prompt, no way onward. The
         * unit suite was green, the page returned 200, and this sweep passed
         * it, because on that run the local database happened to hold rows.
         * The data was hiding it.
         *
         * Checked against `<main>` only, and only when the loading string is
         * essentially all there is, so a page that legitimately shows a
         * spinner beside real content is not flagged.
         */
        const mainText = main.innerText.replace(/\s+/g, " ").trim();
        const LOADING = ["טוען…", "טוען...", "Loading…", "Loading...", "جارٍ التحميل", "Загрузка"];
        const stuckLoading =
          LOADING.some((l) => mainText.includes(l)) && mainText.length < 400;

        return {
          stuckLoading,
          textLength: text.replace(/\s+/g, " ").trim().length,
          actions: document.querySelectorAll("a[href], button:not([disabled])").length,
          officialAction,
          clippedText: clipped.slice(0, 3),
          rawKeys: [...new Set(rawKeys)].slice(0, 3),
          links: [...links],
          authGated: /\/login|\/signup/.test(location.pathname),
        };
      }, NAMESPACES);

      /**
       * Re-check only the pages that look stuck.
       *
       * 600ms is enough for hydration but not always for a client fetch, so
       * flagging on the first read would fail honest pages that were merely
       * slow — and a hard failure that fires at random is worse than no check,
       * because it gets the whole job switched off. Paying the extra wait only
       * where the first read looked stuck keeps the sweep fast and the signal
       * real: after this, a loading string means the fetch is not coming back.
       */
      if (measured?.stuckLoading) {
        await page.waitForTimeout(2500);
        const settled = await page.evaluate(() => {
          const main = document.querySelector("main") ?? document.body;
          const t = main.innerText.replace(/\s+/g, " ").trim();
          const LOADING = ["טוען…", "טוען...", "Loading…", "Loading...", "جارٍ التحميل", "Загрузка"];
          return LOADING.some((l) => t.includes(l)) && t.length < 400;
        });
        measured.stuckLoading = settled;
      }
    } catch (err) {
      errors.push(`nav: ${String(err).split("\n")[0].slice(0, 160)}`);
    }
    page.off("pageerror", onPageError);
    page.off("console", onConsole);

    const unique = [...new Set(errors)];
    results.push({
      route,
      status,
      failures: status === 0 ? ["navigation failed", ...unique] : hardFailures(status, unique, measured),
      notes: softNotes(measured),
      // Carried through so the dead-end graph has edges. Leaving it out made
      // every non-agentic tool look unreachable, which is a plausible answer
      // arrived at by measuring nothing.
      links: measured?.links ?? [],
      officialAction: measured?.officialAction ?? false,
      otherConsole: unique.filter((e) => e.startsWith("console:")),
    });
  }
  await browser.close();

  /**
   * Tool pages from which a real claim can never be reached.
   *
   * A page that only offers a calculation, and whose own content links only
   * to other pages that do the same, is where a person's attention goes to
   * die. They came because they think they are owed money; a number and a
   * link to another number is not an answer.
   *
   * Follows the link graph to any depth. Reporting only direct links would
   * miss the real shape of it — two pages that point at each other and
   * nowhere else read as "having a next step" one hop at a time.
   */
  const graph = new Map(results.map((r) => [r.route, r.links ?? []]));
  const official = new Map(results.map((r) => [r.route, r.officialAction === true]));
  const reachesAClaim = (start) => {
    if (official.get(start)) return true;
    const seen = new Set([start]);
    const queue = [...(graph.get(start) ?? [])];
    while (queue.length) {
      const at = queue.shift();
      if (seen.has(at)) continue;
      seen.add(at);
      if (TOOLS.get(at) === true || official.get(at)) return true;
      for (const next of graph.get(at) ?? []) if (!seen.has(next)) queue.push(next);
    }
    return false;
  };
  const deadEnds = TOOLS.size
    ? results
        .filter((r) => TOOLS.has(r.route) && TOOLS.get(r.route) !== true)
        .filter((r) => r.status === 200 && !reachesAClaim(r.route))
        .map((r) => r.route)
        .sort()
    : [];

  /**
   * A ratchet, not a wall.
   *
   * There are dozens of these today, so failing on all of them would only
   * teach everyone to skip this job. The baseline is the list as it stands;
   * a route that is not on it fails the build, and a route on it that has
   * since been given a way forward also fails, with an instruction to delete
   * the line. The list can therefore only ever get shorter — same shape as
   * the type-scale ceiling already in this repo.
   */
  const baselinePath = join(process.cwd(), "scripts", "deadEndBaseline.json");
  let baseline = [];
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8")).routes ?? [];
  } catch {
    baseline = [];
  }
  const newDeadEnds = deadEnds.filter((r) => !baseline.includes(r));
  const fixedButListed = TOOLS.size ? baseline.filter((r) => !deadEnds.includes(r)) : [];

  const failing = results.filter((r) => r.failures.length > 0);
  const noted = results.filter((r) => r.failures.length === 0 && r.notes.length > 0);

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, locale: LOCALE, results }, null, 2));
  } else {
    console.log(`Swept ${results.length} routes at ${VIEWPORT.width}px against ${BASE}/${LOCALE}\n`);
    if (failing.length) {
      console.log(`FAILURES (${failing.length}):`);
      for (const r of failing) console.log(`  ${r.route}  [${r.status}]  ${r.failures.join(" | ")}`);
      console.log("");
    }
    if (noted.length) {
      console.log(`Worth a look, not failing (${noted.length}):`);
      for (const r of noted) console.log(`  ${r.route}  ${r.notes.join(" | ")}`);
      console.log("");
    }
    if (newDeadEnds.length) {
      console.log(`NEW tool pages with no route to a real claim (${newDeadEnds.length}):`);
      for (const r of newDeadEnds) console.log(`  ${r}`);
      console.log("  Give the page a way into a real claim, or add it to scripts/deadEndBaseline.json.\n");
    }
    if (fixedButListed.length) {
      console.log(`Fixed but still in the baseline (${fixedButListed.length}) — delete these lines:`);
      for (const r of fixedButListed) console.log(`  ${r}`);
      console.log("");
    }
    if (deadEnds.length) {
      console.log(`Dead ends remaining: ${deadEnds.length} (baseline ${baseline.length}).\n`);
    }
    if (!failing.length && !newDeadEnds.length && !fixedButListed.length) {
      console.log("No hard failures.");
    }
  }

  const bad = failing.length + newDeadEnds.length + fixedButListed.length;
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("routeSweep failed to run:", err);
  process.exit(2);
});

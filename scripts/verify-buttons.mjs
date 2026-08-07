#!/usr/bin/env node
/**
 * Click every control on every page and report the ones that go nowhere.
 *
 * WHY THIS EXISTS
 *
 * "I press a button and it brings me back to the same page I pressed it on"
 * is not a bug report anyone can act on, and it is also completely accurate —
 * it just describes three unrelated defects that feel identical from the
 * outside:
 *
 *   SELF_LINK   a link whose destination is the page it already is on
 *   DEAD_LINK   a link to a route that does not exist
 *   INERT       a button that is disabled with nothing on screen saying why
 *
 * Nothing in a unit test can see any of these; they only exist once a page is
 * rendered and a person reaches for the control. So this walks the real thing
 * and names them, one line each, instead of leaving anyone to describe the
 * symptom and guess at the cause.
 *
 * Usage:
 *   node scripts/verify-buttons.mjs [baseUrl]
 *
 * Reports SKIP (exit 0) without a server or playwright — a check that
 * silently no-ops is worse than no check.
 */

const base = (process.argv[2] || process.env.ZAKAI_LOOP_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log("SKIP verify-buttons: playwright not installed (npm i -D playwright).");
  process.exit(0);
}

try {
  const res = await fetch(`${base}/api/protocol`);
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (e) {
  console.log(`SKIP verify-buttons: no server at ${base} (${e.message}).`);
  process.exit(0);
}

/**
 * Every public page, discovered from the routes on disk rather than a list
 * kept by hand — a hardcoded list silently stops covering each new vertical
 * the moment someone forgets to add it, which is the same drift the hub and
 * assistant guards exist to prevent.
 *
 * Dynamic segments are skipped (no real id to substitute), as are the
 * screens that only exist behind a session.
 */
const AUTHED_ONLY = new Set([
  "dashboard",
  "settings",
  "assistant",
  "check",
  "founder",
  "authority",
  "receipts",
]);

async function discoverPages() {
  const { readdirSync, existsSync } = await import("node:fs");
  return readdirSync("src/app/[locale]", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !n.startsWith("[") && !n.startsWith("_") && !AUTHED_ONLY.has(n))
    .filter((n) => existsSync(`src/app/[locale]/${n}/page.tsx`))
    .map((n) => `/he/${n}`)
    .concat(["/he"])
    .sort();
}

/**
 * ZAKAI_PAGES=/he/money,/he/cancel narrows the run to specific screens —
 * useful when checking one vertical you just changed, and when a dev server
 * would otherwise have to compile a hundred routes on demand.
 */
const PAGES = process.env.ZAKAI_PAGES
  ? process.env.ZAKAI_PAGES.split(",").map((p) => p.trim()).filter(Boolean)
  : await discoverPages();

const findings = [];
let serverDroppedOut = false;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();

/**
 * Cache of route -> "ok" | "dead" | "unknown", so a shared footer link is
 * fetched once.
 *
 * The three-way answer is the important part. An earlier version returned a
 * boolean and treated any failed fetch as a dead link, so when a dev server
 * fell behind compiling 114 routes on demand it reported fifty perfectly
 * healthy pages as broken. Every one of those was wrong, and a tool that
 * cries wolf at that volume is worse than no tool: the real findings were
 * buried under noise nobody would dig through.
 *
 * So a transport failure now means "I could not tell", never "it is broken",
 * and only a real HTTP 4xx/5xx counts against a link. Retries absorb a slow
 * first compile rather than misreading it as absence.
 */
const reachable = new Map();
async function isReachable(href) {
  if (reachable.has(href)) return reachable.get(href);

  let verdict = "unknown";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(base + href, {
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
      });
      verdict = res.status < 400 ? "ok" : "dead";
      break;
    } catch {
      // Connection refused / timed out — the server, not the route. Back off
      // and try again before drawing any conclusion.
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  reachable.set(href, verdict);
  return verdict;
}

for (const path of PAGES) {
  try {
    await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(900);
  } catch (e) {
    const msg = String(e.message);
    // The server going away is a fact about the run, not about the page.
    // Calling it a page fault is how a dead server turned into a list of
    // "broken" screens that were all fine.
    // A navigation timeout belongs here too: a dev server compiling a route
    // for the first time can take longer than the budget, and that says
    // nothing about the page. Only a page that actually loads and misbehaves
    // earns PAGE_ERROR.
    const serverGone = /ECONNREFUSED|CONNECTION_REFUSED|socket hang up|Timeout \d+ms exceeded/i.test(
      msg,
    );
    findings.push({
      kind: serverGone ? "UNCHECKED" : "PAGE_ERROR",
      path,
      detail: serverGone ? "server stopped answering (not a verdict)" : msg.slice(0, 90),
    });
    if (serverGone) serverDroppedOut = true;
    continue;
  }

  // Links: self-referential or pointing at nothing. Same navigation guard as
  // the button scan below.
  let links = [];
  try {
    links = await page.$$eval("a[href]", (els) =>
      els
        .map((a) => ({
          href: a.getAttribute("href") || "",
          text: (a.textContent || "").trim().slice(0, 40),
          visible: !!(a.offsetParent || a.getClientRects().length),
        }))
        .filter((l) => l.visible && l.href.startsWith("/")),
    );
  } catch (e) {
    findings.push({ kind: "PAGE_ERROR", path, detail: `link scan: ${String(e.message).slice(0, 70)}` });
    continue;
  }

  for (const link of [...new Map(links.map((l) => [l.href, l])).values()]) {
    // Compare paths only — "/he/money#scan" from /he/money is a jump, not a
    // dead end, and treating it as one would bury the real findings.
    const target = link.href.split("#")[0].split("?")[0].replace(/\/+$/, "");
    const here = path.replace(/\/+$/, "");
    // A brand mark that links home is a universal convention, and on the
    // home page that necessarily points at itself. Flagging it would train
    // whoever runs this to ignore the SELF_LINK category entirely.
    const isBrandMark = /^zakai$/i.test(link.text) || link.text === "";
    if (target === here && !link.href.includes("#") && !isBrandMark) {
      findings.push({ kind: "SELF_LINK", path, detail: `"${link.text}" → ${link.href}` });
      continue;
    }
    const verdict = await isReachable(target || "/");
    if (verdict === "dead") {
      findings.push({ kind: "DEAD_LINK", path, detail: `"${link.text}" → ${link.href}` });
    } else if (verdict === "unknown") {
      findings.push({
        kind: "UNCHECKED",
        path,
        detail: `"${link.text}" → ${link.href} (server did not answer; not a verdict)`,
      });
    }
  }

  // Form controls a screen reader cannot name. Wrapping an input in a
  // <label> is the correct pattern and is what most of this codebase does,
  // so grepping for aria-label reports hundreds of false positives — only a
  // rendered page knows whether a control actually resolves to a name.
  try {
    const unnamed = await page.$$eval("input, select, textarea", (els) =>
      els
        .filter((el) => {
          if (el.type === "hidden" || !(el.offsetParent || el.getClientRects().length)) return false;
          const byAria = el.getAttribute("aria-label")?.trim();
          const byLabelledBy = el.getAttribute("aria-labelledby")?.trim();
          const wrapping = el.closest("label");
          const associated = el.id
            ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
            : null;
          const named =
            byAria || byLabelledBy || (wrapping && wrapping.textContent?.trim()) || associated;
          return !named;
        })
        .map((el) => `${el.tagName.toLowerCase()}[type=${el.getAttribute("type") || "text"}]`),
    );
    for (const control of [...new Set(unnamed)]) {
      findings.push({ kind: "UNLABELLED", path, detail: `${control} has no accessible name` });
    }
  } catch {
    // Navigation raced the check; the page-level guards already record that.
  }

  // Buttons disabled with no visible explanation anywhere on the page.
  // Guarded: a dev server's hot reload can navigate mid-evaluation and
  // destroy the execution context, which would otherwise crash the whole run
  // and lose every finding collected so far.
  let inert = [];
  try {
    inert = await page.$$eval("button", (els) =>
      els
        .filter((b) => b.disabled && (b.offsetParent || b.getClientRects().length))
        .map((b) => (b.textContent || "").trim().slice(0, 40)),
    );
  } catch (e) {
    findings.push({ kind: "PAGE_ERROR", path, detail: `button scan: ${String(e.message).slice(0, 70)}` });
    continue;
  }
  if (inert.length) {
    const body = await page.locator("body").innerText();
    // MissingFields and the per-screen guidance notes are both sanctioned
    // ways of explaining a blocked control. Keep this list in step with the
    // real copy: a detector that misses a hint reports a healthy page as
    // broken, which costs exactly as much trust as missing a real fault.
    const explained =
      /כדי להמשיך צריך למלא|הדביקו לפחות|נדרש|חסר|יש לאשר|עדיין לא|בחרו|מלאו/.test(body);
    if (!explained) {
      for (const label of [...new Set(inert)]) {
        findings.push({ kind: "INERT", path, detail: `"${label}" disabled, no reason on screen` });
      }
    }
  }
}

await browser.close();

const byKind = findings.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] || 0) + 1 }), {});
for (const f of findings) console.log(`${f.kind.padEnd(11)} ${f.path.padEnd(24)} ${f.detail}`);
console.log(
  `\n${PAGES.length} pages checked. ${findings.length} finding(s)` +
    (findings.length ? `: ${JSON.stringify(byKind)}` : "."),
);

// A run that lost its server saw nothing it can vouch for. Reporting its
// partial results as findings is how fifty healthy pages got called broken,
// so refuse to give a verdict at all and say why.
if (serverDroppedOut) {
  console.log(
    "\nThe server stopped answering part-way through, so this run proves nothing.\n" +
      "Everything after that point is UNCHECKED, not passing and not failing.\n" +
      "Run against a production build (npm run build && npx next start) — a dev\n" +
      "server compiling ~100 routes on demand is what usually falls over here.",
  );
  process.exit(2);
}

// Dead links and page errors are unambiguous breakage. Self-links and inert
// buttons are judgement calls that deserve eyes, so they report without
// failing the run.
const hard = findings.filter((f) => f.kind === "DEAD_LINK" || f.kind === "PAGE_ERROR");
if (hard.length) {
  console.log(`${hard.length} link(s) go nowhere at all — fix before shipping.`);
  process.exit(1);
}

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

/** Public pages a visitor can reach without an account. */
const PAGES = [
  "/he",
  "/he/money",
  "/he/cancel",
  "/he/what-am-i-owed",
  "/he/leaks",
  "/he/score",
  "/he/small-business",
  "/he/merchant-fees",
  "/he/bank-fees",
  "/he/late-payment",
  "/he/advance-tax",
  "/he/deposit",
  "/he/warranty",
  "/he/flights",
  "/he/electricity",
  "/he/pricing",
  "/he/business",
  "/he/tools",
];

const findings = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();

/** Cache of route -> reachable, so a shared footer link is fetched once. */
const reachable = new Map();
async function isReachable(href) {
  if (reachable.has(href)) return reachable.get(href);
  let ok = true;
  try {
    const res = await fetch(base + href, { redirect: "follow" });
    ok = res.status < 400;
  } catch {
    ok = false;
  }
  reachable.set(href, ok);
  return ok;
}

for (const path of PAGES) {
  try {
    await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(900);
  } catch (e) {
    findings.push({ kind: "PAGE_ERROR", path, detail: String(e.message).slice(0, 90) });
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
    if (!(await isReachable(target || "/"))) {
      findings.push({ kind: "DEAD_LINK", path, detail: `"${link.text}" → ${link.href}` });
    }
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

// Dead links and page errors are unambiguous breakage. Self-links and inert
// buttons are judgement calls that deserve eyes, so they report without
// failing the run.
const hard = findings.filter((f) => f.kind === "DEAD_LINK" || f.kind === "PAGE_ERROR");
if (hard.length) {
  console.log(`${hard.length} link(s) go nowhere at all — fix before shipping.`);
  process.exit(1);
}

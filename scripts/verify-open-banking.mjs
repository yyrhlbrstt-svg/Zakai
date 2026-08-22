#!/usr/bin/env node
/**
 * Walk the Open Banking entry path in a real browser: link a (mock) account,
 * get an estimate, and open a case from it.
 *
 * WHY IT IS A SEPARATE CHECK FROM verify-loop
 *
 * `verify-loop` proves the path that starts with a pasted statement. This one
 * proves the path that starts with a bank feed, and they diverge at the very
 * first screen. More importantly it guards a rule the unit tests cannot see
 * from inside: while the provider is a mock, the number on screen MUST be
 * labelled as demonstration data. A unit test can assert `isLive === false`;
 * only a browser can assert that a person looking at the figure is told.
 *
 * That is the check most worth having here. Everything else in this file is
 * plumbing; the demo banner is the one that stops us inventing an amount.
 *
 * Usage:
 *   node scripts/verify-open-banking.mjs [baseUrl]
 *
 * Needs a running server with a real database and `playwright` resolvable.
 * Missing either is a SKIP, never a pass.
 */

const base = (process.argv[2] || process.env.ZAKAI_LOOP_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log("SKIP verify-open-banking: playwright not installed.");
  process.exit(0);
}

try {
  const res = await fetch(`${base}/api/protocol`);
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (e) {
  console.log(`SKIP verify-open-banking: no server at ${base} (${e.message}).`);
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();
const email = `obcheck${Date.now()}@example.com`;

try {
  // --- account, so there is somewhere to attach a feed -----------------------
  await page.goto(`${base}/he/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.fill('input[autocomplete="name"]', "בדיקת בנקאות פתוחה");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="tel"]', "0501234567");
  await page.fill('input[type="password"]', "Zakai!Strong9times");
  await page.locator('input[type="checkbox"]').first().check();
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/he\/(money|dashboard)/, { timeout: 45000 }).catch(() => {});
  check("signup completes", !/signup/.test(page.url()), page.url());

  // --- link the feed --------------------------------------------------------
  await page.goto(`${base}/he/money`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const linkCard = page.locator("#zakai-link-account");
  check("the money hub leads with linking an account", (await linkCard.count()) > 0);

  const linkBtn = linkCard.locator("button").first();
  await linkBtn.scrollIntoViewIfNeeded().catch(() => {});
  await linkBtn.click({ timeout: 10000 });
  await page.waitForTimeout(4000);

  const total = page.locator('[data-testid="estimate-total"]');
  const gotEstimate = (await total.count()) > 0;
  check("linking produces an estimate", gotEstimate, gotEstimate ? await total.innerText() : "");

  // --- the rule that matters ------------------------------------------------
  const banner = page.locator('[data-testid="demo-data-banner"]');
  check(
    "a figure from the mock provider is labelled as demo data",
    (await banner.count()) > 0,
    "no banner means we are showing an invented amount as if it were real",
  );

  // Scoped to the card, not the page. The first version of these assertions
  // read document.body and passed while the estimate was ₪0 — "נטפליקס" and
  // "סלקום" appear in the demo button's own label further down the money hub,
  // so the check was matching copy instead of a finding. A test that passes
  // for the wrong reason is worse than one that fails.
  const cardText = await linkCard.innerText();
  check("the legal basis is stated on the consent surface", /שירות מידע פיננסי/.test(cardText));
  check("the estimate names read-only access", /קריאה בלבד/.test(cardText));

  // --- the estimate is a number, and not zero -------------------------------
  const totalText = gotEstimate ? await total.innerText() : "";
  const digits = Number(totalText.replace(/[^\d]/g, ""));
  check(
    "the estimate is a real figure, not zero",
    digits > 0,
    `read "${totalText}" — zero means the fixture window and the query window stopped overlapping`,
  );

  // --- the detector found what the fixture plants ---------------------------
  check("the forgotten subscription is surfaced", /נטפליקס/.test(cardText));
  check("the price rise is surfaced", /סלקום/.test(cardText));
  check(
    "the two-visit coincidence is NOT claimed",
    !/מסעדת הגן/.test(cardText),
  );

  // --- and it leads somewhere ----------------------------------------------
  const next = page.locator("#zakai-link-account a").last();
  if (await next.count()) {
    await next.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  check("the estimate leads on to the case path", /money/.test(page.url()), page.url());
} catch (e) {
  check("run completed without throwing", false, String(e.message).slice(0, 160));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} open-banking checks passed.`);
if (failed.length) process.exit(1);

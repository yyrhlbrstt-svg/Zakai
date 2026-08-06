#!/usr/bin/env node
/**
 * Walk Zakai's critical path in a real browser and fail if a user cannot
 * finish it.
 *
 * WHY THIS EXISTS
 *
 * The unit suite is large and green, and it still shipped a signup screen
 * nobody could get past. The submit handler set a translated "tick the terms"
 * error that never ran, because the checkbox carried `required` and native
 * constraint validation aborted the submit first. Every test passed. CI
 * passed. The button did nothing, and the founder's own family could not
 * create an account.
 *
 * No unit test catches that, because the bug lives in the space between the
 * browser and the code — exactly the space a user occupies. This script is
 * the cheapest honest check that the loop a person actually walks still
 * works end to end.
 *
 * Usage:
 *   node scripts/verify-loop.mjs [baseUrl]
 *
 * Needs a running server with a real database (see docs/LOCAL_LOOP.md) and
 * `playwright` resolvable. Missing either is reported as SKIP, never as a
 * pass — a check that silently no-ops is worse than no check.
 */

const base = (process.argv[2] || process.env.ZAKAI_LOOP_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log("SKIP verify-loop: playwright not installed (npm i -D playwright).");
  process.exit(0);
}

try {
  const res = await fetch(`${base}/api/protocol`);
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (e) {
  console.log(`SKIP verify-loop: no server at ${base} (${e.message}).`);
  console.log("Start one with a real database first — see docs/LOCAL_LOOP.md.");
  process.exit(0);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();
const email = `loopcheck${Date.now()}@example.com`;

try {
  await page.goto(`${base}/he/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  await page.fill('input[autocomplete="name"]', "בדיקת לולאה");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="tel"]', "0501234567");
  await page.fill('input[type="password"]', "Zakai!Strong9times");

  // Submitting without the terms box must SAY why. This is the regression
  // that shipped: the button appeared to do nothing at all.
  await page.click('button[type="submit"]');
  await page.waitForTimeout(800);
  const explained = /תנאים|לאשר/.test(await page.locator("body").innerText());
  check("blocked signup explains itself instead of doing nothing", explained);

  await page.locator('input[type="checkbox"]').first().check();
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/he\/(money|dashboard)/, { timeout: 45000 }).catch(() => {});
  check("signup completes and lands in-app", !/signup/.test(page.url()), page.url());

  await page.goto(`${base}/he/money`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const demo = page.locator("button", { hasText: /דוגמה/ }).first();
  const hasDemo = (await demo.count()) > 0;
  check("money hub offers a zero-typing way in", hasDemo);
  if (hasDemo) {
    await demo.click();
    await page.waitForTimeout(700);
    const scan = page.locator("button", { hasText: /סרו?ק|נתח/ }).first();
    if (await scan.count()) {
      await scan.click();
      await page.waitForTimeout(6000);
    }
    check("scan produces a next action", /תיק|הסוכן|פתח/.test(await page.locator("body").innerText()));
  }

  // A disabled agent CTA must name what it is waiting for, in every vertical.
  await page.goto(`${base}/he/warranty`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  check(
    "an incomplete vertical form names its missing fields",
    /כדי להמשיך צריך למלא/.test(await page.locator("body").innerText()),
  );
} catch (e) {
  check("run completed without throwing", false, String(e.message).slice(0, 160));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} loop checks passed.`);
if (failed.length) {
  console.log("A real person cannot finish the loop. Fix before shipping.");
  process.exit(1);
}

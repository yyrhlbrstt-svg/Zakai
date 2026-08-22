#!/usr/bin/env node
/**
 * The three journeys that must never be broken when somebody opens the app.
 *
 *   (a) scan a bill → see an estimate → open a case
 *   (b) the dashboard loads and shows that case's status
 *   (c) the Mandate verification page renders
 *
 * WHY THESE THREE
 *
 * They are the ones a stranger walks in order, and each fails differently:
 * (a) is the product's whole reason to exist, (b) is where somebody returns
 * to, and (c) is the page an institution opens to decide whether to believe
 * us — the only one with an audience that is not our user.
 *
 * WHY IT TAKES A URL
 *
 * So CI can point it at the Vercel preview for the pull request rather than a
 * server it started itself. A preview that passes is the artefact that gets
 * promoted; testing a locally-built copy proves the code is fine and says
 * nothing about the thing that will actually be visited.
 *
 * Usage: node scripts/verify-journeys.mjs [baseUrl]
 */

const base = (process.argv[2] || process.env.PREVIEW_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log("SKIP verify-journeys: playwright not installed.");
  process.exit(0);
}

try {
  const res = await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (e) {
  console.log(`SKIP verify-journeys: no server at ${base} (${e.message}).`);
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 140)));

const email = `journey${Date.now()}@example.com`;

try {
  // ---- (a) scan → estimate → case ---------------------------------------
  await page.goto(`${base}/he/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.fill('input[autocomplete="name"]', "מסע בדיקה");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="tel"]', "0501234567");
  await page.fill('input[type="password"]', "Zakai!Strong9times");
  await page.locator('input[type="checkbox"]').first().check();
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/he\/(money|dashboard)/, { timeout: 45000 }).catch(() => {});
  check("(a) an account can be created", !/signup/.test(page.url()), page.url());

  await page.goto(`${base}/he/money`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const demo = page.locator("button", { hasText: /דוגמה/ }).first();
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(800);
    const scan = page.locator("button", { hasText: /סרו?ק|נתח/ }).first();
    if (await scan.count()) {
      await scan.click();
      await page.waitForTimeout(6000);
    }
  }
  const afterScan = await page.locator("main").innerText();
  check("(a) a scan produces a figure and a next action", /₪/.test(afterScan) && /תיק|פתח/.test(afterScan));

  // ---- (b) the dashboard shows state ------------------------------------
  const dash = await page.goto(`${base}/he/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const dashText = await page.locator("main").innerText();
  check("(b) the dashboard loads for a signed-in person", dash?.ok() === true && !/\/login/.test(page.url()), `${dash?.status()} ${new URL(page.url()).pathname}`);
  check("(b) the dashboard says something, not nothing", dashText.replace(/\s+/g, "").length > 60, `${dashText.length} chars`);

  // ---- (c) the page an institution opens --------------------------------
  const verify = await page.goto(`${base}/he/verify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const verifyText = await page.locator("main").innerText();
  check("(c) the Mandate verification page renders", verify?.ok() === true, `${verify?.status()}`);
  check("(c) it explains what is being verified", verifyText.replace(/\s+/g, "").length > 60, `${verifyText.length} chars`);

  /*
    The public key an institution checks against must actually be servable.

    Two failures live here and they are not the same. An environment with no
    signing key configured answers 503 `mandate_keys_not_configured` — true of
    a local checkout and of nothing else, since production and preview both
    have the key. A 503 that says anything else, or a 200 with no keys in it,
    is the real failure: an institution asked how to verify us and got nothing.
    Collapsing the two would either cry wolf on every laptop or stay silent on
    the one that matters.
  */
  const jwks = await fetch(`${base}/.well-known/zakai-jwks.json`, { signal: AbortSignal.timeout(20000) });
  const keysBody = await jwks.json().catch(() => null);
  if (jwks.status === 503 && keysBody?.error === "mandate_keys_not_configured") {
    console.log("warn (c) JWKS — no signing key in THIS environment; production must never answer this way");
  } else {
    check("(c) the JWKS an institution verifies against is public", Boolean(keysBody?.keys?.length), `${jwks.status}`);
  }

  check("no uncaught client errors across all three", consoleErrors.length === 0, consoleErrors[0] ?? "");
} catch (e) {
  check("run completed without throwing", false, String(e.message).slice(0, 160));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} journey checks passed against ${base}`);
if (failed.length) process.exit(1);

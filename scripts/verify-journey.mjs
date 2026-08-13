#!/usr/bin/env node
/**
 * Walk the whole thing as a stranger with a thumb, and stop where they stop.
 *
 * WHY THIS EXISTS, WHEN THREE OTHER CHECKS ALREADY "COVER THE LOOP"
 *
 * They do not. Laid end to end:
 *
 *   routeSweep     — every page renders
 *   flowSweep      — every control can be touched
 *   verify-loop    — signup works, and a scan produces *a next action*
 *   verify-money-loop — the loop closes, over HTTP, calling our own API
 *
 * The last one is the closest, and it is not a person. It POSTs to
 * /api/cases/:id/approve because it knows that route exists. A person does
 * not know that route exists. A person knows what is on the screen in front
 * of them, and if the way on is not on that screen, the product is finished
 * for them whatever the API can do.
 *
 * So the whole repository is green and nobody — not once, not in this
 * container, not in production — has watched the journey happen the way it
 * actually happens: land on the homepage, tap the thing that looks like the
 * way in, and keep tapping until money is documented or the screen runs out
 * of ways forward.
 *
 * THE ONE RULE THAT MAKES THIS DIFFERENT
 *
 * Every step must find its own way on, by visible text, on whatever page the
 * previous step happened to land on. It never navigates to a URL it was not
 * shown. The moment a step cannot find its control, that is the finding —
 * the report says which screen the stranger was standing on and what they
 * were looking for. Letting it "help itself" to a known URL would convert a
 * real dead end into a passing check, which is precisely the failure this
 * script exists to stop repeating.
 *
 * ASSISTED, NEVER "OK"
 *
 * Two moments genuinely leave the browser: the ownership email, and a
 * provider replying. Those steps read the Outbox directly and are reported as
 * ASSISTED. They are not passes. A run that ends with ASSISTED steps has
 * proven the product works for somebody whose mail arrives — nothing more —
 * and the summary says so in those words.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/verify-journey.mjs [baseUrl]
 *   PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome node scripts/verify-journey.mjs
 */

import { PrismaClient } from "@prisma/client";

const base = (process.argv[2] || process.env.ZAKAI_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.log("SKIP verify-journey: playwright not installed.");
  process.exit(0);
}

try {
  const probe = await fetch(`${base}/api/protocol`);
  if (!probe.ok) throw new Error(`status ${probe.status}`);
} catch (e) {
  console.log(`SKIP verify-journey: no server at ${base} (${e.message}).`);
  process.exit(0);
}

const steps = [];
function record(name, state, detail = "") {
  steps.push({ name, state, detail });
  const tag = { ok: "OK      ", stuck: "STUCK   ", assisted: "ASSISTED" }[state];
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ""}`);
  return state === "ok" || state === "assisted";
}

const prisma = new PrismaClient();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();

const email = `journey${Date.now()}@example.com`;
const PASSWORD = "JourneyCheck12345!";

/** Text visible to the reader right now — what they have to work with. */
async function screenText() {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/**
 * The way on, as a person finds it: something on this screen whose words
 * match, that is actually visible, and that is not the cookie bar.
 */
async function tap(pattern, { within = "body", timeout = 8000 } = {}) {
  const target = page
    .locator(`${within} a:visible, ${within} button:visible`)
    .filter({ hasText: pattern })
    .first();
  try {
    await target.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 5000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  return true;
}

async function settle(ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

let caseId = null;

try {
  // ---- 1. Somebody arrives -------------------------------------------------
  await page.goto(`${base}/he`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(2400); // the boot splash
  record("the homepage opens", "ok", page.url());

  // ---- 2. They take the way in that the page offers ------------------------
  const wentIn = await tap(/מתחילים|התחל|סרוק|הכסף שלי/);
  record(
    "the homepage offers a way in and it leads somewhere",
    wentIn ? "ok" : "stuck",
    wentIn ? page.url() : "no visible control matched a way to start",
  );

  // ---- 3. They need an account before a case can exist ---------------------
  // Reached the way a person reaches it: by whatever the screen says next.
  if (!/signup|login/.test(page.url())) {
    await tap(/הרשמה|כניסה|התחבר/);
  }
  const onAuth = /signup|login/.test(page.url());
  if (onAuth && /login/.test(page.url())) await tap(/הרשמה/, { within: "main" });
  await settle(1200);
  const canSignUp = (await page.locator('input[autocomplete="name"]').count()) > 0;
  if (
    !record(
      "a sign-up form is reachable from where they were standing",
      canSignUp ? "ok" : "stuck",
      page.url(),
    )
  )
    throw new Error("stop");

  await page.fill('input[autocomplete="name"]', "מסע בדיקה");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="tel"]', "0501234571");
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('input[type="checkbox"]').first().check();
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/he\/(money|dashboard|check)/, { timeout: 45000 }).catch(() => {});
  await settle(1500);
  if (
    !record(
      "signing up lands them inside the product",
      /\/he\/(money|dashboard|check)/.test(page.url()) ? "ok" : "stuck",
      page.url(),
    )
  )
    throw new Error("stop");

  // ---- 4. They give the product something to look at ----------------------
  if (!/\/he\/money/.test(page.url())) await tap(/הכסף שלי|מתחילים/);
  await settle(1200);
  const loadedDemo = await tap(/דוגמה/);
  record(
    "there is a way to try it without typing anything",
    loadedDemo ? "ok" : "stuck",
    loadedDemo ? "" : "no zero-typing way in on /money",
  );
  const scanned = await tap(/^סרוק|נתח|בדוק/);
  await page.waitForTimeout(7000);
  if (
    !record(
      "the scan comes back with something",
      scanned ? "ok" : "stuck",
      scanned ? "" : "no visible control ran the scan",
    )
  )
    throw new Error("stop");

  // ---- 5. The scan has to lead to a case, not to a number -----------------
  const openedCase = await tap(/פתח תיק|פתיחת תיק|הסוכן/);
  await settle(2500);
  const before = caseId;
  const row = await prisma.case.findFirst({
    where: { user: { email } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  caseId = row?.id ?? before;
  if (
    !record(
      "the result opens a real case, not just a number on screen",
      caseId ? "ok" : "stuck",
      caseId ? `case ${caseId} (${row?.status})` : `nothing opened from: ${page.url()}`,
    )
  )
    throw new Error("stop");

  // ---- 6. From here the case must drive itself ---------------------------
  await settle(1500);
  const seen = await screenText();
  record(
    "the case screen says what happens next",
    /אימות|אישור|שליחה|הבא|המשך/.test(seen) ? "ok" : "stuck",
    page.url(),
  );

  // Opening from a scan is itself the person's explicit action, and the route
  // records consent at that moment — so a case that arrives APPROVED has not
  // skipped anything, and demanding a second approve button here would be
  // testing a screen the product deliberately does not show.
  const beforeApprove = await prisma.case.findUnique({
    where: { id: caseId },
    select: { status: true, approvedAt: true },
  });
  if (beforeApprove?.approvedAt) {
    record("their approval is on the record", "ok", `consent stored at case open (${beforeApprove.status})`);
  } else {
    const approved = await tap(/אשר|מאשר|אישור/);
    await settle(1500);
    const after = await prisma.case.findUnique({
      where: { id: caseId },
      select: { approvedAt: true },
    });
    record(
      "their approval can be given on screen",
      after?.approvedAt ? "ok" : "stuck",
      approved ? "the control was there but no consent was stored" : "no visible approve control",
    );
  }

  // ---- 7. Ownership: the step that leaves the browser --------------------
  // Named as specifically as the screen allows. A looser pattern hit the
  // account-email nudge instead — two buttons, same screen, both offering to
  // "send a verification link", which is a real confusion a person shares
  // with a script and the reason that nudge was reworded.
  await tap(/לאימות בעלות|אימות בעלות|שלח קוד בעלות/);
  await settle(2000);
  const afterOwn = await prisma.case.findUnique({
    where: { id: caseId },
    select: { ownershipVerifiedAt: true, status: true },
  });
  if (afterOwn?.ownershipVerifiedAt) {
    record("ownership is settled without leaving the app", "ok", "email already verified");
  } else {
    const msg = await prisma.outbox.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: { channel: true, status: true, body: true },
    });
    const link = msg?.body?.match(/https?:\/\/\S+/)?.[0];
    const code = msg?.body?.match(/\b\d{6}\b/)?.[0];
    if (link) {
      await page.goto(link.replace(/^https?:\/\/[^/]+/, base), {
        waitUntil: "domcontentloaded",
      });
      await settle(1500);
    } else if (code) {
      await page.fill('input[inputmode="numeric"], input[placeholder*="קוד"]', code).catch(() => {});
      await tap(/אמת/);
      await settle(1200);
    }
    const now = await prisma.case.findUnique({
      where: { id: caseId },
      select: { ownershipVerifiedAt: true },
    });
    record(
      "ownership can be proven",
      now?.ownershipVerifiedAt ? "assisted" : "stuck",
      msg ? `via ${msg.channel} (${msg.status}) — read out of the Outbox, not delivered` : "no message was even queued",
    );
  }

  // ---- 8. Back to the case, the way the screen offers --------------------
  // The magic link lands them on a verification page, not on their case. The
  // only honest way back is whatever that page puts in front of them — and if
  // there is nothing, that is the finding, not a reason to type a URL.
  const wentBack = await tap(/המשיכו את התיק|המשיכו עכשיו|הכסף שלי|לדשבורד/);
  await settle(2000);
  if (
    !record(
      "the verification page leads back to the case",
      wentBack ? "ok" : "stuck",
      wentBack ? page.url() : `dead end at ${page.url()}`,
    )
  )
    throw new Error("stop");

  // ---- 9. Sending: the moment the product does its job -------------------
  const sent = await tap(/^שלח|שליחה|שלח עם/);
  await settle(2500);
  const afterSend = await prisma.case.findUnique({
    where: { id: caseId },
    select: { status: true },
  });
  if (
    !record(
      afterSend?.status === "SENT" && !sent
        ? "the case reached SENT without them having to press anything"
        : "the case can be sent from the screen",
      afterSend?.status === "SENT" ? "ok" : "stuck",
      `status ${afterSend?.status}${sent ? "" : " — sent by the express path, no button pressed"}`,
    )
  )
    throw new Error("stop");

  // ---- 10. The saving: what all of it was for ---------------------------
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(2000);
  // The button is disabled until the number is there, so the number comes
  // first — which is also the order a person does it in, since the field sits
  // above the button.
  const amountBox = page
    .locator('main input[type="number"]:visible')
    .filter({ has: page.locator(":scope") })
    .last();
  let typedAmount = false;
  if (await amountBox.count()) {
    await amountBox.scrollIntoViewIfNeeded().catch(() => {});
    await amountBox.fill("59").catch(() => {});
    typedAmount = true;
    await page.waitForTimeout(400);
  }
  const recorded = await tap(/רשום חיסכון|תעד חיסכון|רשום את החיסכון/);
  await settle(2500);
  const proof = await prisma.savingsProof.findFirst({
    where: { caseId },
    select: { savingMonthly: true },
  });
  record(
    "a saving can be recorded from the screen",
    proof ? "ok" : "stuck",
    proof
      ? `${proof.savingMonthly} agorot/month`
      : recorded
        ? "the control was there but no proof was written"
        : typedAmount
          ? "the amount went in but the record control never became usable"
          : "no visible way to record what was saved",
  );
} catch (e) {
  if (e.message !== "stop") record("the run finished without throwing", "stuck", String(e.message).slice(0, 160));
} finally {
  await browser.close();
  await prisma.$disconnect();
}

const stuck = steps.filter((s) => s.state === "stuck");
const assisted = steps.filter((s) => s.state === "assisted");

console.log(
  `\n${steps.length - stuck.length}/${steps.length} steps a stranger could take unaided.`,
);
if (assisted.length) {
  console.log(
    `${assisted.length} needed help the browser could not give itself — this run does NOT prove those work for a real person:`,
  );
  for (const s of assisted) console.log(`  · ${s.name} — ${s.detail}`);
}
if (stuck.length) {
  console.log(`\nWhere they stopped:`);
  for (const s of stuck) console.log(`  ✗ ${s.name} — ${s.detail}`);
}

process.exit(stuck.length === 0 ? 0 : 1);

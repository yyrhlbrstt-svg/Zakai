#!/usr/bin/env node
/**
 * Does the scan actually read a bill, or does it just move on?
 *
 * WHY THIS IS THE ONE THING NOTHING ELSE COVERS
 *
 * Every other check in this repository can run without an AI key. This one
 * cannot, which is exactly why the founder reported the same defect twice —
 * "I put in random pictures and it does nothing" — and why it stayed the only
 * complaint I could not answer with a measurement. The image path is the
 * product's front door on a phone, and it has never been proven end to end by
 * anybody.
 *
 * WHAT IT ASSERTS, AND WHY THE NEGATIVE CASE MATTERS MORE
 *
 * Three images, generated here so the run is self-contained:
 *
 *   1. A statement — dated rows, merchants, amounts. Must come back as CSV
 *      rows, and the merchant names must survive.
 *   2. A picture of something that is not a statement. Must come back as
 *      `noTransactions`, not as an error, and not as prose pasted into the
 *      person's data. This is the case that was broken: the model's reply was
 *      returned verbatim and dropped into the box holding the user's own
 *      statement, so a photo of a cat produced a sentence about a cat sitting
 *      in their transaction list and a scan that found nothing. From the
 *      outside that is indistinguishable from "it did nothing".
 *   3. A blank image. Same requirement, different failure mode.
 *
 * A read that returns something for every input is not a working reader. The
 * ability to say "there is nothing here" is the whole feature.
 *
 * Usage — needs a server with a real ANTHROPIC_API_KEY and a signed-in session:
 *   ANTHROPIC_API_KEY=... npm run build && npx next start &
 *   node scripts/verify-image-scan.mjs [baseUrl]
 */

const base = (process.argv[2] || process.env.ZAKAI_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

try {
  const probe = await fetch(`${base}/api/protocol`);
  if (!probe.ok) throw new Error(`status ${probe.status}`);
} catch (e) {
  console.log(`SKIP verify-image-scan: no server at ${base} (${e.message}).`);
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("SKIP verify-image-scan: playwright not installed.");
  process.exit(0);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

/**
 * Images drawn here rather than committed as fixtures.
 *
 * A checked-in screenshot of a real bank app is somebody's actual statement,
 * and the one thing this repository must never do is keep a person's
 * transactions in source control to test the tool that promises not to store
 * them.
 */
async function renderPng(page, html, width = 420, height = 640) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<body style="margin:0;background:#fff">${html}</body>`);
  const buf = await page.screenshot({ type: "png" });
  return buf.toString("base64");
}

const STATEMENT_HTML = `
  <div style="font:15px/1.7 system-ui;padding:18px;color:#111">
    <div style="font-weight:700;font-size:17px;margin-bottom:10px">תנועות אחרונות</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td>12/06/2026</td><td>סלקום</td><td style="text-align:left">89.90</td></tr>
      <tr><td>14/06/2026</td><td>NETFLIX</td><td style="text-align:left">54.90</td></tr>
      <tr><td>18/06/2026</td><td>סופר פארם</td><td style="text-align:left">132.40</td></tr>
      <tr><td>01/07/2026</td><td>סלקום</td><td style="text-align:left">89.90</td></tr>
      <tr><td>03/07/2026</td><td>NETFLIX</td><td style="text-align:left">54.90</td></tr>
    </table>
  </div>`;

const NOT_A_STATEMENT_HTML = `
  <div style="font:28px/1.5 system-ui;padding:40px;text-align:center;color:#222">
    🌳🌳🌳<br/>a park bench<br/>on a sunny afternoon
  </div>`;

const BLANK_HTML = `<div style="width:100%;height:100vh"></div>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();

let cookie = "";
async function api(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* the raw text is what the failure line prints */
  }
  return { status: res.status, json, text };
}

try {
  const signup = await api("/api/auth/signup", {
    name: "בודק תמונות",
    email: `imgscan${Date.now()}@example.com`,
    phone: "05012345" + String(Math.floor(10 + Math.random() * 89)),
    password: "ImageScan12345!",
    country: "IL",
  });
  if (!check("a session exists to scan with", Boolean(cookie), `status ${signup.status}`)) {
    throw new Error("stop");
  }

  // ---- 1. A statement is read -------------------------------------------
  const statement = await api("/api/scan/extract", {
    imageBase64: await renderPng(page, STATEMENT_HTML),
    mediaType: "image/png",
  });

  if (statement.status === 503) {
    console.log(
      "\nSKIP verify-image-scan: the server reports no AI configured (503 aiUnavailable).",
    );
    console.log("This check exists to be run WITH a key — without one it proves nothing.");
    await browser.close();
    process.exit(0);
  }

  const csv = String(statement.json.csv ?? "");
  const rows = csv.split("\n").filter((l) => l.trim());
  check(
    "a statement image comes back as transaction rows",
    statement.status === 200 && rows.length >= 3,
    `status ${statement.status}, ${rows.length} rows`,
  );
  check(
    "every row is a date, a merchant and an amount",
    rows.length > 0 && rows.every((r) => /^\s*\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\s*,/.test(r)),
    rows[0] ? `first row: ${rows[0]}` : "no rows",
  );
  check(
    "the merchants survive the read",
    /סלקום/.test(csv) && /netflix/i.test(csv),
    csv.slice(0, 120).replace(/\n/g, " | "),
  );

  // ---- 2. Something that is not a statement ------------------------------
  const notStatement = await api("/api/scan/extract", {
    imageBase64: await renderPng(page, NOT_A_STATEMENT_HTML),
    mediaType: "image/png",
  });
  check(
    "a photo that is not a statement says so, rather than returning prose",
    notStatement.status === 422 && notStatement.json.error === "noTransactions",
    `status ${notStatement.status}, body ${notStatement.text.slice(0, 120)}`,
  );

  // ---- 3. A blank image ---------------------------------------------------
  const blank = await api("/api/scan/extract", {
    imageBase64: await renderPng(page, BLANK_HTML),
    mediaType: "image/png",
  });
  check(
    "a blank image says there is nothing in it",
    blank.status === 422 && blank.json.error === "noTransactions",
    `status ${blank.status}, body ${blank.text.slice(0, 120)}`,
  );
} catch (e) {
  if (e.message !== "stop") check("the run finished without throwing", false, String(e.message).slice(0, 160));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} image-scan checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);

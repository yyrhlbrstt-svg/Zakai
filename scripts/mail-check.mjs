#!/usr/bin/env node
/**
 * Send one real message with the credentials the app will use, and say
 * precisely what happened.
 *
 * WHY THIS EXISTS
 *
 * `npm run preflight` reports whether the SMTP variables are *present*.
 * Present is not working. A wrong password, a Gmail account without an app
 * password, a blocked port, a From address the transport is not allowed to
 * send as — every one of those passes preflight and fails silently in
 * production, where the symptom is an ownership code that never arrives and a
 * person who concludes the product is broken.
 *
 * Nothing else in this repo actually proves the transport. This does, in one
 * command, before anybody depends on it.
 *
 * Usage:
 *   node scripts/mail-check.mjs                 # sends to SMTP_USER
 *   node scripts/mail-check.mjs you@example.com # sends somewhere specific
 */

import { readFileSync, existsSync } from "node:fs";

// Load .env the way the app does, without adding a dependency for it.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const port = Number(process.env.SMTP_PORT || 587);
const from = process.env.SMTP_FROM?.trim() || user;
const to = process.argv[2] || user;

function fail(message, hint) {
  console.log(`\nFAIL  ${message}`);
  if (hint) console.log(`      ${hint}`);
  process.exit(1);
}

if (!host) fail("SMTP_HOST is not set.", "For Gmail: smtp.gmail.com");
if (!user) fail("SMTP_USER is not set.", "The full address you send as, e.g. you@gmail.com");
if (!pass) {
  fail(
    "SMTP_PASS is not set.",
    "For Gmail this must be a 16-character App Password, not your account password.",
  );
}
if (!to) fail("Nowhere to send to.", "Pass an address, or set SMTP_USER.");

const fromDomain = (from.match(/@([^>\s]+)/) || [])[1]?.toLowerCase();
const userDomain = (user.match(/@([^>\s]+)/) || [])[1]?.toLowerCase();
if (fromDomain && userDomain && fromDomain !== userDomain) {
  console.log(`\n!  SMTP_FROM is @${fromDomain} but you authenticate as @${userDomain}.`);
  console.log("   Without SPF and DKIM published for the From domain, this will be");
  console.log("   delivered with a warning, or not at all. Leaving SMTP_FROM unset");
  console.log("   sends as your own address, which always passes.");
}

const nodemailer = (await import("nodemailer")).default;

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

console.log(`\nConnecting to ${host}:${port} as ${user} …`);

try {
  await transport.verify();
  console.log("OK    the server accepted these credentials.");
} catch (err) {
  const message = String(err?.message || err);
  let hint = "";
  if (/invalid login|username and password not accepted|535/i.test(message)) {
    hint =
      "Gmail rejects normal account passwords over SMTP. Create an App Password " +
      "at myaccount.google.com/apppasswords and use that (16 characters, no spaces).";
  } else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|timeout|timed out/i.test(message)) {
    hint =
      `Could not reach ${host}:${port}. Either the host is wrong, or outbound SMTP ` +
      "is blocked where this is running — many networks and hosting sandboxes " +
      "block port 587 and 465 outright. Try from your own machine.";
  }
  fail(message, hint);
}

try {
  const info = await transport.sendMail({
    from,
    to,
    subject: "זכאי — בדיקת דואר יוצא",
    text:
      "אם ההודעה הזאת הגיעה, הדואר היוצא של זכאי עובד.\n\n" +
      "זה אומר שאימות בעלות יכול להישלח, ולכן תיק יכול לעבור ל-SENT, " +
      "ולכן SavingsProof ועמלה יכולים בכלל להתקיים.\n",
  });
  console.log(`OK    message sent. id: ${info.messageId}`);
  console.log(`\nNow open ${to} and confirm it arrived — including the spam folder.`);
  console.log("Accepted by the server is not the same as landed in an inbox.");
} catch (err) {
  fail(String(err?.message || err), "Credentials were accepted but the send was refused.");
}

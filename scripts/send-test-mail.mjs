#!/usr/bin/env node
/**
 * Send one real email through whatever is configured, and say exactly what
 * happened.
 *
 * WHY THIS EXISTS
 *
 * `preflight` checks that the SMTP variables are present. Present is not the
 * same as working, and the gap between them is where case #1 dies quietly:
 * the Outbox says SENT, the founder concludes the company ignored the letter,
 * and the truth was that authentication failed or the domain was never
 * verified. That is the wrong lesson learned from a broken experiment, and it
 * is expensive because it is learned about the market rather than about the
 * mail server.
 *
 * So this connects, authenticates, and sends — three separate things that fail
 * for three different reasons — and reports which one broke.
 *
 * Usage: node scripts/send-test-mail.mjs you@example.com
 */

const to = process.argv[2];
if (!to || !to.includes("@")) {
  console.log("Usage: node scripts/send-test-mail.mjs <recipient@example.com>");
  console.log("Send it to yourself first. Then send it to a second address on a");
  console.log("different provider (Gmail AND Outlook), because deliverability");
  console.log("differs per provider and one inbox proves less than you think.");
  process.exit(1);
}

let nodemailer;
try {
  nodemailer = (await import("nodemailer")).default;
} catch {
  console.log("FAIL nodemailer is not installed.");
  process.exit(1);
}

const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const port = Number(process.env.SMTP_PORT || 587);
const from = process.env.SMTP_FROM?.trim() || user;

if (!host || !user || !pass) {
  console.log("FAIL SMTP is not configured. Nothing can leave this system.");
  console.log(`     SMTP_HOST=${host ? "set" : "MISSING"}  SMTP_USER=${user ? "set" : "MISSING"}  SMTP_PASS=${pass ? "set" : "MISSING"}`);
  console.log("\n     This is the app's own p0. Until it is set, every case ends at QUEUED.");
  process.exit(1);
}

console.log(`host ${host}:${port}  user ${user}  from ${from}`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

// 1. Connection and authentication, separately from sending. A wrong password
//    and an unreachable host look identical from a failed send.
try {
  await transport.verify();
  console.log("ok   connected and authenticated");
} catch (e) {
  console.log(`FAIL could not connect or authenticate — ${String(e.message).slice(0, 200)}`);
  console.log("\n     Wrong host/port, wrong credentials, or the provider has not");
  console.log("     activated the account yet. Nothing was sent.");
  process.exit(1);
}

// 2. The actual send.
const stamp = new Date().toISOString();
try {
  const info = await transport.sendMail({
    from,
    to,
    subject: `Zakai deliverability test — ${stamp}`,
    text: [
      "This is a real message sent through Zakai's own transport.",
      "",
      "If you are reading it in the INBOX, the transport works.",
      "If you found it in SPAM, the transport works and the DOMAIN does not —",
      "which matters more, because a demand letter that lands in a company's",
      "spam folder is indistinguishable from a company that ignored you.",
      "",
      `Sent ${stamp}`,
    ].join("\n"),
  });
  console.log(`ok   accepted by the server — id ${info.messageId}`);
  if (info.accepted?.length) console.log(`     accepted: ${info.accepted.join(", ")}`);
  if (info.rejected?.length) console.log(`FAIL rejected: ${info.rejected.join(", ")}`);
  if (info.response) console.log(`     server said: ${String(info.response).slice(0, 160)}`);
} catch (e) {
  console.log(`FAIL the send was refused — ${String(e.message).slice(0, 240)}`);
  console.log("\n     Most often: the FROM domain is not verified with the provider.");
  console.log("     Resend, Postmark and SendGrid all refuse to relay from a domain");
  console.log("     you have not proven you own.");
  process.exit(1);
}

// 3. The part that decides whether case #1 is a valid experiment.
const fromDomain = from.split("@")[1] ?? "";
const userDomain = user.split("@")[1] ?? "";
console.log("");
console.log("Now go and look, because 'accepted' is not 'delivered':");
console.log("  - Is it in the INBOX or in SPAM?");
console.log("  - Open the message headers and confirm SPF and DKIM both say 'pass'.");
if (fromDomain && userDomain && fromDomain !== userDomain) {
  console.log(`  ! You are sending as @${fromDomain} but authenticating as @${userDomain}.`);
  console.log("    That is the classic setup that authenticates fine and lands in spam.");
}
console.log("");
console.log("A letter to a company's נציב that lands in spam will read as 'they");
console.log("ignored us'. That is the one wrong conclusion this whole experiment");
console.log("must not produce.");

#!/usr/bin/env node
/**
 * Deploy preflight.
 *
 * "Ready to go live" is a claim about a running system, not a build that
 * compiled. This says exactly what is configured, what is missing, and what
 * each gap actually costs — so going live is a decision with known
 * consequences instead of a hope.
 *
 * Distinguishes blocking from degrading on purpose. A missing signing key means
 * the trust layer is inert and should stop a launch; a missing AI key means the
 * product falls back to deterministic templates, which is a smaller product but
 * a working one. Treating both as "error" trains an operator to ignore the list.
 */

const CHECKS = [
  { key: "DATABASE_URL", level: "blocking",
    cost: "No database: signup, cases, mandates and the ledger are all dead." },
  { key: "AUTH_SECRET", level: "blocking",
    cost: "Sessions cannot be signed — nobody can stay logged in." },
  { key: "MANDATE_SIGNING_JWK", level: "blocking",
    cost: "No signed mandates or status lists. The trust layer is inert; /api/mandate/revocations returns 503 by design. Generate with scripts/generate-mandate-key.mjs." },
  { key: "MANDATE_SIGNING_KID", level: "blocking",
    cost: "Key id missing — verifiers cannot select the right key from the JWKS." },
  { key: "MANDATE_ISSUER", level: "degrading",
    cost: "Status lists fall back to the default issuer URL, which will not match a custom domain." },
  { key: "CRON_SECRET", level: "degrading",
    cost: "Cron endpoints are unauthenticated. Anyone can trigger the evolution cycle and the agent follow-ups." },
  { key: "ANTHROPIC_API_KEY", level: "degrading", alt: ["DEEPSEEK_API_KEY", "GEMINI_API_KEY", "OPENAI_COMPAT_API_KEY"],
    cost: "No AI: bill OCR is unavailable and drafts fall back to deterministic templates." },
  { key: "ORACLE_API_KEY", level: "optional",
    cost: "The prediction API stays closed. Intentional until there is an institutional customer." },
  { key: "NEXT_PUBLIC_APP_URL", level: "degrading",
    cost: "Absolute links in outgoing email may point at the wrong host." },
  // Without a transport every notification is written to the Outbox and
  // delivered nowhere. Leads are persisted first so nothing is lost, but
  // nobody is told they arrived — and an enquiry nobody reads for a week is
  // very nearly an enquiry that never came.
  { key: "SMTP_HOST", level: "degrading",
    cost: "No mail transport. Lead notifications and case correspondence are held in the Outbox and delivered nowhere." },
  { key: "SALES_EMAIL", level: "degrading", alt: ["NEXT_PUBLIC_SUPPORT_EMAIL"],
    cost: "Institutional enquiries fall back to the founder address. Fine to launch on; set it once there is a shared inbox." },
  { key: "LEADS_EMAIL", level: "degrading", alt: ["NEXT_PUBLIC_SUPPORT_EMAIL"],
    cost: "Consumer leads fall back to the founder address. Fine to launch on; set it once there is a shared inbox." },
  // A privilege, not a destination: it opens the founder dashboard, which lists
  // every lead's contact details. Deliberately has no code default, because
  // signup does not verify that somebody controls the address they register
  // with, and a hardcoded value would publish which address to claim.
  { key: "ADMIN_EMAIL", level: "degrading",
    cost: "The founder dashboard at /he/founder is closed to everyone, including you. Nothing else is affected." },
  // A From address on a domain the sending server has no authority over fails
  // SPF and DKIM, and Gmail responds by warning the recipient that the message
  // may not be genuine — which reads to them as "this account is not secure".
  { key: "SMTP_FROM", level: "degrading", alt: ["SMTP_USER"],
    cost: "Outgoing mail falls back to the authenticated mailbox. Set it to an address on a domain you control, with SPF and DKIM published." },
  // Only relevant once there is a Play listing. Until it is set, the Android
  // shell shows a browser address bar on every screen — which reviewers read as
  // a website in a wrapper, and users read as not really being an app.
  { key: "ANDROID_CERT_FINGERPRINTS", level: "optional",
    cost: "No Digital Asset Links. A Play TWA build will display the URL bar. Set it from Play Console → App integrity → App signing key certificate." },
];

// A configured address on a reserved domain is worse than an absent one: the
// preflight passes, the mail is accepted by the transport, and it goes nowhere.
// The From domain must be one the transport may actually send as. Mismatched,
// every message is delivered with a security warning attached, and the people
// who see it are the ones being asked to trust the product with their money.
const from = (process.env.SMTP_FROM || "").trim();
const smtpUser = (process.env.SMTP_USER || "").trim();
if (from && smtpUser) {
  const domain = (addr) => (addr.match(/@([^>\s]+)/) || [])[1]?.toLowerCase();
  if (domain(from) && domain(smtpUser) && domain(from) !== domain(smtpUser)) {
    console.log(`\n  ! SMTP_FROM is @${domain(from)} but the transport authenticates as @${domain(smtpUser)}.`);
    console.log("    Unless SPF and DKIM are published for the From domain, Gmail will mark every message as unverified.");
  }
}

for (const key of ["SALES_EMAIL", "LEADS_EMAIL", "NEXT_PUBLIC_SUPPORT_EMAIL"]) {
  const value = process.env[key]?.trim();
  if (value && /@(example|test|invalid|localhost)(\.|$)/i.test(value)) {
    console.log(`\n  ! ${key} is set to ${value} — a reserved domain that cannot receive mail.`);
  }
}

const results = CHECKS.map((c) => {
  const has = Boolean(process.env[c.key]?.trim());
  const viaAlt = !has && (c.alt ?? []).some((k) => process.env[k]?.trim());
  return { ...c, ok: has || viaAlt, viaAlt };
});

const blocking = results.filter((r) => !r.ok && r.level === "blocking");
const degrading = results.filter((r) => !r.ok && r.level === "degrading");

const mark = (r) => (r.ok ? (r.viaAlt ? "~" : "✓") : r.level === "optional" ? "·" : "✗");
console.log("\nZakai deploy preflight\n");
for (const r of results) {
  console.log(`  ${mark(r)} ${r.key.padEnd(24)} ${r.ok ? "" : r.cost}`);
}

console.log("");
if (blocking.length) {
  console.log(`BLOCKED — ${blocking.length} required setting(s) missing: ${blocking.map((b) => b.key).join(", ")}`);
  console.log("The app will build and serve pages, and every path that touches money or authority will fail.\n");
  process.exit(1);
}
if (degrading.length) {
  console.log(`READY, DEGRADED — ${degrading.length} setting(s) missing. The product works; parts of it are weaker than intended.\n`);
  process.exit(0);
}
console.log("READY — every required and recommended setting is present.\n");

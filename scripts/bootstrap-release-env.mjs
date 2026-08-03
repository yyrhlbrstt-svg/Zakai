#!/usr/bin/env node
/**
 * Prints env values to paste into Vercel (never writes secrets to disk).
 *
 *   node scripts/bootstrap-release-env.mjs
 *
 * Generates what the app can invent safely. SMTP + PayPlus still require
 * founder accounts — without them SENT stays in Outbox and fees stay mock.
 */
import crypto from "node:crypto";
import { generateKeyPair, exportJWK } from "jose";

const kid = `zakai-${new Date().toISOString().slice(0, 7)}-1`;
const cronSecret = crypto.randomBytes(32).toString("base64url");
const inboundSecret = crypto.randomBytes(32).toString("base64url");
const mandateIssueKey = crypto.randomBytes(32).toString("base64url");
const mandateRevokeKey = crypto.randomBytes(32).toString("base64url");

const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});

const priv = await exportJWK(privateKey);
const pub = await exportJWK(publicKey);
const jwk = JSON.stringify({ ...priv, kid, alg: "EdDSA", use: "sig" });

let vapidBlock = `# Web Push — run: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # same as VAPID_PUBLIC_KEY
`;

try {
  const mod = await import("web-push");
  const webpush = mod.default ?? mod;
  const keys = webpush.generateVAPIDKeys();
  vapidBlock = `VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
`;
} catch {
  // web-push optional at generate time
}

console.log(`
# =============================================================================
# Zakai — paste into Vercel → Settings → Environment Variables → Production
# Never commit these values. After paste: Redeploy (not Stale), then:
#   curl -s https://YOUR_HOST/api/release-gate | jq .releaseScore
#   node scripts/preflight.mjs   # must NOT print FEES: MOCK or MAIL: OFF
# =============================================================================

# --- Generated (paste as-is) -------------------------------------------------

CRON_SECRET=${cronSecret}
INBOUND_EMAIL_SECRET=${inboundSecret}
MANDATE_ISSUE_KEY=${mandateIssueKey}
MANDATE_REVOKE_KEY=${mandateRevokeKey}

MANDATE_SIGNING_KID=${kid}
MANDATE_SIGNING_JWK='${jwk}'
MANDATE_ISSUER=https://zakai-3uxj.vercel.app

NEXT_PUBLIC_APP_URL=https://zakai-3uxj.vercel.app

${vapidBlock}
# --- You must fill (loop dies without these) ---------------------------------

# 1) Mail — without SMTP, Mandates stay QUEUED in Outbox (providers never see them)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Zakai <no-reply@yourdomain.com>
LEADS_EMAIL=
SALES_EMAIL=
ADMIN_EMAIL=
FEEDBACK_EMAIL=

# 2) Real success fees — until PayPlus is complete, checkout is MOCK (no card charge)
PAYMENT_PROVIDER=payplus
PAYPLUS_API_KEY=
PAYPLUS_SECRET_KEY=
PAYPLUS_PAYMENT_PAGE_UID=
# PAYPLUS_BASE_URL=   # optional sandbox vs production

# 3) AI (OCR / drafts) — product works with templates if unset
# ANTHROPIC_API_KEY=

# --- Public JWKS preview (kid must match MANDATE_SIGNING_JWK) ----------------
`);
console.log(JSON.stringify({ keys: [{ ...pub, kid, alg: "EdDSA", use: "sig" }] }, null, 2));
console.log(`
# Order after Vercel paste:
# 1. Redeploy latest main
# 2. npm run preflight / GET /api/release-gate → want canReleaseConsumerApp true
# 3. One real case: /he/money → SENT (not Outbox QUEUED) → SavingsProof → fee
`);

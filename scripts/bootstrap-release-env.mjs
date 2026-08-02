#!/usr/bin/env node
/**
 * Prints env values to paste into Vercel (never writes secrets to disk).
 *
 *   node scripts/bootstrap-release-env.mjs
 */
import crypto from "node:crypto";
import { generateKeyPair, exportJWK } from "jose";

const kid = `zakai-${new Date().toISOString().slice(0, 7)}-1`;
const cronSecret = crypto.randomBytes(32).toString("base64url");

const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});

const priv = await exportJWK(privateKey);
const pub = await exportJWK(publicKey);
const jwk = JSON.stringify({ ...priv, kid, alg: "EdDSA", use: "sig" });

console.log(`
# Paste into Vercel → Settings → Environment Variables (Production)
# Never commit these values to git.

CRON_SECRET=${cronSecret}

MANDATE_SIGNING_KID=${kid}
MANDATE_SIGNING_JWK='${jwk}'
MANDATE_ISSUER=https://zakai-3uxj.vercel.app

NEXT_PUBLIC_APP_URL=https://zakai-3uxj.vercel.app

# Mail (example — use your provider)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=Zakai <no-reply@yourdomain.com>
# LEADS_EMAIL=leads@yourdomain.com
# SALES_EMAIL=partners@yourdomain.com
# ADMIN_EMAIL=you@yourdomain.com

# Payments (founder configures PayPlus)
# PAYMENT_PROVIDER=payplus
# PAYPLUS_API_KEY=
# PAYPLUS_SECRET_KEY=
# PAYPLUS_PAYMENT_PAGE_UID=

# AI
# ANTHROPIC_API_KEY=

# Public JWKS (verify keys[] matches your private JWK kid):
`);
console.log(JSON.stringify({ keys: [{ ...pub, kid, alg: "EdDSA", use: "sig" }] }, null, 2));
console.log(`
After setting vars: redeploy, then npm run release-gate against production or curl /api/release-gate
`);

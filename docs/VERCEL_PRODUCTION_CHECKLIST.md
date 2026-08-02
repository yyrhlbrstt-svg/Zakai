# Vercel production checklist (founder)

Run locally: `node scripts/preflight.mjs` — must pass **blocking** before you trust production.

**Consumer ship (100/100):** `npm run release-gate` or `GET /api/release-gate` — see `docs/RELEASE_100_HE.md`.

## Blocking (loop breaks without these)

| Variable | Why |
|----------|-----|
| `NEON_DATABASE_URL` | No DB → no users, cases, mandates |
| `AUTH_SECRET` | Sessions die |
| `MANDATE_SIGNING_JWK` + `MANDATE_SIGNING_KID` | No signed mandates |
| `CRON_SECRET` | Crons return 503 in production (follow-ups, digest, vigil) |

## Degrading (product works, weaker)

| Variable | Why |
|----------|-----|
| `SMTP_HOST` (+ `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) | Outbox stays QUEUED — providers never receive mail |
| `PAYMENT_PROVIDER=payplus` + PayPlus keys | Fees stay mock — no real charges |
| `ANTHROPIC_API_KEY` (or alt) | OCR/templates only — still usable |
| `ADMIN_EMAIL` | `/founder` closed |
| `NEXT_PUBLIC_APP_URL` | Wrong links in email |

## After deploy

1. Redeploy latest `main` if Vercel shows **Stale**.
2. `GET /api/network/readiness` — booleans only.
3. `/he/leaks`, `/he/start`, `/he/entitlements`, `/.well-known/zakai-jwks.json`.
4. Optional: `/he/network-proof` — public ledger snapshot for inbound institutions.

See also: `docs/EXCELLENCE_SCORECARD.md` — honest definition of product vs ops “10/10”.

## Inbound institutions (no outbound sales)

Point engineers to `/integrations` and `/network-proof` — not a sales call.

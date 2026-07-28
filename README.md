# זכאי (Zakai)

**The standard consumer money agent + Mandate infrastructure.**

Dual-track product:

1. **Consumer recovery** — scan charges → Case → Ed25519 Mandate → agent send/follow-up → SavingsProof → success fee only on documented savings. No call center. No phone left behind.
2. **Institutional infrastructure** — verifiable consumer authority (JWKS, status, scopes, OpenAPI) that banks, insurers, utilities and fintechs can accept offline without outbound-payment risk.

Live: [zakai-3uxj.vercel.app](https://zakai-3uxj.vercel.app)

## Why this can scale past recovery-app ceilings

Bill-negotiation alone caps roughly in the low billions (category peers). The bypass is **Mandate as a standard**: every regulated institution that needs machine-verifiable consumer authority without the ability to move money *out* of the principal’s accounts. Same closed-loop UX language for every vertical and market.

## Product loop (consumer)

```
problem door (homepage / leaks / cancel / what-am-i-owed)
  → Money OS scan (screenshot, no bank credentials)
  → Case (auto-approve on full verticals)
  → ownership (SMS or magic-link)
  → one-tap dispatch (Mandate + send)
  → agent follow-up rounds
  → inbound proofs@ → one-tap record saving
  → viral share after SAVED
```

Fee: success only, net of referral credit. Dispute window documented on Trust.

## Mandate (infrastructure)

- **Alg:** EdDSA / Ed25519, `typ: zakai-mandate+jws`
- **Discovery:** `/.well-known/zakai-mandate.json`
- **JWKS:** `/.well-known/zakai-jwks.json`
- **Status:** `/api/mandate/status/{jti}`
- **Verify:** `POST /api/mandate/verify`
- **Scopes:** `/api/mandate/scopes` (outbound payments forbidden in code)
- **OpenAPI:** `/api/mandate/openapi.json`
- **Human verify:** `/verify` · institutions docs: `/institutions`
- **B2B embed:** `/embed.js` with `data-path=money|cancel|what-am-i-owed|leaks` · `/partners`

## Markets

Jurisdiction packs (data-only; engine unchanged): **IL · GB · US · DE · FR · CA**

i18n locales: **he · en · ar · ru**

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind · Prisma 6 + Postgres · next-intl · jose (Ed25519) · Anthropic/Gemini side · Web Push · Vitest

## Local run

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

## Tests

```bash
npm test
npm run typecheck
npm run build
```

## Doctrine (non-negotiable)

- **No-callback:** never leave a phone number for “we’ll call you back”.
- **Closed-loop self-serve:** screenshot in, documented saving out.
- **Inbound-only authority:** Mandate cannot initiate outbound payments, transfers, loans, or account closure.
- **Success fee only on SavingsProof.**
- **Every vertical speaks the same Case language.**

## Docs

- [`TRILLION-DOLLAR-BLUEPRINT.md`](./TRILLION-DOLLAR-BLUEPRINT.md) — path past recovery category ceilings
- [`MARKET-REALITY.md`](./MARKET-REALITY.md) — honest TAM vs infrastructure
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · [`docs/MANDATE_INSTITUTIONAL_SPEC.md`](./docs/MANDATE_INSTITUTIONAL_SPEC.md)
- [`BACKLOG.md`](./BACKLOG.md) · [`JOURNAL.md`](./JOURNAL.md)

## Version

See `/api/version` and `DEPLOY_MARKER.txt`. Current line: **0.7.x** dual-track.

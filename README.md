# זכאי (Zakai) — v1.2.0 FINAL

**The standard consumer money agent + Mandate infrastructure.**

Live: [zakai-3uxj.vercel.app](https://zakai-3uxj.vercel.app)

**How to see everything:** [`HOW-TO-SEE.md`](./HOW-TO-SEE.md) · version probe: [`/api/version`](https://zakai-3uxj.vercel.app/api/version)

## Dual-track

1. **Consumer recovery** — problem doors → scan → Case → Ed25519 Mandate → agent send/follow-up → SavingsProof → fee only on documented savings. No call center. No phone left behind. Persistence recheck after ~6 months.
2. **Institutional infrastructure** — JWKS, status, scopes, OpenAPI, CORS verify — banks/insurers/utilities accept authority offline without outbound-payment risk.

## Full-service IL verticals

telecom · bank-fees · subscription · airline · refund-chase · parking · transport-fine · electricity

## Mandate endpoints

- `/.well-known/zakai-mandate.json`
- `/.well-known/zakai-jwks.json`
- `POST /api/mandate/verify` (CORS)
- `GET /api/mandate/status/{jti}`
- `/api/mandate/openapi.json`
- `/en/institutions` · `/embed.js`

## Doctrine

- No-callback
- Closed-loop self-serve (screenshot in → documented saving out)
- Inbound-only Mandate (no outbound payments)
- Success fee only on SavingsProof
- Every vertical speaks the same Case language

## Markets & i18n

IL · GB · US · DE · FR · CA — he / en / ar / ru

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind · Prisma 6 · next-intl · jose (Ed25519) · Web Push · Vitest

## Docs

- [`HOW-TO-SEE.md`](./HOW-TO-SEE.md) — **start here**
- [`MARKET-REALITY.md`](./MARKET-REALITY.md)
- [`TRILLION-DOLLAR-BLUEPRINT.md`](./TRILLION-DOLLAR-BLUEPRINT.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

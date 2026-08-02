# Excellence scorecard (honest 10/10)

Zakai’s “100/10” is **protocol + closed consumer loop + inbound institutions**, not marketing fluff.

## What code can max out today

| Layer | Signal | Where to verify |
|-------|--------|-----------------|
| Mandate infrastructure | JWKS, verify, scopes, MCP, trust registry | `/.well-known/*`, `sdk/`, `/integrations` |
| Outcome graph | De-identified `StrategyOutcome`, vertical stats | `/network-proof`, Prisma |
| Country packs | Cited rights per market | `src/lib/global/`, `npx vitest run src/lib/global/engine.test.ts` |
| Consumer loop | detect → act → prove → fee → share | Case statuses, `CaseNextStep`, payments module |
| Distribution | `llms.txt`, `utm_source=agent`, `/tools` map | `public/llms.txt`, `/he/tools` |
| Inbound B2B | No outbound bank sales; readiness + proof | `docs/INBOUND_INSTITUTIONS.md`, `GET /api/network/readiness` |

Run: `npm run test && npm run build` — must stay green on `main`.

## What only the founder unlocks (real money & mail)

| Variable | Without it |
|----------|------------|
| `CRON_SECRET` | Crons 503 — follow-ups stop |
| `MANDATE_SIGNING_*` | Mandates inert in prod |
| `SMTP_*` | Outbox QUEUED — nothing delivered |
| `PAYMENT_PROVIDER=payplus` + keys | Success fees stay mock |

`node scripts/preflight.mjs` — fix **blocking** before claiming “live” on money or authority.

## Public operational score

`GET /api/network/readiness` returns `operationalScore` (0–100) from **boolean layers only** — no secrets, no fake traction.

## Definition of “we lead”

1. First inbound institution verifies a mandate without a sales call.
2. Production passes preflight blocking + `/he/leaks`, `/he/start`, JWKS.
3. At least one documented SAVED case with real SMTP delivery (not QUEUED).

Until then: product can be **best-in-class in code**; market leadership is **earned by ops + adoption**, not asserted in copy.

**Consumer ship bar:** `npm run release-gate` or `GET /api/release-gate` must show `releaseScore: 100` and `canReleaseConsumerApp: true`. Founder guide: `docs/RELEASE_100_HE.md`.

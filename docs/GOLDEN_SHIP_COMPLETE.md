# Golden ship — definition of done (founder)

This is the honest “we can sell this” checklist after the golden IL + global rights push.

## Code (done on `main`)

- [x] **1329+** Vitest (`npm test`)
- [x] Production build (`npm run build`)
- [x] **13** jurisdiction packs + `validatePack` + `packsIntegrity.test.ts`
- [x] IL pack ↔ `ENTITLEMENTS` parity (`engine.test.ts`)
- [x] Money OS entry: `/money` priority doors + proofs forward hint
- [x] Inbound notify uses `recordAmountShekels` + deep link `?case=`
- [x] Push on SAVED documented saving
- [x] `docs/MONEY_OS.md` — institution + consumer thesis

## Production (you must verify)

1. Push `main` deployed on Vercel — status **Ready**, not **Stale**.
2. `node scripts/preflight.mjs` — fix **blocking** before claiming live money loop.
3. `GET /api/release-gate` — green or documented degrading only.
4. Smoke URLs:
   - `/he/leaks`, `/he/start`, `/he/bank-loan-fee`, `/he/arnona`
   - `/.well-known/zakai-jwks.json`
5. Real **SMTP** + **PayPlus** (or accept mock fees in staging only).

## Do not claim without the above

- “100% live” / “every fee collected” — requires PSP + proof loop in prod.
- Invented recovery amounts — UI uses indicative minors only in `revenueVerticals.ts`.

## Optional later (not blocking ship)

- Dedicated `/bank-loan-fee` Case vertical (escalation via `/bank-fees` exists).
- Inbound-email integration test with mocked Prisma.

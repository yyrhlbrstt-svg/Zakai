# CEO launch decisions (Aug 2026)

Single merge path, honest revenue gates, no fake traction.

## Ship order

1. **Merge only [PR #71](https://github.com/yyrhlbrstt-svg/Zakai/pull/71)** (`cursor/audit-fixes-584b`) into `main`.  
   It already contains everything in #70 (commercial polish) plus audit/SEO/share fixes. **Close #70** as superseded to avoid double-merge drift.

2. **Vercel** — Redeploy latest `main` until production is not **Ready Stale**.

3. **Blocking env** (run `node scripts/preflight.mjs` after setting):

   | Variable | Why |
   |----------|-----|
   | `PAYMENT_PROVIDER=payplus` + PayPlus keys | Real success-fee checkout (today: mock provider) |
   | `SMTP_*` + real `SMTP_FROM` | Outbox delivers; leads get answered |
   | `NEXT_PUBLIC_SUPPORT_EMAIL` / leads inboxes | `yyrhlbrstt@gmail.com` (or domain mail) — not `.example` |
   | `MANDATE_*` signing keys | Mandate loop in prod |

4. **Smoke** — `npm run verify:production-urls` against production URL.

## Product law (non-negotiable)

- No fabricated savings counts, no demo `StrategyOutcome` rows, no Stripe without doctrine change.
- First real saved case → one honest proof on `/proofs` → then share loop (now uses `/share?amount=` OG).

## What we deliberately did *not* ship yet

- Live collective auction (intent API only).
- TikTok / auto-post growth bot.
- Separate `zakai-packs` GitHub org (bundled packs + workflow in-repo is v1).
- Redis pack cache (admin reload + in-memory is enough for current scale).

## Next code wins (after revenue env)

- One documented IL vertical closed end-to-end with verified fee collection.
- Institution pilot from `/institutions` form with SMTP live.
- Optional: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` for privacy-friendly analytics.

# Founder audit backlog (Aug 2026)

Track honest status — no fabricated metrics.

## Revenue loop (founder / Vercel env)

- [ ] `PAYMENT_PROVIDER=payplus` + keys → `payments_live: true`
- [ ] `SMTP_*` + drain outbox → `email_delivery: true`
- [ ] One **real** documented saving → `StrategyOutcome` + proofs wall (no demo rows)

## Code (PRs)

- [x] Hebrew ZML + catalog `locale` — PR #70
- [x] Contact email floor + footer — PR #70
- [x] Fairness API fail-safe, version API slim, rights search, proofs empty — PR #71
- [ ] Merge **#71 only** (includes #70) → redeploy — see `docs/CEO_LAUNCH_DECISIONS.md`
- [ ] CDN/packs smoke after deploy (`npm run verify:production-urls`)

## UX / i18n (in progress on `cursor/audit-fixes-584b`)

- [x] OG via `/api/og` (was missing `/og.png`)
- [x] `/about` comparison uses `about.why` + min-height cards
- [x] `/agents` Hebrew body + RTL
- [x] `/institutions` full Hebrew body (long sections via `institutionsLongCopy.ts`)
- [x] Home “soon” strip — none on home today (only `/deals` placeholder); no change needed

## SEO

- [x] FAQ JSON-LD
- [x] Rights slug OG images
- [x] SAVED case share → `/share?amount=` (rich OG) via `buildShareLandingUrl`
- [ ] Optional: per-rights-slug `og:image` with conservative estimate (only when catalogue has a stable amount)

## Related

- `docs/MASTER_BRIEF_STATUS.md` — brief → code map
- `docs/CEO_LAUNCH_DECISIONS.md` — **merge #71 only**, env checklist, smoke
- `docs/PROTOCOL_SCALE_ASSESSMENT.md` — gates to protocol-scale (honest)

- Outcome graph population
- Social proof numbers
- Collective auction (phase 0 intent only)

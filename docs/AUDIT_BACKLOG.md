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
- [ ] Merge #70 → #71 → redeploy
- [ ] CDN/packs smoke after deploy (`npm run verify:production-urls`)

## UX / i18n (in progress on `cursor/audit-fixes-584b`)

- [x] OG via `/api/og` (was missing `/og.png`)
- [x] `/about` comparison uses `about.why` + min-height cards
- [x] `/agents` Hebrew body + RTL
- [x] `/institutions` partial Hebrew (hero + key sections)
- [x] `/institutions` full Hebrew body (long sections via `institutionsLongCopy.ts`)
- [ ] Home “soon” strip — keep or move to roadmap page

## SEO

- [x] FAQ JSON-LD
- [x] Rights slug OG images
- [ ] Optional: per-slug `og:image` with amount for viral SAVED shares

## Related

- `docs/MASTER_BRIEF_STATUS.md` — full “trillion-dollar protocol” brief mapped to code (honest)

- Outcome graph population
- Social proof numbers
- Collective auction (phase 0 intent only)

# Master brief — protocol build status (honest)

This maps the “trillion-dollar protocol” brief to **what exists in this repo**, what **PR #70 / #71** close, and what **cannot be faked in code** (payments, SMTP, social proof, TikTok).

**Doctrine:** PayPlus (not Stripe). No fabricated metrics. No demo `StrategyOutcome` rows.

---

## Part A — Protocol infrastructure

| Brief task | Status | Where / notes |
|------------|--------|----------------|
| Stripe Checkout | **Not in scope** | Use `PAYMENT_PROVIDER=payplus` — `src/lib/payments/` |
| Resend/SendGrid | **Ops** | `SMTP_*` → `emailConfigured()` in protocol doc |
| `support@zakai.example` | **Done (#70)** | `publicSupportEmail()` → real inbox; set `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel |
| `/he/about` | **Done (#71)** | `about.why`, OG, card min-height |
| `/api/fairness/scores` 500 | **Done (#71)** | 503 + empty `providers` on DB error |
| `api/version` internal flags | **Done (#71)** | Public slim; `?internal=1` + `X-Zakai-Admin-Token` |
| JWKS `Cache-Control` | **Done** | `src/app/.well-known/zakai-jwks.json/route.ts` |
| Revocations cache | **Done** | `src/app/api/mandate/revocations/route.ts` (900s) |
| `mandate/decide` rate limit | **Done** | 120/min — `src/app/api/mandate/decide/route.ts` |
| ZML loader CDN + fallback | **Done** | `src/lib/protocol/packs/loader.ts` |
| Sunset / replaces | **Done** | `src/lib/protocol/zml/sunset.ts` |
| In-memory cache + reload | **Done** | `invalidateZmlPackCache`, `POST /api/admin/packs/reload` |
| Redis cache | **Not required for v1** | Serverless: in-memory + admin reload; add KV/Redis when multi-region hot path needs it |
| `compatibility.ts` | **Done** | `canEvaluateZml`, `satisfiesZmlRange`, `isAtLeastVersion` |
| `GET /api/rights/evaluate/[id]` | **Done** | `buildEvaluationGuide`, `_links`, no PII |
| zakai-packs separate repo | **Partial** | Bundled `zakai-packs/` + `zakai-packs/.github/workflows/`; push to `github.com/zakai/zakai-packs` is **founder** |

---

## Part B — Autopilot

| Engine | Status | Doc |
|--------|--------|-----|
| Scheduler + crons | **Done** | `docs/AUTOPILOT.md`, `src/lib/autopilot/`, `vercel.json` |
| Law watcher | **Done** | Hash diffs → issues (no auto-merge law) |
| Price sentinel | **Done** | `AUTOPILOT_PRICE_FEEDS_JSON` |
| Outcome learner | **Done** | De-identified `StrategyOutcome` only |
| Growth bot | **Digest only** | No TikTok auto-post without keys; **no fake virality** |
| Market expander | **Done** | Maintainer issues from collective intent signals |

---

## Part C — Monetization

| Task | Status | Where |
|------|--------|--------|
| Widget embed | **Done** | `public/widget/zakai-widget.js`, `docs/WIDGET_EMBED.md` |
| `widget/register`, `widget/validate` | **Done** | `src/app/api/widget/*` |
| `/partners` | **Done** | Snippet + docs links |
| Fairness scores API | **Done** | Win-rate from outcomes; empty until `MIN_SAMPLE` |
| “Fairness Certified” badge | **Not shipped** | Needs partner program + legal copy |
| Collective auction MVP | **Phase 0** | `POST /api/collective/intent`, `GET /api/collective/summary` — no live bidding |

---

## Part D — Global / SEO

| Task | Status | Where |
|------|--------|--------|
| Hebrew `display_name` (IL) | **Done (#70)** | `zakai-packs/packs/il/rights/*.json`, `npm run sync:zml-he` |
| Rights search | **Done (#71)** | `RightsChecker` search |
| 12 markets | **Done** | `GET /api/markets`, packs + `MARKETS` |
| 76 landing pages | **Partial** | `/[locale]/rights/[slug]` for IL entitlements; ZML id slugs = follow-up |
| `robots.txt` / sitemap | **Done** | `src/app/robots.ts`, `sitemap.xml` |
| OG images | **Done (#71)** | `/api/og` (static `/og.png` was missing) |
| FAQ schema | **Done (#71)** | `/faq` JSON-LD |
| Plausible | **Optional env** | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` → `PlausibleScript` |

---

## Part E — Frontend (honest)

| Task | Status |
|------|--------|
| Zakameter CTA | **#70** |
| Fake “12,847 checks” | **Rejected** — use real counts from DB only |
| Provider logos without license | **Rejected** — trademark risk |
| Pricing “בקרוב” | Filtered in `PlanCards`; billing note honest |
| Claim “הכן טיוטה” | **#71** |
| Proofs empty state | **#71** |
| `/agents` Hebrew | **#71** `agentsPageCopy.ts` |
| `/institutions` Hebrew | **Done (#71)** — `institutionsLongCopy.ts` |
| Footer legal + support | **#70** |

---

## Part F — Security / privacy

| Task | Status |
|------|--------|
| HSTS | **Done** `next.config.mjs` |
| CSP | **Done** `middleware.ts` |
| Rate limits | **Most public APIs** |
| Zod at API boundaries | **Convention** |
| Privacy legal line | **Softened #71** |
| No PII in outcomes | **Schema + doctrine** |

---

## Part G — Docs / community

| Doc | Status |
|-----|--------|
| Protocol | `/.well-known/zakai-protocol.json`, `docs/ZAKAI_INTEROP_STANDARD.md` |
| API | `/api/mandate/openapi.json` |
| ZML | `docs/COUNTRY_PACKS.md`, `zakai-packs/schema/` |
| Discord / GitHub Discussions | **Founder** — not automated in repo |

---

## Execution order (for humans + agents)

1. **Merge PR #71 only** (includes #70) — see `docs/CEO_LAUNCH_DECISIONS.md`  
2. **Vercel env:** PayPlus, SMTP, `CRON_SECRET`, `ZAKAI_ADMIN_TOKEN`, support/leads inboxes  
3. **Scale gates:** `docs/PROTOCOL_SCALE_ASSESSMENT.md`  
4. **One real saved case** → outcome graph + proofs (no seed script)  
5. **Publish packs** to CDN → `POST /api/admin/packs/reload`  
6. **Collective auction** only after legal review of bidding  

---

## The sentence (unchanged)

> Build the language of fairness — every change must strengthen mandate, ZML, outcomes, or the closed consumer loop. If it does not, it does not ship.

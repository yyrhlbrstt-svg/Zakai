# Scale math — path to ₪ millions/month (honest)

This is **not** a revenue forecast baked into the product. It is the arithmetic founders use to see what has to be true for **₪1M–₪3M fee revenue per month**.

## The only formula that matters

```
Monthly fee revenue (agorot) = Σ documented_saving × fee_rate_bps / 10_000
```

- Default consumer rate: **18%** (`FEE_RATE_BPS = 1800`) on **documented** savings only.
- Pro: **9%**; Max: **0%** (upsell reduces take rate but increases volume/retention).
- **No PayPlus + live keys = ₪0 collected** regardless of SAVED rows (`paymentsFullyLive()`).

## What ₪1M/month actually means

| Fee take (blended) | Documented savings needed / month |
|--------------------|-----------------------------------|
| 18% (mostly Free)  | **~₪5.55M** documented |
| 15% (mix Pro)      | **~₪6.7M** documented |
| 12% (heavy Pro)    | **~₪8.3M** documented |

Examples that sum to ~₪5.5M documented **per month** (illustrative mixes):

- **5,500** telecom wins at **₪100/mo** each (monthly saving field in agorot).
- **550** wins at **₪1,000/mo** (heavy business lines / insurance stacks).
- **~700** lump recoveries averaging **₪8,000** each (deposits, insurance refunds) — one vertical can dominate.

Millions/month is a **volume + conversion + collection** problem, not a missing feature flag.

## Funnel levers (product + ops)

| Stage | What moves it in Zakai |
|-------|-------------------------|
| **Visit → signup** | Home/Money OS CTAs, leaks map, WhatsApp `/share` OG, referrals |
| **Signup → SENT** | SMTP live, Mandate keys, ownership OTP, clear Money OS path |
| **SENT → SAVED** | Inbound proofs, push (VAPID), cron follow-ups (`CRON_SECRET`), one-tap record |
| **SAVED → paid fee** | PayPlus, celebrate banner + `FeePayButton`, dispute window trust copy |
| **Repeat** | Recheck nudges, priority boosted by `StrategyOutcome`, Vigil |

Run `GET /api/release-gate` and `/he/founder` **release score** — consumer launch is gated on SMTP, PayPlus, VAPID, crons.

## GTM that can reach millions (Israel-first)

1. **One killer vertical at scale** — duplicate insurance, bank fees, cancel/subs: paid search + creator “I saved ₪X” with real `/share` cards (no invented amounts).
2. **WhatsApp distribution** — every SAVED user gets share loop; referral credit on next fee.
3. **B2B2C embed** — `embed.js` + partnerRef; banks/fintechs send users with Mandate verify instead of building auth.
4. **Institutional inbound** — JWKS + scoped mandates reduce fraud cost; not consumer marketing.

## What code cannot do alone

- Buy traffic without unit economics (CAC < LTV on **paid fees**, not signups).
- Replace **founder env** (Mandate, SMTP, PayPlus, VAPID, `CRON_SECRET`).
- Guarantee legal outcomes — only document and charge on proof.

## North-star metrics (founder dashboard)

- **SENT → SAVED** win rate (settled cases).
- **PENDING fee agorot** (cash waiting for PayPlus checkout).
- **PAID fee agorot** (actual revenue).
- Leads by vertical → which door gets product polish next.

See also: `docs/IL_REVENUE_PLAYBOOK.md`, `docs/MONEY_OS.md`, `docs/GOLDEN_SHIP_COMPLETE.md`.

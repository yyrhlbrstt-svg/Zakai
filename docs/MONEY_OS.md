# Money OS — make every phone need Zakai

Zakai wins when the phone becomes the **default layer for money leaks and recoveries** — not a tips app, not a call center.

## The one loop (non-negotiable)

```
Scan / upload → Case → Mandate → Send → Inbound proof → One-tap SAVED → Share → Fee (only on proof)
```

Everything in product engineering serves this loop getting **shorter and more automatic**.

## Pillars shipped in code

| Pillar | What it does |
|--------|----------------|
| **Money Hub** (`/money`) | Screenshot/statement → recurring charges → open Cases (batch). Top priority doors on page. |
| **Inbound proofs** | Email to proofs address → AI extract → match SENT case → dashboard proposal → push + deep link `?case=` |
| **Dashboard** | Case state machine, one-tap record saving, share after SAVED, referral credit |
| **Push (PWA)** | `EnablePush` in layout; VAPID required in prod |
| **13 jurisdiction packs** | Rights + letters globally; IL full parity |
| **Mandate + JWKS** | Trust layer for institutions (`/integrations`, MCP) |
| **Outcome graph** | `StrategyOutcome` feeds future priority (deterministic first) |

## What founders must turn on (not code)

- `MANDATE_SIGNING_*`, `CRON_SECRET`, `SMTP_*`, `PAYPLUS_*`, `VAPID_*`
- `node scripts/preflight.mjs` → zero blocking
- Vercel deploy **Ready** on latest `main`

## “100/10” acceptance tests

1. New user: upload bank screenshot on `/money` → Case **SENT** in one session.
2. Forward provider reply to proofs inbox → **push** → open dashboard → **one-tap SAVED**.
3. **Share** after SAVED without staff involvement.
4. Fee charge only after documented saving (integer agorot).

## Institutions & banks (why they need you)

They do not need another consumer app — they need **verifiable inbound authority** without building it:

- Mandate verify/decide/revoke (`/integrations`)
- JWKS at `/.well-known/zakai-jwks.json`
- Read-only opportunity map: `/api/network/opportunity-map`

Consumer adoption pulls institution demand; institution trust pulls consumer trust.

## What we deliberately do not do

- Callback CTAs as primary path
- Invent recovery amounts
- Auto-charge without SAVED proof
- Outbound payment Mandate scopes

See also: `docs/GOLDEN_SHIP_COMPLETE.md`, `docs/IL_REVENUE_PLAYBOOK.md`.

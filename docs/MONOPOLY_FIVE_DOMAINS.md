# Five domains — honest map (code ↔ strategy)

This document aligns the **“natural monopoly” strategy** with what is **shipped in the repo**. We do not claim billions of data points, thousands of developers, or auctions until the APIs and DB say so.

## 1. ZML — consumer rights language

| Claim in strategy | Reality in product |
|-------------------|-------------------|
| “HTML of rights” | `/.well-known/zakai-rights-schema.json`, `GET /api/rights/catalog` |
| 76 IL rights | `GET /api/zml/stats` (live count per market) |
| 500 global in a year | **Roadmap** — add packs via `docs/COUNTRY_PACKS.md` |

**Moat mechanic:** more packs → more integrators on the same schema → more packs.

## 2. Fairness score

| Claim | Reality |
|-------|---------|
| FICO for providers | `GET /api/fairness/scores` — win rate from `StrategyOutcome`, `MIN_SAMPLE` gate |
| Widget on any site | `public/widget/zakai-widget.js` |
| UI | `/companies` |

**Moat mechanic:** scores only improve with documented outcomes — cannot be faked without cases.

## 3. Switching protocol

| Claim | Reality |
|-------|---------|
| “30 seconds” | **Beta** — reference flows, not operator APIs everywhere |
| Spec | `/.well-known/zakai-switching.json` |
| References | `/telecom-exit`, `/cancel`, `/cancel/universal`, `/electricity` |

**Moat mechanic:** Mandate + outbox + follow-ups — institutions learn one inbound format.

## 4. Regulatory intelligence

| Claim | Reality |
|-------|---------|
| Bloomberg for regulators | **Beta** — `GET /api/regulatory/snapshot` + `/api/institution/inbound-pressure` |
| 5 years of data | **Only what exists** in `StrategyOutcome` and cases — no fabrication |

**Moat mechanic:** de-identified aggregates institutions cannot get elsewhere without the consumer loop.

## 5. Collective intent

| Claim | Reality |
|-------|---------|
| NASDAQ of consumers | **Phase 0** — `POST /api/collective/intent`, `GET /api/collective/summary` |
| Auctions | `collective_auction: false` until product + legal sign-off |

**Moat mechanic:** anonymous signals → public counts → future group pricing (not shipped).

---

## Machine entrypoints

- **All five:** `/.well-known/zakai-domains.json` · `GET /api/domains`
- **Interop probe:** `GET /api/interop?probe=1`
- **Human hub:** `/he/domains`

## What founders still must do

- CDN for packs, PayPlus, SMTP, institution pilots, regulator outreach with **real** snapshot PDFs/export.

Network effects are **earned** by usage flowing through these endpoints — not declared in copy.

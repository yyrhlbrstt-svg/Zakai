# Global monopoly playbook — become infrastructure nobody can ignore

**Honest north star:** valuation follows **documented savings volume × mandate adoption × outcome graph depth × multi-issuer trust** — not slide decks. This document is the product law for a global rail. Code mirrors it in `src/lib/monopoly/`.

We do **not** claim we are already a trillion-dollar company. We claim a path where **ignoring Zakai becomes more expensive than integrating it**.

---

## The Visa thesis (consumer authority)

Visa does not issue every card. Visa runs **rules + rails**. Banks issue; merchants accept; consumers carry.

Zakai’s equivalent:

| Visa role | Zakai role |
|-----------|------------|
| Network rules | Protocol laws (`PROTOCOL_LAWS`) + forbidden scopes |
| Issuer | Trust registry + delegated issuers |
| Acquirer / merchant | Institutions that verify Mandate / switching inbound |
| Cardholder | Consumer (or their AI agent) with scoped authority |
| Settlement data | De-identified `StrategyOutcome` graph |

A clone app can copy UI. It cannot copy **years of outcomes + multi-issuer JWKS habit + ZML citations + inbound institutional format**.

---

## Seven rails (must all harden in parallel)

| # | Rail | Why a competitor dies without it | Win condition |
|---|------|----------------------------------|---------------|
| 1 | **Mandate** | AI agents have no verifiable authority elsewhere | ≥2 active registry issuers; banks verify JWKS offline |
| 2 | **ZML** | Rights stay as blog posts / if-country soup | Packs CDN is default for third-party engines |
| 3 | **Outcome graph** | Fairness/oracle empty → no fear, no learning | MIN_SAMPLE real outcomes per major counterparty |
| 4 | **Switching + inbound receive** | Letters stay email spaghetti | Institutions publish “how we accept Mandate inbound” |
| 5 | **Regulatory aggregates** | Supervisors use surveys | Journalists cite `/api/regulatory/snapshot` |
| 6 | **Distribution / agents** | Growth = ads forever | Other AIs hand off via `llms.txt` + embed + referral |
| 7 | **Closed consumer loop** | Fee never collected; trust dies | detect → act → prove → fee → share without callbacks |

Machine status: `GET /api/network/monopoly` · assessment `src/lib/monopoly/sevenRails.ts`.

---

## Control gates G1–G9 (not a valuation)

Honest ladder from protocol skeleton → hard-to-ignore globally. Implemented in
`src/lib/monopoly/trillionGates.ts` · public API `GET /api/network/trillion-gates`.

| Gate | Meaning |
|------|---------|
| G1 | External interop probe green |
| G2 | ZML packs on public CDN |
| G3 | First reference verifier listed |
| G4 | Fairness score with real MIN_SAMPLE |
| G5 | Second active issuer on trust registry |
| G6 | Inbound pressure above public threshold |
| G7 | Two markets with cited depth + consumer volume |
| G8 | Other AIs send measurable handoffs |
| G9 | Commercial phase D live (real PSP + fee volume) |

Companion surfaces:

- One pane for institutions: `GET /api/network/indispensability`
- Institution ops math: `GET /api/institution/ignore-cost`
- Agent distribution manifesto: `/.well-known/zakai-agent-economy.json`
- Fairness Certified (spec): `/.well-known/zakai-fairness-certified.json`
- Consumer must-have kit: `/he/must-have`

**Passing gates in code ≠ controlling the market.** Gates measure readiness;
mass, verifiers, and multi-issuer habit are still real-world work.

---

## Aggressive retention (ethical)

Retention means **the product keeps finishing money paths**, not dark patterns:

1. Scan without open case → sticky CTA + demo (done).
2. Case stuck pre-send → dashboard next-step (done).
3. SENT without reply → follow-up generator (done).
4. SAVED → share + referral credit (done).
5. Household / beneficiary labels → family surface area (done).
6. Vigil + deadlines → time-based re-entry (`retentionEngine`).
7. Re-scan cadence → suggest `/money` after N days without new scan.

Never: fake urgency, callback promises, fabricated savings.

---

## Path to “trillions” (economic logic, not a forecast)

Global consumer leakage (subscriptions, fees, refunds, entitlements) is a **multi-trillion annual flow**. Capturing a thin success fee on **documented** recoveries, while owning the **authority rail** other agents must use, is the only structure that scales without a call center.

Phases (same as `flywheel.ts` + `INDISPENSABILITY_STRATEGY.md`):

- **A Protocol** — copyable standard, empty gravity (now).
- **B Consumer mass** — volume of Mandates + savings proofs.
- **C Institutional** — banks/providers verify because refusing costs more.
- **D Commercial** — PayPlus/SMTP/domain as default settlement, not as the product.

---

## What we refuse

- Fabricated traction or fairness scores below MIN_SAMPLE.
- Outward money-movement Mandate scopes.
- “We’ll call you back.”
- Auction / collective clearing before legal sign-off.

See: `docs/BILLIONS_SCALE_ARCHITECTURE.md`, `docs/INDISPENSABILITY_STRATEGY.md`, `CLAUDE.md`.

# Monopoly execution — all directions in parallel

**Founder intent:** Lead in **every** infrastructure lane — not pick one.  
**Honest constraint:** We still cannot fake volume, scores, or institution logos. Parallel means **multiple code + protocol tracks at once**, not «claim we won».

North star doc: `docs/INDISPENSABILITY_STRATEGY.md`.  
Machine map: `/.well-known/zakai-domains.json` + `/he/domains`.

---

## The stack (6 surfaces + Mandate gravity)

| # | Surface | Win condition (market must need you) | Repo today | Parallel workstream |
|---|---------|--------------------------------------|------------|---------------------|
| 0 | **Mandate** | Every agent/bank verifies authority offline | JWKS, decide, test-vectors, institutions | Institution self-serve, MCP, second implementer |
| 1 | **ZML** | Rights are data, not app logic | 76 IL, catalog, evaluate | External packs repo/CDN, EU depth, SDK |
| 2 | **Fairness** | Providers fear public win-rate | API + widget, empty until sample | MIN_SAMPLE outcomes, embed on partner sites |
| 3 | **Switching** | One inbound format for cancel/switch | switching.json + vertical letters | Operator playbook PDF, mandate on every send |
| 4 | **Regulatory** | Supervisors cite your aggregates | snapshot + inbound-pressure | Export + journalist kit when n>threshold |
| 5 | **Collective** | Demand visible before auctions | intent + summary | Legal gate then auction v1 |
| 6 | **Autopilot** | Packs + law stay fresh without staff | crons, law watcher | Maintainer workflow only — no auto-law-merge |

**Commercial wiring (PayPlus, SMTP, domain)** stays in **phase D** across all rows — gravity first.

---

## Parallel tracks — what to ship in code (no calendar)

### Track 0 — Mandate (gravity under everything)

- [ ] Institution leader wizard → **first real name** on wall (opt-in)
- [ ] `POST /api/mandate/conformance/probe` in institution onboarding email template
- [ ] Publish `zakai-mandate-mcp` discoverability in every integration doc
- [ ] Third-party agent issues via **delegated issuance** (one admitted pilot)

### Track 1 — ZML

- [ ] `zakai-packs` as **standalone publish** (`zakai-packs/scripts/publish.js` + CI)
- [ ] `GET /api/zml/stats` linked from every rights page footer
- [ ] Next market pack with **full legal citations** (not stubs)
- [ ] npm/SDK path documented (`sdk/`, interop profile `rights_catalog`)

### Track 2 — Fairness

- [ ] Widget on **3 partner pages** (register + validate keys)
- [ ] `/companies` shows empty state + «how scores appear» (honest)
- [ ] Fairness Certified program **spec only** (legal review)

### Track 3 — Switching

- [ ] Every outbound case carries verifiable Mandate reference in letter metadata
- [ ] `zakai-switching.json` version bump when a new vertical template ships
- [ ] Telecom + universal cancel as **reference conformance** for institutions

### Track 4 — Regulatory

- [ ] `GET /api/regulatory/snapshot` stable schema + changelog
- [ ] Inbound-pressure API linked from `/institutions` hero
- [ ] One-pager export (JSON → printable) when snapshot non-empty

### Track 5 — Collective

- [ ] Public summary on `/domains` (done UI)
- [ ] Market expander opens GitHub issues from intent thresholds
- [ ] Auction: **blocked** until legal sign-off

### Track 6 — Autopilot

- [ ] Law watcher issues → human review queue (no auto-merge)
- [ ] Price sentinel feeds **documented** consumer tools only

---

## Verification (stay above copy-paste competitors)

```bash
npm run verify:production-urls   # deploy smoke
npm run verify:interop           # protocol probes
npm run verify:monopoly          # all domain endpoints from zakai-domains.json
```

---

## Anti-patterns (instant loss of «above everyone»)

- Fake checks / fake fairness scores / demo outcomes  
- «We work with Bank X» without license or pilot  
- Consumer mass-market launch before **one** institution documents verify path  
- Stripe or non-PayPlus payments without doctrine change  

---

## The sentence

> **Above everyone** means the **union** of Mandate + ZML + outcomes + switching + regulatory signal + collective demand — each honest, each externally testable. Not one feature flag and a press release.

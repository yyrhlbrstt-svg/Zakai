# Monopoly execution — all directions in parallel

**Founder intent:** Lead in **every** infrastructure lane — not pick one.  
**Honest constraint:** We still cannot fake volume, scores, or institution logos. Parallel means **multiple code + protocol tracks at once**, not «claim we won».

North star doc: `docs/INDISPENSABILITY_STRATEGY.md`.  
Machine map: `/.well-known/zakai-domains.json` + `/he/domains`.

---

## The stack (Pipe + 6 surfaces + Mandate gravity)

| # | Surface | Win condition (market must need you) | Repo today | Parallel workstream |
|---|---------|--------------------------------------|------------|---------------------|
| P | **Pipe** | Visa-like Mandate→SavingsProof rails with `gravity_tier=network` | `/.well-known/zakai-pipe.json`, `/api/pipe`, `/he/pipe`, accept/handoff | SMTP + real SENT volume (human) |
| 0 | **Mandate** | Every agent/bank verifies authority offline | JWKS, decide, test-vectors, institutions | Institution self-serve, MCP, second implementer |
| 1 | **ZML** | Rights are data, not app logic | 76 IL, catalog, evaluate | External packs repo/CDN, EU depth, SDK |
| 2 | **Fairness** | Providers fear public win-rate | API + widget, empty until sample | MIN_SAMPLE outcomes, embed on partner sites |
| 3 | **Switching** | One inbound format for cancel/switch | switching.json + vertical letters | Operator playbook PDF, mandate on every send |
| 4 | **Regulatory** | Supervisors cite your aggregates | snapshot + inbound-pressure | Export + journalist kit when n>threshold |
| 5 | **Collective** | Demand visible before auctions | intent + summary | Legal gate then auction v1 |
| 6 | **Autopilot** | Packs + law stay fresh without staff | crons, law watcher | Maintainer workflow only — no auto-law-merge |

**Commercial wiring (PayPlus, domain)** stays in **phase D** — gravity first.  
**SMTP is not phase D theater** — it is required for real SENT (P0 on monopoly loop).

### Track P — Pipe / monopoly gravity

- [x] `zakai-pipe-1` interop + `/.well-known/zakai-pipe.json` + human `/pipe`
- [x] `GET /api/pipe` network volume + `gravity_tier`
- [x] `POST /api/pipe/accept` + `POST /api/pipe/handoff` + acceptor mark
- [x] Seven rails score SENT+ volume; `/api/network/monopoly` includes `monopolyLoop` P0
- [x] Founder + domains + pipe show **MonopolyMissionControl**
- [x] Hosted verify/decide/accept/inbound-receive resolve issuers via **trust registry** (not single-key)
- [x] Agents index `/.well-known/zakai-agents.json` + handoff-first join-kit / llms / MCP tools
- [x] Desk magnets: `pipe_accept` on outreach protocol footer + letter Machine line
- [x] robots.txt Allow for pipe/interop/CDN/join-kit/network APIs
- [ ] Prod: SMTP + merge + Redeploy + real cases until `gravity_tier=network` — **founder**

---

## Parallel tracks — what to ship in code (no calendar)

### Track 0 — Mandate (gravity under everything)

- [x] Institution leader page: conformance panel + test vectors in readiness wizard
- [x] `POST /api/mandate/conformance/probe` in institution onboarding email template (welcome + outbound notices + weekly inbound cron)
- [x] Publish `zakai-mandate-mcp` discoverability in integration docs (`WIDGET_EMBED`, `SWITCHING_REFERENCE_FLOWS`, `INSTITUTION_QUICKSTART`)
- [x] Third-party agent issues via **delegated issuance** — public roster + `POST /api/mandate/delegation/issuers` (admin token; founder admits one pilot)

### Track 1 — ZML

- [x] `/.well-known/zakai-packs.json` + `npm run packs:validate|publish:dry|export`
- [x] ZML footer on `/rights` + stats/catalog links
- [x] Origin CDN mirror `/api/cdn/packs/*` + `npm run verify:packs-cdn` (external or origin)
- [ ] `zakai-packs` pushed to standalone GitHub + CDN `ZML_PACKS_CDN` — founder push after `packs:export`
- [x] US pack deepened with FCRA freeze + TCPA citations (`us.ts` 2026.08.3)
- [x] npm/SDK path documented — `docs/ZML_SDK_INTEGRATION.md` + manifest `sdk` block

### Track 2 — Fairness

- [ ] Widget on **3 partner pages** (register + validate keys) — founder outreach
- [x] `/companies` shows empty state + «how scores appear» (honest)
- [x] Fairness Certified program **spec only** (legal review) — `docs/FAIRNESS_CERTIFIED_PROGRAM.md` + `/.well-known/zakai-fairness-certified.json`

### Track 3 — Switching

- [x] Every outbound case carries verifiable Mandate reference in letter metadata (`mandateJti` + protocol footer)
- [x] `zakai-switching.json` version bump when a new vertical template ships (`SWITCHING_VERSION`)
- [x] Telecom + universal cancel as **reference conformance** — `docs/SWITCHING_REFERENCE_FLOWS.md`

### Track 4 — Regulatory

- [x] `GET /api/regulatory/snapshot` stable schema + changelog
- [x] Inbound-pressure API linked from `/institutions` hero (`RegulatoryIntelStrip`)
- [x] One-pager export (`?format=brief`) when snapshot non-empty or empty counts
- [x] Journalist kit page `/regulatory` + strip link

### Track 5 — Collective

- [x] Public summary on `/domains` (`CollectiveSummaryPanel` + API)
- [x] Market expander opens GitHub issues from intent thresholds (when `GITHUB_TOKEN` + `AUTOPILOT_GITHUB_REPO`)
- [ ] Auction: **blocked** until legal sign-off

### Track 6 — Autopilot

- [x] Law watcher issues → human review queue (no auto-merge) — documented in autopilot manifest
- [x] Price sentinel feeds **documented** consumer tools only — manifest + `AutopilotStatusStrip` on `/domains`

---

## Verification (stay above copy-paste competitors)

```bash
npm run verify:production-urls   # deploy smoke
npm run verify:public-surface    # no health/version/release-gate fingerprinting
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

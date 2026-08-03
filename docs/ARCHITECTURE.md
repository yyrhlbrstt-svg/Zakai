# Zakai — Production Architecture (2026)

> Honest scope: this is the architecture of a **consumer authority + recovery** product designed to become critical infrastructure. Valuation follows documented savings volume, mandate adoption by institutions, and network effects — not slides.

## 1. System purpose

Zakai is a **closed-loop consumer agent**:

```
Detect leak → Rank action → Draft act → Human approve → Mandate/auth → Send →
Follow-up rounds → Document saving → Fee on proof → Share / learn (StrategyOutcome)
```

Hard product laws:

1. No call-center promises (solo / AI ops).
2. Money = integer minor units only (agorot).
3. LLM proposes; application permission layer executes.
4. Mandate scopes are inbound-only (never move money out).
5. Success fee only after `SavingsProof`.

## 2. Logical architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Clients (Web PWA · future native shell)                     │
│ Next.js App Router · next-intl · Tailwind                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│ Edge / App layer (Vercel)                                    │
│  Route Handlers · middleware (locale, session cookie)        │
│  Rate limits · zod validation · no secrets in client         │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌──────────────────────────┐
│ Domain        │ │ Agent plane   │ │ Trust / Mandate          │
│ Cases, Fees,  │ │ askZakai      │ │ Ed25519 JWS · JWKS       │
│ Leads, Rights │ │ negotiation   │ │ Authorization codes      │
│ Priority eng. │ │ OCR extract   │ │ MandateRevocation        │
└───────┬───────┘ └───────┬───────┘ └────────────┬─────────────┘
        │                 │                      │
        └────────────┬────┴──────────────────────┘
                     ▼
            Neon Postgres (Prisma)
            append-only proofs + outcomes
```

## 3. Data flow (telecom success loop)

1. **Ingest** — bill image / manual amount → `analyzeBillImage` or form.
2. **Recommend** — `generateRecommendation` (AI or template) → Case `ANALYZED`.
3. **Approve** — user consents to exact draft → `APPROVED` + Consent row.
4. **Verify** — phone OTP + Authorization document → `VERIFIED`.
5. **Send** — Outbox EMAIL/SMS (or queued) → `SENT`.
6. **Negotiate** — `buildFollowUp(replyKind)` multi-round, written only.
7. **Prove** — user records new amount → `SavingsProof` + Fee PENDING → `SAVED`.
8. **Learn** — de-identified `StrategyOutcome` row (no User/Case FK).
9. **Spread** — share/referral after proof.

## 4. Agentic design (2026 production patterns)

Aligned with production agent practice (tool-first, single-responsibility, HITL, observability):

| Agent role | Responsibility | Tools | HITL gate |
|------------|----------------|-------|-----------|
| **Extractor** | OCR bill / statement | vision model → JSON/CSV | user corrects fields |
| **Strategist** | target price + stance | rule pack + StrategyOutcome priors | user sees strategy |
| **Drafter** | outreach / follow-up | `negotiation.ts`, templates | user must approve send |
| **Coach** | in-app Q&A | `askZakai` + FAQ + playbook | never executes |
| **Prioritizer** | next best action | `priority.ts` | user picks |

**Control plane rule:** the model never holds PSP keys, never marks `SAVED`, never issues Mandate without server path + auth.

**Memory:**
- Short-term: case snapshot in assistant user message.
- Long-term institutional: `StrategyOutcome` aggregates only.
- No vector store required for v1; add when retrieval over rights corpus justifies cost.

## 5. Backend modules (source of truth paths)

| Module | Path |
|--------|------|
| Prisma schema | `prisma/schema.prisma` |
| AI providers + assistant | `src/lib/ai.ts` (system prompt), `src/lib/agentPlaybook.ts` |
| Negotiation | `src/lib/negotiation.ts` |
| Priority ranking | `src/lib/priority.ts` |
| Mandate | `src/lib/mandate/*` |
| Country packs | `src/lib/global/*` |
| Plans / fees | `src/lib/plans.ts` |
| API routes | `src/app/api/**` |

## 6. Frontend structure

- `src/app/[locale]/**` — pages (money, leaks, cancel, check, dashboard, assistant…)
- `src/components/**` — LeadForm (self-serve), CaseNextStep, InstallPrompt, Header
- Messages: `src/messages/{he,en,ar,ru,de,fr}.json`

UX law: every dead-end "we'll call you" is a bug.

## 7. Security

- HTTPS/HSTS; session cookie httpOnly
- Passwords bcrypt; OTP/reset tokens hashed
- RateLimit table for auth endpoints
- Secrets only in Vercel env
- Mandate private JWK never in client or JWKS
- Append-only SavingsProof / Consent / MandateRevocation

## 8. Scalability path

Full billions-scale doctrine: `docs/BILLIONS_SCALE_ARCHITECTURE.md`.

| Stage | Trigger | Move |
|-------|---------|------|
| Solo | <1k active cases | Vercel + Neon free/pro |
| Growth | fee volume | dedicated worker for Outbox; queue |
| Institution | banks verify JWKS | status SLA, key rotation, SOC2-ready logs |
| Multi-market | pack demand | edge config per market; no code forks |
| Planetary read load | fairness/gravity/JWKS hot | CDN + read replicas; Class A cache profiles (`src/lib/scale/publicCache.ts`) |
| Planetary write load | mobile retries / batch scan | `IdempotencyRecord` on case-open APIs (`src/lib/scale/idempotency.ts`) |

Public flywheel index (real counters): `GET /api/network/gravity`.

## 9. What is NOT done (do not claim)

- Full PSP production settlement everywhere
- Session-auth on all mandate issue paths (shared secrets still exist)
- Universal provider API integrations (most paths are letter + user send)
- Trillion-dollar revenue (requires adoption + proof volume)

## 10. Deploy truth

Production domain: `zakai-3uxj.vercel.app`  
If Vercel shows **Ready Stale**, production is not on latest `main` — **Redeploy** the newest commit from `main` and hard-refresh.

# Billions-scale architecture — Zakai protocol plane

This document is the **engineering north star** for serving planetary concurrency without betraying product law (no PII in `StrategyOutcome`, integer money, Mandate inbound-only, LLM proposes / code executes).

It complements `docs/ARCHITECTURE.md` (current product) and `docs/INDISPENSABILITY_STRATEGY.md` (institutional gravity).

---

## 1. Design thesis

| Layer | Role at 10⁹ users | Rule |
|-------|---------------------|------|
| **Edge** | Terminate TLS, locale, cache public reads | No secrets; no DB in middleware |
| **Stateless app** | Route handlers, zod, rate limits | Horizontal scale on Vercel/regions |
| **Postgres (Neon)** | System of record | Pooled `url` + unpooled migrations |
| **Append-only learn** | `StrategyOutcome`, proofs, revocations | Partition-ready keys; no User FK |
| **Async plane** | Outbox, cron, future queue workers | Never block user on SMTP/PSP |
| **CDN** | ZML packs, JWKS, static protocol artifacts | Institutions cache; we version |

**Non-goal:** pretending one Next.js deployment “is” a billion-user system. The path is **progressive hardening** with honest phase gates (`src/lib/scale/tiers.ts`, `src/lib/monopoly/flywheel.ts`).

---

## 2. Traffic classes

```
                    ┌─────────────────────────────────────┐
                    │ Class A — Public read (cacheable)    │
                    │ JWKS, fairness, gravity, ZML catalog │
                    └─────────────────┬───────────────────┘
                                      │ CDN + stale-while-revalidate
                    ┌─────────────────▼───────────────────┐
                    │ Class B — Public write (metered)     │
                    │ scan extract, leads, collective intent│
                    └─────────────────┬───────────────────┘
                                      │ IP + bucket rate limits
                    ┌─────────────────▼───────────────────┐
                    │ Class C — Authenticated mutations    │
                    │ cases, mandate issue, fees           │
                    └─────────────────┬───────────────────┘
                                      │ user rate limit + idempotency
                    ┌─────────────────▼───────────────────┐
                    │ Class D — Institution / cron         │
                    │ inbound digest, evolve, autopilot      │
                    └─────────────────────────────────────┘
                                      │ CRON_SECRET / admin token
```

Implementation map:

- Rate limits: `src/lib/ratelimit.ts` (Postgres windows, fail-open on DB blip).
- Idempotency: `src/lib/scale/idempotency.ts` + `IdempotencyRecord`.
- Cache policy helpers: `src/lib/scale/publicCache.ts`.
- Throughput budgets: `src/lib/scale/throughputBudgets.ts`.
- Outbox worker: `OUTBOX_ASYNC` + `GET /api/cron/outbox` (`src/lib/workers/outboxDeliver.ts`).
- Read replica: `NEON_DATABASE_URL_READ_REPLICA` → `prismaRead` for fairness/gravity/oracle.

---

## 3. Data partitioning (before you shard)

`StrategyOutcome` and collective signals are **already** designed for publishable aggregates. At extreme scale:

1. **Logical partition key** — `market:vertical:counterparty` (`src/lib/scale/partition.ts`).
2. **Read replicas** — fairness/oracle/regulatory APIs read from replica; writes stay on primary.
3. **Physical shards** — only when single-node Postgres ceases to be cost-effective; partition key becomes shard routing.

Never attach User/Case FK to the learn tables — that single mistake blocks regulator publish and partner embed forever.

---

## 4. Monopoly flywheel (code + ops)

Network depth is not a marketing slide; it is **measurable gravity**:

| Flywheel leg | Mechanism | Code |
|--------------|-----------|------|
| **Learn** | De-identified outcomes improve oracle/fairness/priority | `StrategyOutcome`, `priorityOutcomeBoost.ts` |
| **Spread** | Share after scan (honest) and after SAVED (proof) | `scanShare.ts`, `ShareResult.tsx` |
| **Mandate** | Verifiable authority; multi-issuer registry | `trustRegistry.ts`, `DelegatedIssuer` |
| **Institution** | Inbound pressure + switching metadata | `outreachSwitchingMeta.ts`, institution cron |

Public index (real counts only): `GET /api/network/gravity` — see `src/lib/services/networkGravity.ts`.

Phases: `src/lib/monopoly/flywheel.ts`.

---

## 5. Competitor barriers (honest)

What a clone app **cannot** copy in a weekend:

1. **Append-only outcome graph** at scale (time + trust).
2. **Issuer network** — JWKS + delegated pilots + conformance probes institutions run.
3. **ZML packs** with legal citations per market (data moat, not UI).
4. **Switching + Mandate** on every outbound artifact (protocol habit).
5. **Regulatory aggregates** sourced only from documented pipeline (no survey theater).

What we **do not** claim: exclusive legal rights, guaranteed bank integrations, or fabricated traction.

---

## 6. Operational checklist (production)

- [ ] `NEON_DATABASE_URL` pooled in app; unpooled for migrate only.
- [ ] `CRON_SECRET` set in production (fail-closed crons).
- [ ] Mandate keys from env; rotation runbook documented.
- [ ] Idempotency TTL purge via `purgeExpiredIdempotencyRecords` (cron/evolve).
- [ ] Public surface verified: `npm run verify:public-surface`.
- [ ] After schema change: `npx prisma migrate deploy`.

---

## 7. Load testing stance

Before shouting “billions”:

1. Soak **Class A** endpoints at the edge (JWKS, gravity) — expect 99%+ cache hit.
2. Soak **Class C** with idempotent retries — duplicate `Idempotency-Key` must not double-open cases.
3. Measure **Outbox** backlog — growth phase moves dispatch to dedicated workers.

See `src/lib/scale/throughputBudgets.ts` for per-class default budgets (tune per environment).

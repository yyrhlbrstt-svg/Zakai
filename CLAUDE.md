# Zakai — Agent Coordination (Claude Code / any coding agent)

This file is the **only** architectural source of truth for autonomous development.
Read it before every non-trivial change.

**Cursor operating law:** `docs/INFRASTRUCTURE_DOCTRINE.md` — Zakai is rails (Mandate + SavingsProof), not “another consumer app.” Every change must tighten the IL closed loop, raise Mandate/SavingsProof volume, or make institutions/agents adopt the open format. If it does none of those, do not ship it.

### Decisive filter (final operating rule)

Do **not** make Zakai impressive in many small ways. Make it **decisive** in a few critical ways.

At every decision, all four must be asked — if the honest answer is no to all, **do not ship**:

1. Does this help more users **finish the loop**?
2. Does this create more **documented SavingsProofs**?
3. Does this make Zakai **harder to replace**?
4. Does this increase **real pressure on institutions** over time?

Zakai wins by becoming the **default system for getting money back** — not a large collection of tools. Prefer depth on the closed loop over feature count.

## Product thesis

Zakai recovers money people are already losing or owed, and finishes the path **in-app** without a human callback team.

**Institutions:** inbound only — public Mandate/registry/MCP/`llms.txt` so banks and fintechs **find and call us**; no outbound sales desk. See `docs/INBOUND_INSTITUTIONS.md`.

Long-term assets (in priority order):

1. **Mandate infrastructure** — scoped, signed, JWKS-verifiable authority (inbound-only).
2. **Outcome graph** — de-identified `StrategyOutcome` rows that improve the next claim.
3. **Country packs** — jurisdiction as data (`src/lib/global`), not `if (country === "IL")` soup.
4. **Closed consumer loop** — detect → act → prove → fee → share.

A PR that does not strengthen at least one of these is usually the wrong PR.

## Non-negotiables

1. Never fabricate amounts, eligibility, or legal claims.
2. Money in **integer agorot / minor units** only — never float for fees.
3. No outward money-movement Mandate scopes (`FORBIDDEN_SCOPES`).
4. `StrategyOutcome` must stay de-identified (no User/Case FK).
5. LLM **proposes**; product code **executes** after explicit user action.
6. Never promise "we will call you back" in UI or agent copy.
7. Mandate signing keys only from env — never ephemeral prod keys.
8. User-facing strings via next-intl; he.json first.

## Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind, next-intl (he/en/ar/ru)
- Prisma 6 + Neon Postgres (`NEON_DATABASE_URL`, `NEON_DATABASE_URL_UNPOOLED`)
- AI: Anthropic primary; DeepSeek/OpenAI-compat; Gemini; optional Ollama (`src/lib/ai.ts`)
- Mandate: Ed25519 JWS + JWKS at `/.well-known/zakai-jwks.json`
- Hosting: Vercel project `zakai-3uxj`

## Repository map

| Path | Role |
|------|------|
| `prisma/schema.prisma` | Persistence truth |
| `src/lib/ai.ts` | OCR, recommendation, assistant |
| `src/lib/agentPlaybook.ts` | Solo-ops doctrine injected into assistant |
| `src/lib/negotiation.ts` | Multi-round written follow-ups |
| `src/lib/priority.ts` | Next-best-action ranking |
| `src/lib/mandate/` | Issue / verify / scopes |
| `src/lib/global/` | Market packs |
| `src/components/LeadForm.tsx` | Self-serve actions (not callback form) |
| `src/components/CaseNextStep.tsx` | Status-driven dashboard actions |
| `src/app/[locale]/money` | Money hub |
| `src/app/[locale]/leaks` | Leaks map |
| `src/app/[locale]/cancel` | Subscription cancel letters |
| `src/app/api/**` | All mutations |
| `docs/ARCHITECTURE.md` | Full system design |
| `docs/PROGRESS.md` | Running log: what shipped, what blocks it, what to do next |
| `docs/LOCAL_LOOP.md` | Run the app for real and prove the loop in a browser |
| `docs/INFRASTRUCTURE_DOCTRINE.md` | Product laws |
| `docs/AGENT_NEGOTIATION.md` | Negotiation agent behavior |
| `docs/COUNTRY_PACKS.md` | How to add a jurisdiction to `src/lib/global/` |

## Coding conventions

- TypeScript strict; prefer `zod` at API boundaries.
- Server-only secrets: `import "server-only"` where applicable.
- Client components only when interactivity requires it.
- No `any` for money or auth paths.
- Tests: Vitest for pure functions (negotiation, priority, mandate scopes).
- Commits: focused; one concern per commit when possible.

## How to extend (checklist)

### New self-serve vertical page
1. Page under `src/app/[locale]/…`
2. Link from `priority.ts` and/or Header TOOLS
3. Hebrew + English copy (inline or messages)
4. Path to action (letter / check / external official tool) — never empty CTA

### New negotiation reply kind
1. Add to `ProviderReplyKind` + `REPLY_KIND_OPTIONS`
2. Full body template in `buildFollowUp`
3. Update UI that lists kinds

### New Mandate scope
1. Closed set in `scopes.ts` + tests
2. Never free-text scopes from client

### New market
See `docs/COUNTRY_PACKS.md` for the full process. Short version:
1. `src/lib/global/packs/xx.ts` — every right needs a real citation
2. Register in `registry.ts`'s `MARKETS`
3. `npx vitest run src/lib/global/engine.test.ts` — validates every registered pack automatically

## Env checklist (production)

```
NEON_DATABASE_URL=
NEON_DATABASE_URL_UNPOOLED=
ANTHROPIC_API_KEY=          # or DEEPSEEK_API_KEY / GEMINI_API_KEY
MANDATE_SIGNING_KID=zakai-2026-1
MANDATE_SIGNING_JWK=<Ed25519 private JWK JSON>
MANDATE_ISSUE_KEY=
MANDATE_REVOKE_KEY=
MANDATE_ISSUER=https://zakai-3uxj.vercel.app

# Cron authentication. In production every /api/cron/* endpoint fails closed
# (503) until this is set — the alternative was crons anyone on the internet
# could trigger, which is the state production was actually found in. Vercel
# sends the value automatically as a Bearer header once the env var exists.
CRON_SECRET=

# Collecting the success fee. Without PAYMENT_PROVIDER set to a real PSP,
# src/lib/payments/index.ts silently runs the `mock` provider: the whole
# checkout flow works end-to-end, but no real money ever moves and no card
# data is ever collected. Get this wrong and the product can operate for
# months on paper while charging nobody.
PAYMENT_PROVIDER=payplus
PAYPLUS_API_KEY=
PAYPLUS_SECRET_KEY=
PAYPLUS_PAYMENT_PAGE_UID=
PAYPLUS_BASE_URL=            # optional; sandbox vs production

# Reaching a human. Without SMTP_HOST nothing leaves the system: every message
# stays QUEUED in the Outbox. Leads are persisted before any mail is attempted,
# so nothing is lost either way — but nobody is told an enquiry arrived, and an
# enquiry nobody reads for a week is very nearly one that never came.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Zakai <no-reply@yourdomain>
SALES_EMAIL=        # institutional enquiries; falls back to the founder address
LEADS_EMAIL=        # consumer leads; falls back to the founder address
FEEDBACK_EMAIL=     # falls back to the founder address

# A privilege, not a destination — it opens /he/founder, which lists every
# lead's contact details. No code default on purpose, and naming an address
# here is necessary but not sufficient: the account must also have proved it
# controls that address (see email verification below), so an attacker who
# registered it first still gets nothing.
ADMIN_EMAIL=

# Open Banking. `mock` (default) serves fixture data through the same
# interface the real provider will use — every figure it produces is labelled
# as demonstration data on screen, and the E2E fails if that label is missing.
# Setting `finanda` without all three credentials does NOT crash: it falls
# back to mock and says so loudly in the logs, because the alternative is a
# deploy where the money page is a stack trace.
OPEN_BANKING_PROVIDER=mock
FINANDA_BASE_URL=
FINANDA_CLIENT_ID=
FINANDA_CLIENT_SECRET=

# Optional read replica for fairness / gravity / oracle aggregates (Neon read-only URL).
# NEON_DATABASE_URL_READ_REPLICA=

# When true, email/SMS stay QUEUED until GET /api/cron/outbox drains them.
# OUTBOX_ASYNC=true
```

Email verification gates **privilege, never basic use**. A person can sign up,
see what they are owed and generate letters without confirming their address —
putting a mailbox round-trip in front of that is the friction the whole design
exists to remove. What an unverified address cannot do is hold an
administrative role, because that is the only place the difference between
"typed an address" and "controls an address" costs somebody else something.

Run `node scripts/preflight.mjs` before believing any of this is set. It
separates blocking from degrading and warns about an address on a reserved
domain — a wrong address passes every check, is accepted by the transport, and
discards the message silently.

## Deploy protocol (critical)

1. Push to `main`.
2. Vercel must build the **new** commit. If UI shows **Ready Stale**, production is lagging — Redeploy latest `main`.
3. Verify: `/he/leaks`, `/he/cancel`, `/he/start` (self-serve, not phone callback form), `/.well-known/zakai-jwks.json`.
4. Never tell the founder "it's live" without those checks.

## Definition of done — case loop

- [ ] ANALYZED shows recommendation
- [ ] APPROVED stores consent timestamp
- [ ] VERIFIED has ownership + Authorization code
- [ ] SENT creates Outbox row
- [ ] Follow-up generator works without staff
- [ ] SAVED creates SavingsProof + Fee
- [ ] Share path available after SAVED

## Anti-patterns (reject)

- Callback lead forms as primary CTA
- Floating-point fee math
- Agent that claims it already filed with a government body when it only drafted text
- Fake traction metrics in UI
- Rewriting the whole app when a module fix suffices
- Many small “impressive” features that do not finish loops or write SavingsProofs
- Tool sprawl that dilutes `/money` → Case → Mandate → proof as the default path

## Autonomous agent workflow

When asked to "build everything":

1. Read this file + `docs/ARCHITECTURE.md` + the decisive filter above.
2. Inspect existing modules; extend, don't duplicate.
3. Ship vertical slices (one closed path) over sprawling unfinished pages.
4. Keep production deployable after every merge.
5. Prefer deterministic playbooks (`negotiation.ts`) alongside LLM drafts.
6. Ruthlessly cut anything that fails the four decisive questions.

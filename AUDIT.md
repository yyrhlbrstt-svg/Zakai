# ZAKAI — Phase 0 Audit

Produced as Phase 0 of the Master Build Prompt ("Representation Layer of the Agent
Economy"). Facts as of `main` @ `ee1a16d` (2026-08-19). No refactoring was done
during this audit. Where the master plan assumes something is missing and it in
fact exists, this document says so with file paths — the plan should be read
against this reality, not against a greenfield.

Verification basis: `npx tsc --noEmit` clean, `npx vitest run` green
(384 test files), `npx next build` green, plus the live E2E loops exercised
earlier in this build cycle (case open → approve → draft; mandate issue →
pipe accept → revoke → deny; conformance probe end-to-end).

---

## 1. Surface inventory

- **141 pages** under `src/app/[locale]/` (6 locales: he, en, ar, ru, de, fr;
  RTL for he+ar via `dir` map in `src/i18n/config.ts`, `next-intl` throughout).
- **172 API routes** under `src/app/api/`. **48 have a sibling `*.test.ts`**;
  most business logic lives in `src/lib/**` which carries the bulk of the
  **384 test files** (unit + property-style + golden-ish letter tests).
- **43 Prisma models** in `prisma/schema.prisma` (Neon Postgres).
- Route-level dead-end/broken-link audits are mechanized:
  `scripts/verify-buttons.mjs` + `scripts/deadEndBaseline.json` +
  `src/lib/typeScale`/`jsxHygiene`/`claimsHonesty` ratchet tests.

Real vs. decorative: every consumer tool page reachable from nav/TOOLS was
swept this cycle (interaction sweep, task log). The known soft spot is not
"decorative pages" but **calculator-only tools**: `src/lib/toolsCatalog.ts`
lists 93 tools of which 29 are `agentic: true` (open a real Case); the rest
compute/inform without a case exit. That is a product-depth gap, not fake UI.

## 2. The four atoms — what exists, where

### KNOW — Rights Graph (partial)
- `src/lib/global/` — market packs ("jurisdiction as data"), every right
  carries a real citation; `engine.test.ts` validates every registered pack.
- `src/lib/verticals/packs.ts` + `types.ts` — `VerticalRulePack` engine,
  14+ packs, `regulated` flag exists (never yet flipped to full).
- Rights catalog API: `src/app/api/rights/catalog`, `rights/evaluate/[id]`.
- Recipient directories exist as verified modules with sources:
  `src/lib/telecomContacts.ts`, `bankContacts.ts`, `utilityContacts.ts`,
  regulator directory in `src/lib/complaintEscalation.ts` (Bank of Israel /
  MoC / Consumer Protection Authority, each with `checked July 2026` notes).
- **Missing vs. §6.1:** the unified typed `Right` schema (machine predicates,
  remedy formulas, `capMinor`, `lastVerifiedAt` per entry, single recipient
  directory with versioning). Today the same knowledge is spread across packs,
  contact modules, and letter builders. Phase 1's real job is consolidation
  into one schema — not invention.

### MAY — Mandate (strongest layer; near-complete)
- Core: `src/lib/mandate/mandate.ts` — EdDSA JWS issue/verify (offline,
  JWKS), alg allowlist, audience/nbf/exp checks. 25/25 signed test vectors
  pass (`/api/mandate/ready`).
- Issuance: `/api/mandate/issue` (first-party key + delegated issuers via
  `delegation.ts`, hashed keys, scope ceilings). Sandbox issuer with
  structural containment: `src/lib/mandate/sandbox.ts` (+ demoable
  revocation via `/api/mandate/sandbox/status-list.json`).
- Verification: `verifyWithRegistry.ts` (trust registry gate),
  `src/lib/pipe/acceptMandate.ts` (`/api/pipe/accept` one-shot),
  `/api/mandate/verify`, `/api/mandate/decide`.
- Revocation: live (`/api/mandate/status/[jti]` POST, `MANDATE_REVOKE_KEY`)
  **and** offline via IETF-style signed status list
  (`src/lib/mandate/statusList.ts`, `/api/mandate/revocations`,
  1M-bit capacity in `statusIndex.ts`). Verified end-to-end this cycle:
  issue → accept(permit) → revoke → accept(deny: revoked).
- Forbidden scopes: `src/lib/mandate/scopes.ts` — closed scope set +
  `FORBIDDEN_SCOPES` enforced at issuance AND verification (single shared
  module, exactly as §4.4 demands), tested in `noOutwardMoney.test.ts`.
- Conformance: third-party self-test at `/api/mandate/conformance/probe`
  (`probe.ts`) — accepts/rejects tampered, wrong-audience, revoked, expired.
  SDK + reference verifiers under `sdk/` and `reference/`.
- **Missing vs. §6.3:** W3C VC envelope + claims-mapping doc; `caps`
  (max-amount/max-cases) claim. Both are additive.

### DO — Execution Rails (functional, not yet a formal FSM)
- Case lifecycle statuses exist (ANALYZED → APPROVED → VERIFIED → SENT →
  SAVED…) with `src/lib/services/cases.ts`, express open + mandate send
  (`expressCaseOpen.ts`), plan-tier queue priority
  (`followUpPriority.ts`), cron nudges (`/api/cron/nudges`).
- Letters: deterministic builders (no LLM in the legal path):
  `cancelLetter.ts` (now §31a-armed, see below), `negotiation.ts`
  (multi-round playbooks incl. `promise_broken`), per-vertical letter
  templates in case routes, shared intake factory
  (`src/lib/services/reasonBasedCaseIntake.ts`).
- **Written-demand compliance (§4.6): shipped this cycle.** `src/lib/legalTeeth.ts`
  — cancellation letters now cite חוק הגנת הצרכן §13ד and state on their face
  that they constitute the written demand required by §31a(b), with the
  ₪10,000 exemplary-damages exposure stated as what the statute says
  ("בית המשפט רשאי"), sources verified before drafting. Follow-up builder for
  continued-billing-after-notice included. (PR #162.)
- Escalation: `complaintEscalation.ts` (regulator letters, verified bodies),
  deadline logic in `src/lib/vigil/deadlines.ts`.
- **Missing vs. §6.2:** transitions-only FSM with per-transition ledger
  events; user-visible deadline countdown ("provider has 9 days left");
  **small-claims package generator** (prefilled form data + chronological
  evidence bundle + computed statutory damages as one PDF+JSON) — this is
  the highest-value missing artifact on the whole map; counsel-handoff
  export.

### PROVE — Proof Ledger (partial)
- `SavingsProof` + `Fee` models exist; fee math integer-agorot only;
  confirm flow at `/api/saving/confirm`; inbound proposals require explicit
  user confirmation. "What was done in my name" exists
  (`src/lib/services/visibleWork.ts` + authorization export).
- Public aggregates are computed from the DB at request time, gated by
  statistical-honesty minimums (`MIN_SAMPLE = 5` in `companyScore.ts` /
  fairness; `MIN_TRIALS = 3` in `strategy/insights.ts`); empty states say
  zero (`/api/network/*`, `gravityLoop.ts`, `loadPipeNetwork.ts`).
  Copy-level honesty is ratcheted by `claimsHonesty.test.ts`.
- **Missing vs. §6.4:** hash-chained append-only event log
  (`payloadHash/prevHash/sig`) and a mechanically enforced dispute window
  on public aggregates. Today's ledger is honest but trusts the DB; §6.4
  makes it tamper-evident to strangers.

## 3. Phase-0 plumbing items — status

| Item | Status |
|---|---|
| Outbound email behind adapter | EXISTS — `src/lib/messaging` (SMTP adapter) + Outbox model; unsent stays `QUEUED`. **Blocked on SMTP credentials (founder action; #1 blocker per `gravityLoop.ts`).** |
| Inbound reply → case timeline | EXISTS — `/api/inbound-email` webhook: matches by authorization code or principal email, attaches to case, proposes saving; user confirms; tested. |
| Approval gate in code | EXISTS — sends require explicit user action + verified email (`tryExpressMandateSend` checks `emailVerifiedAt`); LLM proposes / product executes doctrine enforced across case routes. No autonomous send path exists. |
| `/status` measured not asserted | EXISTS — `src/app/[locale]/status/page.tsx` + `serviceStatus.ts`, measured per request, `force-dynamic`. |
| Personal email out of user flows | **PARTIAL / by design** — `src/lib/contact.ts` documents why the founder inbox is the *fallback floor* (RFC-2606 placeholder addresses silently eat mail). Env always wins. Resolution is configuration (`NEXT_PUBLIC_SUPPORT_EMAIL`, `LEADS_EMAIL`, `SALES_EMAIL`, `FEEDBACK_EMAIL` on a real domain), **not** deleting the floor. One code-level surface to swap after config exists: `src/lib/mandate/document.ts` embeds `FOUNDER_EMAIL`. |
| Staging loop draft→approved→sent→reply | draft→approved proven E2E locally this cycle; `SENT` + real reply attach require SMTP + a domain mailbox → founder credentials. |

## 4. Secrets / config (from `CLAUDE.md` + `scripts/preflight.mjs`)

Blocking for the loop: `SMTP_*` (nothing leaves Outbox without it — the
single highest-leverage unlock), `MANDATE_SIGNING_JWK`/`KID` (production
mandate signing), `ADMIN_EMAIL` (+ email verification) for /founder,
`CRON_SECRET` (crons fail closed without it — correct), `AUTH_SECRET`.
Deliberately deferred: `PAYMENT_PROVIDER`/PayPlus (`hold_phase_d`,
priority 99 in `gravityLoop.ts` — collection stays off, matching §6.4's
"collection OFF behind a flag"). Run `node scripts/preflight.mjs` before
trusting any of this in an environment.

## 5. Conflicts between the master prompt and shipped reality — need a founder decision

1. **§4.8 "five verticals only, freeze the rest".** 29 agentic verticals and
   93 tools are live, built under earlier direction. Freezing/hiding them is a
   product decision with user-facing consequences — not executed as part of
   this audit. Options: (a) hard-hide behind a flag, (b) keep live but freeze
   *new* verticals (zero new ones until Phase 6 — enforceable in review), (c)
   full freeze as written. Recommendation: (b); the five named domains get the
   Phase-1 Rights-Graph depth first either way.
2. **§4.9 personal email.** See §3 above — the code's documented trade-off is
   sound; the finishing move is DNS/mailbox configuration only the founder can
   do. Deleting the fallback without it silently discards real enquiries.
3. **§5 monorepo `/packages` split.** Valuable, but a mechanical migration of
   a working app; scheduled incrementally per-phase (each phase moves only the
   code it touches), never as a big-bang.

## 6. What Phase 1 should actually do (given the above)

Consolidate — don't reinvent: define the §6.1 `Right` schema + predicate
evaluator + recipient directory **as the new single home**, then migrate the
five named domains' knowledge out of `global/packs`, contact modules, and
letter builders into it, with `verified`/`draft` status and a loader test
proving `draft` can never reach the letter engine. The §31a ladder shipped in
`legalTeeth.ts` becomes the first fully-graphed right
(`il.consumer.31a.continued-billing-after-cancellation`).

---

*Update log: created at Phase 0 (2026-08-19), `main` @ `ee1a16d`.*

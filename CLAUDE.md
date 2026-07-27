# Zakai — Agent Coordination

This file is the source of truth for any coding agent (Claude, Grok, Copilot) working on this repository. Read it before changing architecture, money logic, or Mandate code.

## Product thesis

Zakai finds money a person is already owed (unclaimed benefits, overcharges, rights) and finishes the claim in-app. The long-term asset is not the UI — it is:

1. **Mandate infrastructure** — signed, scoped, audience-bound authority institutions verify offline via JWKS.
2. **Outcome graph** — anonymised StrategyOutcome rows that improve the next claim (network effect).
3. **Country packs** — jurisdiction as data, not hard-coded Israeli closures.

A feature that does not strengthen one of these three is usually the wrong feature.

## Stack

- Next.js App Router, TypeScript, Tailwind, next-intl (he / en / ar / ru)
- Prisma + Neon Postgres
- Money: **integer agorot / minor units only** (never float)
- Mandate: Ed25519 JWS (`src/lib/mandate/`), public JWKS at `/.well-known/zakai-jwks.json`

## Non-negotiables

1. **Never fabricate amounts, eligibility, or legal claims.** Prefer "varies" / unknown over a made-up number.
2. **No outward money movement scopes** on Mandates (`FORBIDDEN_SCOPES` in `scopes.ts`).
3. **StrategyOutcome must stay de-identified** — no FK to User or Case.
4. **Password reset and auth errors** must never leak whether an email exists beyond what the existing flow already does.
5. **Mandate keys** come only from env (`MANDATE_SIGNING_JWK`, `MANDATE_SIGNING_KID`). Never generate ephemeral signing keys in production paths.
6. **i18n**: user-facing strings go through next-intl message files; incomplete locales deep-merge from Hebrew.

## Layout map

| Path | Role |
|------|------|
| `src/lib/mandate/` | Issue / verify / scopes / JWKS helpers |
| `src/lib/global/` | Country packs + registry (IL, GB, US) |
| `src/lib/rights*.ts` | IL rights catalog + actions |
| `src/app/.well-known/zakai-jwks.json/` | Public verification keys |
| `src/app/api/mandate/status/` | Revocation / recency for institutions |
| `src/app/api/mandate/issue/` | Issue signed Mandate JWS |
| `src/messages/{he,en,ar,ru}.json` | UI catalogs |
| `prisma/schema.prisma` | Source of truth for persistence |

## How to extend

- **New country**: add `src/lib/global/packs/xx.ts`, register in `registry.ts`. Do not fork the eligibility engine.
- **New right (IL)**: data in the rights catalog + action in rightsActions — no dead "Zakai will handle it" buttons.
- **New Mandate scope**: add to the closed set in `scopes.ts` with tests; never accept free-text scopes.
- **New UI strings**: add keys to he.json first, then en/ar/ru; missing keys fall back via deepMerge.

## Env — Mandate

```
MANDATE_SIGNING_KID=zakai-2026-1
MANDATE_SIGNING_JWK=<Ed25519 private JWK JSON>
MANDATE_ISSUE_KEY=<secret for POST /api/mandate/issue>
MANDATE_REVOKE_KEY=<secret for POST /api/mandate/status/[jti]>
MANDATE_ISSUER=https://zakai-3uxj.vercel.app
```

JWKS must serve only the public half. Private `d` never leaves the server.

## DB

Apply `prisma/migrations/20260727_mandate_revocation/migration.sql` on Neon if migrate is not run in CI.

## Institutional trust checklist

- [x] JWKS live and cacheable
- [x] Status endpoint returns active/revoked by `jti`
- [x] Issue API returns JWS + jti + status path
- [x] Markets: IL, GB, US (data packs)
- [x] UI locales active: he, en, ar, ru (partial ar/ru, deep-merge fallback)
- [ ] Product UI wires issue Mandate into case APPROVED flow
- [ ] Session-auth on issue/revoke (replace shared secrets)
- [ ] Full ar/ru message catalogs
- [ ] ES/FR/DE packs when demand signal justifies

## Definition of done for a new market

1. Pack file with cited rights and letter templates in `docLocale`
2. Registered in `MARKETS`
3. At least one e2e path: profile → matches → letter or tool
4. No `if (market === "XX")` branches outside the pack/registry

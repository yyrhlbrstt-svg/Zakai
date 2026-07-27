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
- Money: **integer agorot only** (never float)
- Mandate: Ed25519 JWS (`src/lib/mandate/`), public JWKS at `/.well-known/zakai-jwks.json`

## Non-negotiables

1. **Never fabricate amounts, eligibility, or legal claims.** Prefer "varies" / unknown over a made-up number.
2. **No outward money movement scopes** on Mandates (`FORBIDDEN_SCOPES` in `scopes.ts`).
3. **StrategyOutcome must stay de-identified** — no FK to User or Case.
4. **Password reset and auth errors** must never leak whether an email exists beyond what the existing flow already does.
5. **Mandate keys** come only from env (`MANDATE_SIGNING_JWK`, `MANDATE_SIGNING_KID`). Never generate ephemeral signing keys in production paths.
6. **i18n**: user-facing strings go through next-intl message files; do not hard-code Hebrew in components unless the string is already a message key.

## Layout map

| Path | Role |
|------|------|
| `src/lib/mandate/` | Issue / verify / scopes / JWKS helpers |
| `src/lib/global/` | Country packs + registry |
| `src/lib/rights*.ts` | IL rights catalog + actions |
| `src/app/.well-known/zakai-jwks.json/` | Public verification keys |
| `src/app/api/mandate/status/` | Revocation / recency for institutions |
| `prisma/schema.prisma` | Source of truth for persistence |

## How to extend

- **New country**: add a pack under `src/lib/global/packs/`, register it, add message namespaces. Do not fork the eligibility engine.
- **New right (IL)**: data in the rights catalog + action in rightsActions — no dead "Zakai will handle it" buttons.
- **New Mandate scope**: add to the closed set in `scopes.ts` with tests; never accept free-text scopes.
- **Agent changes**: prefer small PRs; one concern per commit; keep comments explaining *why*, not *what*.

## Env required for Mandate

```
MANDATE_SIGNING_KID=zakai-2026-1
MANDATE_SIGNING_JWK=<Ed25519 private JWK JSON>
```

JWKS must serve only the public half. Private `d` never leaves the server.

## Definition of done for institutional trust

- [x] JWKS live and cacheable
- [ ] Status endpoint returns active/revoked by `jti`
- [ ] Issue path persists `jti` for later revocation
- [ ] Bank can verify signature offline + status online without a Zakai login

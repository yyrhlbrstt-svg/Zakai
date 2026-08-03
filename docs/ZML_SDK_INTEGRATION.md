# ZML + SDK integration path

**Audience:** partners embedding rights data, institutions verifying mandates, maintainers publishing packs.

## Mandate SDK (verification + decide)

| Asset | Location |
|-------|----------|
| Source | `sdk/` in this monorepo |
| Package name (future npm) | `@zakai/mandate-sdk` |
| MCP binary | `zakai-mandate-mcp` (`npm run build` in `sdk/`, then `node dist/mcp-bin.js`) |
| Interop profile | `zakai-mandate-verifier-1` in `/.well-known/zakai-interop.json` |
| Live probes | `GET /api/interop?probe=1` |

Read `sdk/README.md` for verify, decide, settlement, and `probeIssuer()`.

## ZML rights catalog (data, not app logic)

| Asset | URL / command |
|-------|----------------|
| Packs manifest | `GET /.well-known/zakai-packs.json` |
| Schema | `GET /.well-known/zakai-rights-schema.json` |
| Catalog API | `GET /api/rights/catalog?market=IL` |
| Evaluate | `POST /api/rights/evaluate/{id}` |
| Interop profile | `zakai-rights-catalog-1` |
| Validate packs | `npm run packs:validate` |
| Export standalone repo | `npm run packs:export` → `docs/INFRA_ZAKAI_PACKS.md` |
| CDN env | `ZML_PACKS_CDN` (default `https://packs.zakai.io`) |

## Delegated issuance (one pilot at a time)

Agents without their own JWKS:

1. Apply: `POST /api/mandate/delegation/apply`
2. Founder admits: `node scripts/admit-delegated-pilot.mjs` (see env vars in script header)
3. Public roster: `GET /api/mandate/delegation/issuers`
4. Issue: `POST /api/mandate/issue` with `X-Zakai-Issue-Key` — mandates carry `zkm.onBehalfOf`

Full issuers with own keys belong in the trust registry (`ZAKAI_EXTRA_ISSUERS_JSON` after conformance).

## Institution onboarding email

Reference Verifier registration sends a welcome message including `POST /api/mandate/conformance/probe` instructions (`src/lib/institutionVerifierOnboardingEmail.ts`).

# ZML + SDK integration path

**Audience:** partners embedding rights data, institutions verifying mandates, maintainers publishing packs.

## Mandate SDK (verification + decide)

| Asset | Location |
|-------|----------|
| Source | `sdk/` in this monorepo |
| Package name (future npm) | `@zakai-app/mandate-sdk` |
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
| Sync registry → `zakai-packs/` | `npm run packs:sync` (all markets) or `npm run packs:sync -- US GB` |
| Export standalone repo | `npm run packs:export` → `docs/INFRA_ZAKAI_PACKS.md` |
| CDN env | `ZML_PACKS_CDN` (default `https://packs.zakai.io`) |
| Origin mirror | `GET /api/cdn/packs/<market>/index.json` |
| Verify surface | `npm run verify:packs-cdn` |

### 30-minute foreign engine path

1. Clone / copy `zakai-packs/` (or hit origin CDN mirror).
2. `cd zakai-packs && npm ci && npm run validate`.
3. Load `packs/us/index.json` + rights JSON (or IL) into your evaluator — schema in `schema/zakai-rights-schema.json`.
4. Cross-check live catalog: `GET /api/rights/catalog?market=US`.
5. Mandate verify stays separate: `sdk/` + `POST /api/mandate/verify`.

## Delegated issuance (one pilot at a time)

Agents without their own JWKS:

1. Apply: `POST /api/mandate/delegation/apply`
2. Founder admits: `node scripts/admit-delegated-pilot.mjs` (see env vars in script header)
3. Public roster: `GET /api/mandate/delegation/issuers`
4. Issue: `POST /api/mandate/issue` with `X-Zakai-Issue-Key` — mandates carry `zkm.onBehalfOf`

Full issuers with own keys belong in the trust registry (`ZAKAI_EXTRA_ISSUERS_JSON` after conformance).

## Institution onboarding email

Reference Verifier registration sends a welcome message including `POST /api/mandate/conformance/probe` instructions (`src/lib/institutionVerifierOnboardingEmail.ts`).

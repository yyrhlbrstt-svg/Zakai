# Reference Verifier Program

Institutional **pull** without a sales team: banks prove they can verify Mandates, then **opt in** to a public leaders wall.

## What institutions get

1. **Self-serve wizard** (`/[locale]/institutions/leader`) — fetches JWKS, discovery, trust registry, scopes; runs `POST /api/mandate/verify` on a short-lived demo JWT (`GET /api/institution/verifier-readiness/sample`).
2. **Pioneer tier** — first three registrations after successful platform readiness get `tier: pioneer` on the wall.
3. **Public listing** (`/[locale]/institutions/leaders`) — display names only; contact email is stored for ops, not exposed in the API.

## What we do not claim

- Not regulatory certification or supervisory approval.
- Not a list of “signed customers” — empty wall until real opt-ins.
- Registration requires `clientCompletedChecks: true` (honor system on the client); server also checks platform endpoints via `serverSideReadinessOk`.

## Data model

`ReferenceVerifier` in Prisma — `institutionId` (PK, Mandate `aud` slug), bilingual display names, `tier`, `listedAt`.

## API

- `GET /api/institution/reference-verifiers` — public JSON, CORS `*`, cache 120s.
- `POST /api/institution/reference-verifiers` — rate limited (8/day/IP), slug validation via `isValidInstitutionSlug`.

## Embed / co-brand

After listing, institutions can link consumers to Zakai flows with their `institutionId` as Mandate audience — same as integration quickstart; no new scopes.

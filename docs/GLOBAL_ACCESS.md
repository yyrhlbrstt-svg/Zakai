# Global access

Zakai is designed so **any visitor** can discover rights and integrate the protocol without a sales call or Israeli residency.

## What ships today

| Surface | URL | Notes |
|---------|-----|--------|
| Market hub | `/[locale]/global` | Pick market; sets `zakai_market` cookie |
| Markets API | `GET /api/markets` | Public JSON + CORS |
| Rights catalog | `GET /api/rights/catalog?market=XX` | IL + 12 national packs + `EU` |
| Protocol | `GET /api/protocol` | Discovery document |
| OpenAPI | `/.well-known/zakai-openapi.json` | Includes `/markets` |

## Market cookie

- Name: `zakai_market`
- Set on first page load from `x-vercel-ip-country` / `cf-ipcountry` when absent
- Override: `GET /api/markets/select?market=DE&return=/en/global`

`/rights` uses the cookie (via server) to default the country in **RightsChecker**.

## Engine vs catalog-only

- **Full packs** (`MARKETS` in `src/lib/global/registry.ts`): rights evaluation, letter templates, in-app flows.
- **Catalog-only** (`EU` today): ZML rights from `zakai-packs/packs/eu/` (bundled in the monorepo; CDN when `ZML_PACKS_CDN` is live).

Israel remains the deepest vertical (telecom, electricity, Mandate loop). Other markets grow via **country packs** — see `docs/COUNTRY_PACKS.md`.

## Integrators

1. Call `GET /api/markets` once at startup.
2. Fetch `GET /api/rights/catalog?market=<code>` for the user’s market.
3. Optional widget: `docs/WIDGET_EMBED.md` with `data-market` from the same code (or omit — widget reads `zakai_market` cookie when embedded on zakai.app).

## Founder checklist (not code)

- Publish `zakai-packs` to CDN and set `ZML_PACKS_CDN` on Vercel.
- PayPlus (or chosen PSP) for real success fees.
- One widget key for a pilot partner domain.

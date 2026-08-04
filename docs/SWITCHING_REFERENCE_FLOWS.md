# Switching reference flows (conformance)

**Spec:** `zakai-switching` · version in `/.well-known/zakai-switching.json`  
**Code:** `src/lib/protocol/switching.ts`

## Reference profiles (institutions should accept inbound)

| Profile id | Market | Vertical | Entry route | Status |
|------------|--------|----------|-------------|--------|
| `telecom-disconnect-il-1` | IL | telecom | `/telecom-exit` | reference |
| `subscription-cancel-universal-1` | * | subscription | `/cancel/universal` | reference |
| `subscription-cancel-il-1` | IL | subscription | `/cancel` | reference |

## Outbound metadata

Every provider email from `sendOutreach` appends a machine-readable footer:

- `zakai-switching@<version>`
- `switching_profile: <id>` when mappable from case vertical
- `authorization_code` + human verify URL
- `mandate_jti` + `GET /api/mandate/status/{jti}` when Ed25519 mandate was issued
- JWKS URL for offline signature verification

Institutions can parse this block without scraping consumer UI.

**Agents / MCP:** `npx zakai-mandate-mcp` — see `docs/INSTITUTION_QUICKSTART.md`.

## Conformance checklist

1. Accept written consumer letters with Zakai Mandate attachment (HTML).
2. Resolve authority via JWKS + optional jti status endpoint.
3. Map `switching_profile` to internal workflow (cancel vs negotiate vs refund).
4. Reply to the principal or to proofs inbound — Zakai does not promise a phone callback team.

## Version bumps

When a new vertical template ships as a reference flow, bump `SWITCHING_VERSION` in `switching.ts` and republish `zakai-switching.json`.

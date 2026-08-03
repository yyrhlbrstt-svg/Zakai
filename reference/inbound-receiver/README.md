# Zakai inbound receiver (reference)

Clone this folder into your bank/provider stack. It implements
`/.well-known/zakai-inbound-receive.json` without calling Zakai sales.

## Contract

1. Accept `POST` JSON with required fields: `mandate_jws`, `mandate_jti`, `intent`, `vertical`.
2. Set `Idempotency-Key` header = `mandate_jti`.
3. Resolve `iss` via `/.well-known/zakai-trust-registry.json`, then verify JWS against that issuer's JWKS.
4. Reject forbidden outward-money scopes and scopes beyond the issuer's registry grant.
5. Check live revocation: `GET /api/mandate/status/{jti}` — `revoked` → `401`; `unknown` / unreachable → `503 revocation_unknown` (never `accepted: true`). Remember `jti` for idempotency only after accept.
6. Return `202` when accepted for async processing; `409` on duplicate `jti`.
7. Publish `GET /api/pipe/mark` on your developer portal when you process Mandates.

**Preferred one-shot (host or call):** `POST /api/pipe/accept` with `{ mandate_jws, action }`.
Set `ZAKAI_CALL_PIPE_ACCEPT=1` in `receive.mjs` to also hit the hosted decide path after local verify.

## Live reference

Zakai hosts a demo at `POST /api/institution/inbound-receive` (same origin as the app).
Prefer `POST /api/pipe/accept` for Visa-style one-shot. Do not rely on the demo in production.

## Minimal Node example

See `receive.mjs` — zero framework, Node 18+.

## Minimal Python example

See `receive.py` — stdlib only.
